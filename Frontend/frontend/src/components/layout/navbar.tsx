"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, UserButton, useUser } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import {
  Bell,
  Menu,
  Moon,
  Sun,
  X,
  MessageSquare,
  Layers,
  User,
  Wifi,
  WifiOff,
  Hash,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSocket } from "../../../hooks/use-socket";
import { apiGet, createApiClient } from "@/lib/api-client";
import { Notification } from "@/types/notification";
import { useNotificationCount } from "../../../hooks/notification-count";
import { toast } from "sonner";

function Navbar() {
  const { isSignedIn } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const { getToken, userId } = useAuth();
  const { socket, connected } = useSocket();
  const { unreadCount, setUnreadCount, incrementUnreadCount } =
    useNotificationCount();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadUnreadNotifications() {
      if (!userId) {
        if (isMounted) {
          setUnreadCount(0);
          return;
        }
      }
      try {
        const data = await apiGet<Notification[]>(
          apiClient,
          "/api/notifications?unread_only=true",
        );
        if (!isMounted) return;
        setUnreadCount(data.length);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error fetching unread notifications:", error);
      }
    }
    loadUnreadNotifications();
  }, [apiClient, setUnreadCount, userId]);

  useEffect(() => {
    if (!socket || !connected) {
      return;
    }

    const handleNotification = (payload: Notification) => {
      incrementUnreadCount(1);

      toast("New Notification", {
        description:
          payload.type === "REPLY_ON_THREAD"
            ? `${payload.actor.handle ?? "someone"} commented on your thread.`
            : `${payload.actor.handle ?? "someone"} liked  your thread.`,
      });
    };

    const handlePresence = (payload: { onlineUserIds: number[] }) => {
      setOnlineCount(payload?.onlineUserIds?.length ?? 0);
    };

    socket.on("notification:new", handleNotification);
    socket.on("presence:update", handlePresence);

    return () => {
      socket.off("notification:new", handleNotification);
      socket.off("presence:update", handlePresence);
    };
  }, [socket, connected, incrementUnreadCount]);

  const navItems = [
    {
      href: "/",
      label: "Threads",
      icon: Layers,
      isActive: pathname === "/" || pathname.startsWith("/threads"),
    },
    {
      href: "/chat",
      label: "Chat",
      icon: MessageSquare,
      isActive: pathname.startsWith("/chat"),
    },
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  const renderNavLinks = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`group/nav flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
          item.isActive
            ? "bg-primary/15 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <Icon className={`h-4 w-4 transition-transform duration-200 group-hover/nav:scale-110 ${
          item.isActive ? "text-primary" : ""
        }`} />
        {item.label}
      </Link>
    );
  };

  return (
    <header className="navbar-glass sticky top-0 z-40 border-b border-border/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-lg font-bold text-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2 shadow-md shadow-primary/25 transition-transform duration-200 group-hover:scale-105">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                Thread
              </span>
              <span className="text-foreground/90">Stream</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(renderNavLinks)}
          </nav>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Online count badge */}
          {isSignedIn && (
            <div className="hidden items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {onlineCount} online
              </span>
            </div>
          )}

          {/* Connection status indicator */}
          {isSignedIn && (
            <div className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:flex ${
              connected
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`}>
              {connected ? (
                <><Wifi className="h-3 w-3" /> Live</>
              ) : (
                <><WifiOff className="h-3 w-3" /> Offline</>
              )}
            </div>
          )}

          {isSignedIn ? (
            <>
              <Link href="/notifications">
                <Button
                  size="icon"
                  variant="ghost"
                  className="relative h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/40 notification-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
              <div className="h-5 w-px bg-border/50 hidden md:block" />
              <UserButton />
            </>
          ) : (
            <Link href="/sign-in">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/30 rounded-lg"
              >
                Sign In
              </Button>
            </Link>
          )}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground md:hidden transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-enter border-t border-border/50 bg-card/95 backdrop-blur-md md:hidden">
          <nav className="mx-auto flex flex-col gap-1 max-w-6xl px-4 pb-4 pt-3 items-start">
            {navItems.map(renderNavLinks)}
            {/* Mobile connection status */}
            {isSignedIn && (
              <div className="mt-2 flex items-center gap-3 px-3 pt-2 border-t border-border/50 w-full">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {onlineCount} online
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-medium ${
                  connected ? "text-primary" : "text-destructive"
                }`}>
                  {connected ? (
                    <><Wifi className="h-3 w-3" /> Live</>
                  ) : (
                    <><WifiOff className="h-3 w-3" /> Offline</>
                  )}
                </div>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
