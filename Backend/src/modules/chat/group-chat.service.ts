import { query } from "../../db/db.js";

// ── Room CRUD ──

export async function createRoom(name: string, creatorUserId: number) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Room name is required.");

  const roomRes = await query(
    `INSERT INTO chat_rooms (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at`,
    [trimmedName, creatorUserId]
  );
  const room = roomRes.rows[0];

  // Auto-add creator as member
  await query(
    `INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [room.id, creatorUserId]
  );

  return {
    id: Number(room.id),
    name: room.name as string,
    createdBy: Number(room.created_by),
    createdAt: (room.created_at as Date).toISOString(),
  };
}

export async function listRoomsForUser(userId: number) {
  const res = await query(
    `SELECT
      r.id,
      r.name,
      r.created_by,
      r.created_at,
      (SELECT COUNT(*)::int FROM chat_room_members WHERE room_id = r.id) AS member_count
    FROM chat_rooms r
    JOIN chat_room_members m ON m.room_id = r.id
    WHERE m.user_id = $1
    ORDER BY r.created_at DESC`,
    [userId]
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    name: row.name as string,
    createdBy: Number(row.created_by),
    createdAt: (row.created_at as Date).toISOString(),
    memberCount: Number(row.member_count),
  }));
}

export async function getRoomById(roomId: number) {
  const res = await query(
    `SELECT id, name, created_by, created_at FROM chat_rooms WHERE id = $1`,
    [roomId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    name: row.name as string,
    createdBy: Number(row.created_by),
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// ── All rooms (for "browse & join") ──

export async function listAllRooms() {
  const res = await query(
    `SELECT
      r.id,
      r.name,
      r.created_by,
      r.created_at,
      (SELECT COUNT(*)::int FROM chat_room_members WHERE room_id = r.id) AS member_count
    FROM chat_rooms r
    ORDER BY r.created_at DESC
    LIMIT 50`
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    name: row.name as string,
    createdBy: Number(row.created_by),
    createdAt: (row.created_at as Date).toISOString(),
    memberCount: Number(row.member_count),
  }));
}

// ── Members ──

export async function listRoomMembers(roomId: number) {
  const res = await query(
    `SELECT
      u.id,
      u.display_name,
      u.handle,
      u.avatar_url,
      m.joined_at
    FROM chat_room_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.room_id = $1
    ORDER BY m.joined_at ASC`,
    [roomId]
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    displayName: (row.display_name as string) ?? null,
    handle: (row.handle as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    joinedAt: (row.joined_at as Date).toISOString(),
  }));
}

export async function isRoomMember(roomId: number, userId: number) {
  const res = await query(
    `SELECT 1 FROM chat_room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
  return res.rows.length > 0;
}

export async function joinRoom(roomId: number, userId: number) {
  await query(
    `INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [roomId, userId]
  );
}

export async function leaveRoom(roomId: number, userId: number) {
  await query(
    `DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
}

export async function removeMemberFromRoom(
  roomId: number,
  targetUserId: number,
  requestingUserId: number
) {
  // Only the room creator can remove others
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.createdBy !== requestingUserId) {
    throw new Error("Only the room creator can remove members.");
  }
  // Can't remove yourself via this endpoint (use leave instead)
  if (targetUserId === requestingUserId) {
    throw new Error("Use leave to remove yourself.");
  }
  await query(
    `DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, targetUserId]
  );
}

// ── Messages ──

export async function sendRoomMessage(params: {
  roomId: number;
  senderUserId: number;
  body: string | null;
  imageUrl?: string | null;
}) {
  const { roomId, senderUserId } = params;
  const rawBody = params?.body ?? "";
  const trimmedBody = rawBody.trim();
  const setImageUrl = params?.imageUrl ?? null;

  if (!trimmedBody && !setImageUrl) {
    throw new Error("Message body or image URL must be provided.");
  }

  const insertRes = await query(
    `INSERT INTO chat_room_messages (room_id, sender_user_id, body, image_url)
     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
    [roomId, senderUserId, trimmedBody || null, setImageUrl]
  );

  const row = insertRes.rows[0];

  const fullRes = await query(
    `SELECT
      m.id,
      m.room_id,
      m.sender_user_id,
      m.body,
      m.image_url,
      m.created_at,
      u.display_name AS sender_display_name,
      u.handle AS sender_handle,
      u.avatar_url AS sender_avatar_url
    FROM chat_room_messages m
    JOIN users u ON u.id = m.sender_user_id
    WHERE m.id = $1`,
    [row.id]
  );

  const full = fullRes.rows[0];
  return mapRoomMessageRow(full);
}

export async function listRoomMessages(roomId: number, limit?: number) {
  const setLimit = Math.min(Math.max(limit || 50, 1), 200);

  const res = await query(
    `SELECT
      m.id,
      m.room_id,
      m.sender_user_id,
      m.body,
      m.image_url,
      m.created_at,
      u.display_name AS sender_display_name,
      u.handle AS sender_handle,
      u.avatar_url AS sender_avatar_url
    FROM chat_room_messages m
    JOIN users u ON u.id = m.sender_user_id
    WHERE m.room_id = $1
    ORDER BY m.created_at DESC
    LIMIT $2`,
    [roomId, setLimit]
  );

  return res.rows.slice().reverse().map(mapRoomMessageRow);
}

function mapRoomMessageRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    senderUserId: Number(row.sender_user_id),
    body: (row.body as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: row.updated_at ? (row.updated_at as Date).toISOString() : null,
    deletedAt: row.deleted_at ? (row.deleted_at as Date).toISOString() : null,
    sender: {
      displayName: (row.sender_display_name as string) ?? null,
      handle: (row.sender_handle as string) ?? null,
      avatarUrl: (row.sender_avatar_url as string) ?? null,
    },
  };
}

// ── Edit / Delete room messages ──

export async function editRoomMessage(params: {
  messageId: number;
  senderUserId: number;
  newBody: string;
}) {
  const { messageId, senderUserId, newBody } = params;

  const check = await query(
    `SELECT sender_user_id, deleted_at, room_id FROM chat_room_messages WHERE id = $1`,
    [messageId],
  );
  const row = check.rows[0];
  if (!row) throw new Error("Message not found");
  if (Number(row.sender_user_id) !== senderUserId) throw new Error("Not your message");
  if (row.deleted_at) throw new Error("Cannot edit a deleted message");

  await query(
    `UPDATE chat_room_messages SET body = $1, updated_at = NOW() WHERE id = $2`,
    [newBody.trim(), messageId],
  );

  return { id: messageId, roomId: Number(row.room_id), body: newBody.trim(), updatedAt: new Date().toISOString() };
}

export async function softDeleteRoomMessage(params: {
  messageId: number;
  senderUserId: number;
}) {
  const { messageId, senderUserId } = params;

  const check = await query(
    `SELECT sender_user_id, room_id FROM chat_room_messages WHERE id = $1`,
    [messageId],
  );
  const row = check.rows[0];
  if (!row) throw new Error("Message not found");
  if (Number(row.sender_user_id) !== senderUserId) throw new Error("Not your message");

  await query(
    `UPDATE chat_room_messages SET deleted_at = NOW(), body = NULL, image_url = NULL WHERE id = $1`,
    [messageId],
  );

  return { id: messageId, roomId: Number(row.room_id), deletedAt: new Date().toISOString() };
}

