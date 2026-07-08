export type NotificationRow = {
  id: number;
  type: string;
  threadId: number;
  createdAt: Date;
  read_at: Date | null;
  actor_display_name: string | null;
  actor_handle: string | null;
  thread_title: string | null;
};

export type Notification = {
  id: number;
  type: string;
  threadId: number;
  createdAt: string;
  read_at: string | null;
  actor: {
    display_name: string | null;
    handle: string | null;
  };
  thread: {
    title: string;
  };
};

export function mapNotificationRowToNotification(
  row: NotificationRow,
): Notification {
  return {
    id: row.id,
    type: row.type,
    threadId: row.threadId,
    createdAt: row.createdAt.toISOString(),
    read_at: row.read_at ? row.read_at.toISOString() : null,
    actor: {
      display_name: row.actor_display_name,
      handle: row.actor_handle,
    },
    thread: {
      title: row.thread_title || "",
    },
  };
}
