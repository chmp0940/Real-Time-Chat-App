export type NotificationType = "REPLY_ON_THREAD" | "LIKE_ON_THREAD";

export type Notification = {
  id: number;
  type: NotificationType|string;
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

