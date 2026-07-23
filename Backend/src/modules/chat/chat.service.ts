import { query } from "../../db/db.js";

export async function listChatUsers(currentUserId: number) {
  try {
    const result = await query(
      `
      SELECT 
      id,
      display_name,
      handle,
      avatar_url
      FROM users
      WHERE id <> $1
      ORDER BY COALESCE(display_name, handle,'USER') ASC
      `,
      [currentUserId],
    );

    return result.rows.map((row) => ({
      id: row.id as number,
      displayName: (row.display_name as string) ?? null,
      handle: (row.handle as string) ?? null,
      avatarUrl: (row.avatar_url as string) ?? null,
    }));
  } catch (error) {
    throw error;
  }
}

export async function listDirectMessages(params: {
  userId: number;
  otherUserId: number;
  limit?: number;
}) {
  try {
    const { userId, otherUserId, limit } = params;

    const setLimit = Math.min(Math.max(limit || 50, 1), 200);

    const result = await query(
      `
      SELECT 
      dm.id,
      dm.sender_user_id,
      dm.receipient_user_id,
      dm.body,
      dm.image_url,
      dm.created_at,
      s.display_name AS sender_display_name,
      s.handle AS sender_handle,
      s.avatar_url AS sender_avatar_url,
      r.display_name AS receipient_display_name,
      r.handle AS receipient_handle,
      r.avatar_url AS receipient_avatar_url
      FROM direct_messages dm
      JOIN users s ON dm.sender_user_id = s.id
      JOIN users r ON dm.receipient_user_id = r.id
      WHERE (dm.sender_user_id = $1 AND dm.receipient_user_id = $2) OR (dm.sender_user_id = $2 AND dm.receipient_user_id = $1)
      ORDER BY dm.created_at DESC
      LIMIT $3
      `,
      [userId, otherUserId, setLimit],
    );

    const rows = result.rows.slice().reverse();

    return rows.map((row) => ({
      id: row.id as number,
      senderUserId: row.sender_user_id as number,
      receipientUserId: row.receipient_user_id as number,
      body: (row.body as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      sender: {
        displayName: (row.sender_display_name as string) ?? null,
        handle: (row.sender_handle as string) ?? null,
        avatarUrl: (row.sender_avatar_url as string) ?? null,
      },
      receipient: {
        displayName: (row.receipient_display_name as string) ?? null,
        handle: (row.receipient_handle as string) ?? null,
        avatarUrl: (row.receipient_avatar_url as string) ?? null,
      },
    }));
  } catch (error) {
    throw error;
  }
}

export async function sendDirectMessage(params: {
  senderUserId: number;
  receipientUserId: number;
  body: string | null;
  imageUrl?: string | null;
}) {
  const { senderUserId, receipientUserId } = params;

  const rawBody = params?.body ?? "";
  const trimmedBody = rawBody.trim();
  const setImageUrl = params?.imageUrl ?? null;

  if (!trimmedBody && !setImageUrl) {
    throw new Error("Message body or image URL must be provided.");
  }

  const insertRes = await query(
    `
      INSERT INTO direct_messages
      (sender_user_id, receipient_user_id, body, image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id,created_at
      `,
    [senderUserId, receipientUserId, trimmedBody || null, setImageUrl],
  );
  const row = insertRes.rows[0];
  const fullRes = await query(
    `
      SELECT 
      dm.id,
      dm.sender_user_id,
      dm.receipient_user_id,
      dm.body,
      dm.image_url,
      dm.created_at,
      s.display_name AS sender_display_name,
      s.handle AS sender_handle,
      s.avatar_url AS sender_avatar_url,
      r.display_name AS receipient_display_name,
      r.handle AS receipient_handle,
      r.avatar_url AS receipient_avatar_url
      FROM direct_messages dm
      JOIN users s ON dm.sender_user_id = s.id
      JOIN users r ON dm.receipient_user_id = r.id
      WHERE dm.id = $1
      LIMIT 1
    `,
    [row.id],
  );

  const fullRow = fullRes.rows[0];
  if (!fullRow) {
    throw new Error("Failed to load the inserted direct message.");
  }
  return {
    id: fullRow.id as number,
    senderUserId: fullRow.sender_user_id as number,
    receipientUserId: fullRow.receipient_user_id as number,
    body: (fullRow.body as string) ?? null,
    imageUrl: (fullRow.image_url as string) ?? null,
    createdAt: (fullRow.created_at as Date).toISOString(),
    sender: {
      displayName: (fullRow.sender_display_name as string) ?? null,
      handle: (fullRow.sender_handle as string) ?? null,
      avatarUrl: (fullRow.sender_avatar_url as string) ?? null,
    },
    receipient: {
      displayName: (fullRow.receipient_display_name as string) ?? null,
      handle: (fullRow.receipient_handle as string) ?? null,
      avatarUrl: (fullRow.receipient_avatar_url as string) ?? null,
    },
  };
}

// ── Edit / Delete messages ──

export async function editDirectMessage(params: {
  messageId: number;
  senderUserId: number;
  newBody: string;
}) {
  const { messageId, senderUserId, newBody } = params;

  const check = await query(
    `SELECT sender_user_id, deleted_at FROM direct_messages WHERE id = $1`,
    [messageId],
  );
  const row = check.rows[0];
  if (!row) throw new Error("Message not found");
  if (Number(row.sender_user_id) !== senderUserId) throw new Error("Not your message");
  if (row.deleted_at) throw new Error("Cannot edit a deleted message");

  await query(
    `UPDATE direct_messages SET body = $1, updated_at = NOW() WHERE id = $2`,
    [newBody.trim(), messageId],
  );

  return { id: messageId, body: newBody.trim(), updatedAt: new Date().toISOString() };
}

export async function softDeleteDirectMessage(params: {
  messageId: number;
  senderUserId: number;
}) {
  const { messageId, senderUserId } = params;

  const check = await query(
    `SELECT sender_user_id FROM direct_messages WHERE id = $1`,
    [messageId],
  );
  const row = check.rows[0];
  if (!row) throw new Error("Message not found");
  if (Number(row.sender_user_id) !== senderUserId) throw new Error("Not your message");

  await query(
    `UPDATE direct_messages SET deleted_at = NOW(), body = NULL, image_url = NULL WHERE id = $1`,
    [messageId],
  );

  return { id: messageId, deletedAt: new Date().toISOString() };
}

// ── Read Receipts ──

export async function markConversationAsRead(params: {
  ownerUserId: number;
  otherUserId: number;
  lastReadMsgId: number;
}) {
  const { ownerUserId, otherUserId, lastReadMsgId } = params;

  await query(
    `INSERT INTO dm_read_cursors (owner_user_id, other_user_id, last_read_msg_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (owner_user_id, other_user_id)
     DO UPDATE SET last_read_msg_id = GREATEST(dm_read_cursors.last_read_msg_id, $3), updated_at = NOW()`,
    [ownerUserId, otherUserId, lastReadMsgId],
  );
}

export async function getReadCursor(ownerUserId: number, otherUserId: number) {
  const res = await query(
    `SELECT last_read_msg_id FROM dm_read_cursors WHERE owner_user_id = $1 AND other_user_id = $2`,
    [ownerUserId, otherUserId],
  );
  return res.rows[0]?.last_read_msg_id ? Number(res.rows[0].last_read_msg_id) : null;
}

export async function getUnreadCountsForUser(userId: number) {
  // Count unread messages per conversation partner
  const res = await query(
    `SELECT
      dm.sender_user_id AS other_user_id,
      COUNT(*)::int AS unread_count
     FROM direct_messages dm
     LEFT JOIN dm_read_cursors rc
       ON rc.owner_user_id = $1 AND rc.other_user_id = dm.sender_user_id
     WHERE dm.receipient_user_id = $1
       AND dm.deleted_at IS NULL
       AND (rc.last_read_msg_id IS NULL OR dm.id > rc.last_read_msg_id)
     GROUP BY dm.sender_user_id`,
    [userId],
  );

  const counts: Record<number, number> = {};
  for (const row of res.rows) {
    counts[Number(row.other_user_id)] = Number(row.unread_count);
  }
  return counts;
}
