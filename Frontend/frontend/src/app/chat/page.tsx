"use client";

import { useAuth } from "@clerk/nextjs";
import { useSocket } from "../../../hooks/use-socket";
import { useMemo, useState, useEffect } from "react";
import { apiGet, createApiClient } from "@/lib/api-client";
import { ChatRoom, ChatUser } from "@/types/chat";
import { Card, CardContent } from "@/components/ui/card";
import { Hash, MessageSquare, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DirectChatPanel from "@/components/chat/direct-chat-panel";
import GroupChatPanel from "@/components/chat/group-chat-panel";
import CreateRoomDialog from "@/components/chat/create-room-dialog";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Tab = "dm" | "rooms";

function Chat() {
  const { getToken } = useAuth();
  const { connected, socket } = useSocket();
  const searchParams = useSearchParams();

  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  // Tab state
  const defaultTab = searchParams.get("tab") === "rooms" ? "rooms" : "dm";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // DM state
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Room state
  const [myRooms, setMyRooms] = useState<ChatRoom[]>([]);
  const [allRooms, setAllRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);

  // Unread DM counts
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  // Load DM users + current user
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadingUsers(true);
      try {
        const me = await apiGet<{ id: number }>(apiClient, "/api/me");
        setCurrentUserId(Number(me.id));

        const res = await apiGet<ChatUser[]>(apiClient, "/api/chat/users");
        if (!isMounted) return;
        const finalRes = res.map((row) => ({
          id: Number(row.id),
          displayName: row.displayName ?? null,
          handle: row.handle ?? null,
          avatarUrl: row.avatarUrl ?? null,
        }));
        setUsers(finalRes);

        if (finalRes.length > 0 && activeUserId === null) {
          setActiveUserId(finalRes[0].id);
        }

        // Fetch unread counts
        try {
          const counts = await apiGet<Record<number, number>>(apiClient, "/api/chat/unread-counts");
          setUnreadCounts(counts ?? {});
        } catch { /* ignore */ }
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingUsers(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [getToken]);

  // Load rooms when tab switches
  useEffect(() => {
    if (activeTab !== "rooms") return;
    let isMounted = true;
    async function loadRooms() {
      setLoadingRooms(true);
      try {
        const [myRes, allRes] = await Promise.all([
          apiGet<ChatRoom[]>(apiClient, "/api/group-chat/rooms"),
          apiGet<ChatRoom[]>(apiClient, "/api/group-chat/rooms/browse"),
        ]);
        if (!isMounted) return;

        const my = (Array.isArray(myRes) ? myRes : (myRes as any)?.data ?? []).map((r: any) => ({
          ...r,
          id: Number(r.id),
          createdBy: Number(r.createdBy),
        }));
        const all = (Array.isArray(allRes) ? allRes : (allRes as any)?.data ?? []).map((r: any) => ({
          ...r,
          id: Number(r.id),
          createdBy: Number(r.createdBy),
        }));
        setMyRooms(my);
        setAllRooms(all);

        if (my.length > 0 && activeRoomId === null) {
          setActiveRoomId(Number(my[0].id));
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingRooms(false);
      }
    }
    loadRooms();
    return () => { isMounted = false; };
  }, [apiClient, activeTab]);

  // Presence
  useEffect(() => {
    if (!socket) return;
    function handlePresence(payload: { onlineUserIds: number[] }) {
      setOnlineUserIds(payload?.onlineUserIds ?? []);
    }
    socket.on("presence:update", handlePresence);
    return () => { socket.off("presence:update", handlePresence); };
  }, [socket]);

  const activeUser = activeUserId !== null ? users.find((u) => u.id === activeUserId) : null;
  const activeRoom = activeRoomId !== null ? myRooms.find((r) => r.id === activeRoomId) : null;
  const onlineCount = users.filter((u) => onlineUserIds.includes(u.id)).length;

  // Clear unread count when switching to a user
  function handleSelectUser(userId: number) {
    setActiveUserId(userId);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  // Listen for new DM messages to increment unread for non-active conversations
  useEffect(() => {
    if (!socket) return;
    function handleNewDm(payload: any) {
      const senderId = Number(payload.senderUserId ?? payload.sender_user_id);
      if (senderId && senderId !== currentUserId && senderId !== activeUserId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      }
    }
    socket.on("dm:message", handleNewDm);
    return () => { socket.off("dm:message", handleNewDm); };
  }, [socket, currentUserId, activeUserId]);

  // Room join handler
  async function handleJoinRoom(roomId: number) {
    try {
      await apiClient.post(`/api/group-chat/rooms/${roomId}/join`);
      // Inform socket to join the room
      socket?.emit("room:join", { roomId });
      // Reload rooms
      const myRes = await apiGet<ChatRoom[]>(apiClient, "/api/group-chat/rooms");
      const my = Array.isArray(myRes) ? myRes : (myRes as any)?.data ?? [];
      setMyRooms(my);
      setActiveRoomId(roomId);
      setBrowseMode(false);
      toast.success("Joined room!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to join room");
    }
  }

  // Room leave handler
  async function handleLeaveRoom(roomId: number) {
    try {
      await apiClient.post(`/api/group-chat/rooms/${roomId}/leave`);
      setMyRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        setActiveRoomId(null);
      }
      toast.success("Left room");
    } catch (err) {
      console.error(err);
      toast.error("Failed to leave room");
    }
  }

  // Rooms the user has NOT joined
  const myRoomIds = new Set(myRooms.map((r) => r.id));
  const browsableRooms = allRooms.filter((r) => !myRoomIds.has(r.id));

  return (
    <div className="max-auto max-w-6xl flex w-full flex-col gap-4 py-6 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 md:w-72">
        <Card className="h-full border-border/70 bg-card md:sticky md:top-24">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("dm")}
              className={cn(
                "flex-1 px-4 py-3 text-xs font-medium transition-colors",
                activeTab === "dm"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
              Direct
            </button>
            <button
              onClick={() => setActiveTab("rooms")}
              className={cn(
                "flex-1 px-4 py-3 text-xs font-medium transition-colors",
                activeTab === "rooms"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Hash className="mr-1 inline h-3.5 w-3.5" />
              Rooms
            </button>
          </div>

          {/* DM Tab */}
          {activeTab === "dm" && (
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <CardTitle className="text-sm text-foreground">Direct Messages</CardTitle>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {onlineCount} Online · {users.length} total
                </p>
              </CardHeader>
              <CardContent className="flex max-h-[calc(100vh-16rem)] flex-col gap-1 overflow-y-auto chat-scroll">
                {loadingUsers && (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
                        <div className="skeleton h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <div className="skeleton h-3 w-24" />
                          <div className="skeleton h-3 w-14" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!loadingUsers &&
                  users.map((user) => {
                    const isOnline = onlineUserIds.includes(user.id);
                    const isActive = activeUserId === user.id;
                    const label = user.handle && user.handle !== "" ? `@${user.handle}` : (user.displayName ?? "User");

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs transition-all duration-200",
                          isActive
                            ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                            : "text-muted-foreground hover:bg-card/90"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={label} />}
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                              isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex flex-1 flex-col">
                          <span className="truncate text-[12px] font-medium text-foreground">{label}</span>
                          <span className={cn("text-[12px]", isOnline ? "text-primary" : "text-muted-foreground")}>
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                        {/* Unread badge */}
                        {(unreadCounts[user.id] ?? 0) > 0 && (
                          <span className="unread-badge-bounce inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                            {unreadCounts[user.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </CardContent>
            </>
          )}

          {/* Rooms Tab */}
          {activeTab === "rooms" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm text-foreground">Group Rooms</CardTitle>
                  </div>
                  <Button
                    size="icon"
                    onClick={() => setShowCreateDialog(true)}
                    className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setBrowseMode(false)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                      !browseMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    My Rooms
                  </button>
                  <button
                    onClick={() => setBrowseMode(true)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                      browseMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Browse
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex max-h-[calc(100vh-18rem)] flex-col gap-1 overflow-y-auto chat-scroll">
                {loadingRooms && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
                        <div className="skeleton h-8 w-8 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <div className="skeleton h-3 w-28" />
                          <div className="skeleton h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* My Rooms */}
                {!loadingRooms && !browseMode && myRooms.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground">No rooms yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create one or browse to join!</p>
                  </div>
                )}
                {!loadingRooms &&
                  !browseMode &&
                  myRooms.map((room) => {
                    const isActive = activeRoomId === room.id;
                    return (
                      <div key={room.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveRoomId(room.id)}
                          className={cn(
                            "flex flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left text-xs transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                              : "text-muted-foreground hover:bg-card/90"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                            #
                          </div>
                          <div className="min-w-0 flex flex-1 flex-col">
                            <span className="truncate text-[12px] font-medium text-foreground">
                              {room.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {room.memberCount} member{room.memberCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}

                {/* Browse rooms */}
                {!loadingRooms && browseMode && browsableRooms.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      {allRooms.length === 0
                        ? "No rooms exist yet — create the first one!"
                        : "You've joined all available rooms!"}
                    </p>
                  </div>
                )}
                {!loadingRooms &&
                  browseMode &&
                  browsableRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-3 text-xs text-muted-foreground"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
                        #
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-[12px] font-medium text-foreground">
                          {room.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {room.memberCount} member{room.memberCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinRoom(room.id)}
                        className="h-7 bg-primary text-primary-foreground hover:bg-primary/90 text-[11px]"
                      >
                        Join
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </>
          )}
        </Card>
      </aside>

      <main className="min-h-[calc(100vh-8rem)] flex-1 md:min-h-auto">
        {/* DM Panel */}
        {activeTab === "dm" && (
          <>
            {activeUserId && activeUser ? (
              currentUserId !== null ? (
                <DirectChatPanel
                  otherUserId={activeUserId}
                  currentUserId={currentUserId}
                  otherUser={activeUser}
                  socket={socket}
                  connected={connected}
                />
              ) : null
            ) : (
              <Card className="flex h-full items-center justify-center border-border/70 bg-card">
                <CardContent className="text-center py-20">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20">
                    <Users className="h-8 w-8 text-primary/70" />
                  </div>
                  <p className="text-lg font-medium text-foreground/80">Start a conversation</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a user from the sidebar to begin chatting
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Room Panel */}
        {activeTab === "rooms" && (
          <>
            {activeRoomId && activeRoom ? (
              currentUserId !== null ? (
                <div className="flex h-full flex-col">
                  <GroupChatPanel
                    roomId={activeRoomId}
                    roomName={activeRoom.name}
                    currentUserId={currentUserId}
                    socket={socket}
                    connected={connected}
                  />
                  {/* Leave room button */}
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLeaveRoom(activeRoomId)}
                      className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Leave Room
                    </Button>
                  </div>
                </div>
              ) : null
            ) : (
              <Card className="flex h-full items-center justify-center border-border/70 bg-card">
                <CardContent className="text-center py-20">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20">
                    <Hash className="h-8 w-8 text-primary/70" />
                  </div>
                  <p className="text-lg font-medium text-foreground/80">Group Chat</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a room or create a new one
                  </p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Create Room
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Create Room Dialog */}
      <CreateRoomDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(room) => {
          const roomWithNumberId = {
            ...room,
            id: Number(room.id),
            createdBy: currentUserId!,
            createdAt: new Date().toISOString(),
            memberCount: 1,
          };
          setMyRooms((prev) => [roomWithNumberId, ...prev]);
          setActiveRoomId(Number(room.id));
          setActiveTab("rooms");
          socket?.emit("room:join", { roomId: Number(room.id) });
          toast.success(`Room "${room.name}" created!`);
        }}
        apiClient={apiClient}
      />
    </div>
  );
}

import { Suspense } from "react";

function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center">Loading Chat...</div>}>
      <Chat />
    </Suspense>
  );
}

export default ChatPage;
