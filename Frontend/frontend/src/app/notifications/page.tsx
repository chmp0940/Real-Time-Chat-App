"use client";

import { apiGet, createApiClient } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNotificationCount } from "../../../hooks/notification-count";
import { BellOff, CheckCheck, Inbox, MessageCircle, ThumbsUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notification } from "@/types/notification";
import { toast } from "sonner";

function formatText(n: Notification) {
  const actor =
    n.actor.handle !== null && n.actor.handle !== ""
      ? `@${n.actor.handle}`
      : (n.actor.display_name ?? "Someone");

  if (n.type === "REPLY_ON_THREAD") {
    return `${actor} commented on your thread`;
  }

  if (n.type === "LIKE_ON_THREAD") {
    return `${actor} liked your thread`;
  }
  return `${actor} interacted with your thread`;
}

function NotificationsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  const { setUnreadCount, decrementUnreadCount } = useNotificationCount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);

        const data = await apiGet<Notification[]>(
          apiClient,
          "/api/notifications",
        );
        if (!isMounted) {
          return;
        }

        setNotifications(data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [apiClient, getToken]);

  async function openNoti(n: Notification) {
    try {
      if (!n.read_at) {
        await apiClient.post(`/api/notifications/${n.id}/read`);
        setNotifications((prev) =>
          prev.map((noti) =>
            noti.id === n.id
              ? { ...noti, read_at: new Date().toISOString() }
              : noti,
          ),
        );
        decrementUnreadCount();
      }
    } catch (error) {
      console.error("Error opening notification:", error);
    }
    router.push(`/threads/${n.threadId}`);
  }

  async function handleMarkAllRead() {
    try {
      setMarkingAll(true);
      await apiClient.post("/api/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto flex w-full flex-col gap-6 py-8 px-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
            <Inbox className="h-7 w-7 text-primary" />
            Notifications
          </h1>
          {!isLoading && notifications.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
          )}
        </div>
        {!isLoading && unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markingAll ? "Marking..." : "Mark All Read"}
          </Button>
        )}
      </div>

      <Card className="border-border/70 bg-card">
        {/* Skeleton loaders */}
        {isLoading && (
          <CardContent className="divide-y divide-border/70">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4 px-3 py-4">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-5 w-12 rounded-full" />
                </div>
                <div className="skeleton h-3 w-20" />
              </div>
            ))}
          </CardContent>
        )}

        {/* Empty state */}
        {!isLoading && notifications.length === 0 && (
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-lg font-medium text-foreground/80">
              No notifications yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll see activity on your threads here
            </p>
          </CardContent>
        )}

        {!isLoading && notifications.length > 0 && (
          <CardContent className="divide-y divide-border/70">
            {notifications.map((n) => {
              const text = formatText(n);
              const icon =
                n.type === "REPLY_ON_THREAD" ? (
                  <MessageCircle className="h-4 w-4 text-chart-2" />
                ) : (
                  <ThumbsUp className="h-4 w-4 text-primary" />
                );

              const isUnread = !n.read_at;

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNoti(n)}
                  className={`flex w-full items-start gap-4 rounded-lg px-3 py-4 text-left transition-all duration-200 ${
                    isUnread
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-primary/20"
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/60">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p
                        className={`text-sm ${
                          isUnread
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {text}
                      </p>
                      <span
                        className={`shrink-0 text-xs ${
                          isUnread
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(n.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {n.thread.title}
                    </p>
                    {isUnread && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          className="border-primary/30 bg-primary/10 text-[12px] text-primary"
                          variant="outline"
                        >
                          New
                        </Badge>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default NotificationsPage;
