"use client";
import { type Socket } from "socket.io-client";
import {
  RoomMessage,
  RawRoomMessage,
  mapRoomMessage,
  mapRoomMessagesResponse,
  RoomMember,
} from "../../types/chat";
import { useAuth } from "@clerk/nextjs";
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiGet, createApiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Check, Edit3, Send, Trash2, Users, Wifi, WifiOff, X } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { toast } from "sonner";
import ImageUploadButton from "./image-upload-button";

type GroupChatPanelProps = {
  roomId: number;
  roomName: string;
  currentUserId: number;
  socket: Socket | null;
  connected: boolean;
};

function GroupChatPanel(props: GroupChatPanelProps) {
  const { roomId, roomName, currentUserId, socket, connected } = props;
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages + members
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const [msgRes, memberRes] = await Promise.all([
          apiGet<RoomMessage[]>(apiClient, `/api/group-chat/rooms/${roomId}/messages`, {
            params: { limit: 100 },
          }),
          apiGet<RoomMember[]>(apiClient, `/api/group-chat/rooms/${roomId}/members`),
        ]);
        if (!isMounted) return;
        setMessages(mapRoomMessagesResponse(msgRes));
        setMembers(Array.isArray(memberRes) ? memberRes : (memberRes as any)?.data ?? []);
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [apiClient, roomId]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    function handleMessage(payload: RawRoomMessage) {
      const mapped = mapRoomMessage(payload);
      if (mapped.roomId !== roomId) return;
      setMessages((prev) => [...prev, mapped]);
    }

    function handleTyping(payload: {
      roomId: number;
      senderUserId: number;
      isTyping: boolean;
    }) {
      if (payload.roomId !== roomId) return;
      if (payload.senderUserId === currentUserId) return;

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (payload.isTyping) {
          next.add(payload.senderUserId);
        } else {
          next.delete(payload.senderUserId);
        }
        return next;
      });

      const existingTimeout = typingTimeoutsRef.current.get(payload.senderUserId);
      if (existingTimeout) clearTimeout(existingTimeout);
      if (payload.isTyping) {
        typingTimeoutsRef.current.set(
          payload.senderUserId,
          setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(payload.senderUserId);
              return next;
            });
          }, 3000)
        );
      }
    }

    function handleEdit(payload: { id: number; roomId: number; body: string; updatedAt: string }) {
      if (payload.roomId !== roomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === Number(payload.id)
            ? { ...m, body: payload.body, updatedAt: payload.updatedAt }
            : m,
        ),
      );
    }

    function handleDelete(payload: { id: number; roomId: number; deletedAt: string }) {
      if (payload.roomId !== roomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === Number(payload.id)
            ? { ...m, body: null, imageUrl: null, deletedAt: payload.deletedAt }
            : m,
        ),
      );
    }

    socket.on("room:message", handleMessage);
    socket.on("room:typing", handleTyping);
    socket.on("room:edit", handleEdit);
    socket.on("room:delete", handleDelete);

    return () => {
      socket.off("room:message", handleMessage);
      socket.off("room:typing", handleTyping);
      socket.off("room:edit", handleEdit);
      socket.off("room:delete", handleDelete);
    };
  }, [socket, roomId, currentUserId]);

  function emitTyping(isTyping: boolean) {
    if (!socket) return;
    socket.emit("room:typing", { roomId, isTyping });
  }

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    if (!socket || !connected) {
      toast("Not Connected", { description: "Realtime connection is not established." });
      return;
    }
    const body = input.trim();
    if (!body && !imageUrl) return;

    setSending(true);
    try {
      socket.emit("room:send", {
        roomId,
        body: body || null,
        imageUrl: imageUrl || null,
      });
      setInput("");
      setImageUrl(null);
      emitTyping(false);
    } finally {
      setSending(false);
    }
  }

  function handleEditStart(msg: RoomMessage) {
    setEditingId(msg.id);
    setEditText(msg.body ?? "");
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditText("");
  }

  function handleEditSave() {
    if (!socket || !editingId || !editText.trim()) return;
    socket.emit("room:edit", { messageId: editingId, newBody: editText.trim() });
    setEditingId(null);
    setEditText("");
  }

  function handleDeleteMsg(msgId: number) {
    if (!socket) return;
    socket.emit("room:delete", { messageId: msgId });
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-3">
        <div>
          <CardTitle className="text-base text-foreground">{roomName}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowMembers(!showMembers)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Users className="mr-1 h-3.5 w-3.5" />
            {members.length}
          </Button>
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${
              connected
                ? "bg-primary/10 text-primary"
                : "bg-accent text-accent-foreground"
            }`}
          >
            {connected ? (
              <><Wifi className="w-3 h-3" /> Live</>
            ) : (
              <><WifiOff className="w-3 h-3" /> Offline</>
            )}
          </span>
        </div>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Members sidebar */}
        {showMembers && (
          <div className="w-48 shrink-0 border-r border-border bg-background/40 p-3 overflow-y-auto chat-scroll">
            <p className="mb-2 text-xs font-semibold text-foreground">Members</p>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                    {(m.handle?.[0] ?? m.displayName?.[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="truncate">
                    {m.handle ? `@${m.handle}` : m.displayName ?? "User"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <CardContent className="flex-1 space-y-3 overflow-y-auto bg-background/60 p-4 chat-scroll">
          {isLoading && (
            <div className="space-y-4 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-24" />
                    <div className={`skeleton h-10 ${i % 2 === 0 ? "w-40" : "w-52"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground/70">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Start the group conversation!</p>
            </div>
          )}

          {!isLoading &&
            messages.map((msg) => {
              const isMe = msg.senderUserId === currentUserId;
              const senderLabel = msg.sender.handle
                ? `@${msg.sender.handle}`
                : msg.sender.displayName ?? "User";
              const isDeleted = !!(msg as any).deletedAt;
              const isEdited = !!(msg as any).updatedAt;
              const isBeingEdited = editingId === msg.id;

              const time = new Date(msg.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  className={`msg-enter group/msg flex gap-2 text-xs ${isMe ? "justify-end" : "justify-start"}`}
                  key={msg.id}
                >
                  <div className={`max-w-xs ${isMe ? "order-2" : ""}`}>
                    <div
                      className={`mb-1 flex items-center gap-1.5 text-[12px] font-medium ${
                        isMe ? "text-muted-foreground text-right justify-end" : "text-muted-foreground"
                      }`}
                    >
                      {isMe ? "You" : senderLabel} · {time}
                      {isEdited && !isDeleted && (
                        <span className="edited-label">(edited)</span>
                      )}
                    </div>

                    {isDeleted ? (
                      <div className="inline-block rounded-2xl px-3.5 py-2.5 bg-muted/30 border border-border/50">
                        <p className="text-[13px] italic text-muted-foreground/50">
                          This message was deleted
                        </p>
                      </div>
                    ) : isBeingEdited ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-10 resize-none border-primary/30 bg-background text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                            if (e.key === "Escape") handleEditCancel();
                          }}
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={handleEditCancel} className="h-6 px-2 text-xs">
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                          <Button size="sm" onClick={handleEditSave} className="h-6 px-2 text-xs bg-primary text-primary-foreground">
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg?.body && (
                          <div className="relative">
                            <div
                              className={`inline-block rounded-2xl px-3.5 py-2.5 transition-colors duration-150 ${
                                isMe
                                  ? "rounded-br-sm bg-primary/80 text-primary-foreground"
                                  : "rounded-bl-sm bg-accent text-accent-foreground"
                              }`}
                            >
                              <p className="wrap-break-word text-[14px] leading-relaxed">{msg.body}</p>
                            </div>
                            {isMe && (
                              <div className="msg-actions-enter absolute -top-6 right-0 hidden group-hover/msg:flex items-center gap-0.5 rounded-lg bg-card border border-border shadow-md px-1 py-0.5">
                                <button
                                  onClick={() => handleEditStart(msg)}
                                  className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMsg(msg.id)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {msg?.imageUrl && (
                          <div className="mt-2 overflow-hidden rounded-lg border border-border">
                            <img src={msg.imageUrl} alt="attachment" className="max-h-52 max-w-xs rounded-lg object-cover" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

          {typingUsers.size > 0 && (
            <div className="msg-enter flex justify-start gap-2 text-xs">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-accent px-4 py-3">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messageEndRef} />
        </CardContent>
      </div>

      {/* Input area */}
      <div className="space-y-3 border-t border-border bg-card p-5">
        {imageUrl && (
          <div className="rounded-lg border border-border bg-background/70 p-2">
            <p className="text-[12px] text-muted-foreground mb-2">Image ready to send:</p>
            <img src={imageUrl} alt="pending" className="max-h-32 rounded-lg border border-border object-contain" />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <ImageUploadButton onImageUpload={(url) => setImageUrl(url)} />
            <span className="text-[11px] text-muted-foreground">Cloudinary Image Upload</span>
          </div>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!connected || sending}
              className="min-h-14 resize-none border-border bg-background text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sending || !connected || (!input.trim() && !imageUrl)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default GroupChatPanel;
