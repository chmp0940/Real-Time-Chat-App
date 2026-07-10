import {
  mapNotificationRowToNotification,
  NotificationRow,
} from "./notification.types.js";
import { query } from "../../db/db.js";
import { getIo } from "../../realtime/io.js";

export async function createReplyNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  const { threadId, actorUserId } = params;

  const threadRes = await query(
    `
      SELECT author_user_id
      FROM threads
      WHERE ID=$1
      LIMIT 1
    `,
    [threadId],
  );

  const row = threadRes.rows[0] as { author_user_id: number } | undefined;
  if (!row) {
    throw new Error(`Thread with ID ${threadId} not found`);
  }

  const authorUserId = row.author_user_id;

  if (authorUserId === actorUserId) {
    return;
  }

  const insertRes = await query(
    `
      INSERT INTO notifications (user_id,actor_user_id,thread_id,type)
      VALUES ( $1, $2, $3,'REPLY_ON_THREAD')
      RETURNING id,created_at
    `,
    [authorUserId, actorUserId, threadId],
  );

  const notiRow = insertRes.rows[0] as {
    id: number;
  };
  if (!notiRow) {
    throw new Error("Failed to create notification");
  }

  const fullRes = await query(
    `
      SELECT 
      n.id,
      n.type,
      n.thread_id AS "threadId",
      n.created_at AS "createdAt",
      n.read_at,
      actor.display_name AS "actor_display_name",
      actor.handle AS "actor_handle",
      t.title AS "thread_title"
      FROM notifications n
      JOIN users actor ON actor.id=n.actor_user_id
      JOIN threads t ON t.id=n.thread_id
      WHERE n.id = $1
    `,
    [notiRow.id],
  );

  const fullRow = fullRes.rows[0] as NotificationRow | undefined;

  if (!fullRow) {
    throw new Error("Failed to retrieve full notification data");
  }

  const payload = mapNotificationRowToNotification(fullRow);

  // emit first socket event
  // notification:new
  const io = getIo();
  if (io) {
    io.to(`notifications:user:${authorUserId}`).emit(
      "notification:new",
      payload,
    );
  }

  return payload;
}

export async function createLikeNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  const { threadId, actorUserId } = params;

  const threadRes = await query(
    `
      SELECT author_user_id
      FROM threads
      WHERE ID=$1
      LIMIT 1
    `,
    [threadId],
  );

  const row = threadRes.rows[0] as { author_user_id: number } | undefined;
  if (!row) {
    throw new Error(`Thread with ID ${threadId} not found`);
  }

  const authorUserId = row.author_user_id;

  if (authorUserId === actorUserId) {
    return;
  }

  const insertRes = await query(
    `
      INSERT INTO notifications (user_id,actor_user_id,thread_id,type)
      VALUES ( $1, $2, $3,'LIKE_ON_THREAD')
      RETURNING id,created_at
    `,
    [authorUserId, actorUserId, threadId],
  );

  const notiRow = insertRes.rows[0] as {
    id: number;
  };
  if (!notiRow) {
    throw new Error("Failed to create notification");
  }

  const fullRes = await query(
    `
      SELECT 
      n.id,
      n.type,
      n.thread_id AS "threadId",
      n.created_at AS "createdAt",
      n.read_at,
      actor.display_name AS "actor_display_name",
      actor.handle AS "actor_handle",
      t.title AS "thread_title"
      FROM notifications n
      JOIN users actor ON actor.id=n.actor_user_id
      JOIN threads t ON t.id=n.thread_id
      WHERE n.id = $1
    `,
    [notiRow.id],
  );

  const fullRow = fullRes.rows[0] as NotificationRow | undefined;

  if (!fullRow) {
    throw new Error("Failed to retrieve full notification data");
  }

  const payload = mapNotificationRowToNotification(fullRow);

  // emit first socket event
  // notification:new
  const io = getIo();
  if (io) {
    io.to(`notifications:user:${authorUserId}`).emit(
      "notification:new",
      payload,
    );
  }

  return payload;
}

export async function listNotificationsForUser(params: {
  userId: number;
  unreadOnly?: boolean;
}) {
  const { userId, unreadOnly } = params;

  const conditions = ["n.user_id=$1"];
  const values: unknown[] = [userId];

  if (unreadOnly) {
    conditions.push("n.read_at IS NULL");
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const result = await query(
    `
      SELECT 
      n.id,
      n.type,
      n.thread_id AS "threadId",
      n.created_at AS "createdAt",
      n.read_at,
      actor.display_name AS "actor_display_name",
      actor.handle AS "actor_handle",
      t.title AS "thread_title"
      FROM notifications n
      JOIN users actor ON actor.id=n.actor_user_id
      JOIN threads t ON t.id=n.thread_id
      ${whereClause}
      ORDER BY n.created_at DESC
    `,
    values,
  );

  return result.rows.map((noti) =>
    mapNotificationRowToNotification(noti as NotificationRow),
  );
}

export async function markNotificationAsRead(params: {
  userId: number;
  notificationId: number;
}) {
  const { userId, notificationId } = params;

  await query(
    `
      UPDATE notifications
      SET read_at=COALESCE(read_at, NOW())
      WHERE id=$1 AND user_id=$2
    `,
    [notificationId, userId],
  );
}

// CREATE A FUNCTION TO HANDLE ALL NOTIFICATION AS READ AT ONCE

export async function markAllNotificationsAsRead(params: { userId: number }) {
  const { userId } = params;

  await query(
    `
      UPDATE notifications
      SET read_at=COALESCE(read_at, NOW())
      WHERE user_id=$1
    `,
    [userId],
  );
}
