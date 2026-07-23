"use client";
import { type Socket } from "socket.io-client";
import {
  ChatUser,
  DirectMessage,
  RawDirectMessage,
  mapDirectMessagesResponse,
  mapDirectMessage,
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
import { Check, CheckCheck, Edit3, Send, Trash2, Wifi, WifiOff, X } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { toast } from "sonner";
import ImageUploadButton from "./image-upload-button";

type DirectChatPanelProps = {
  otherUserId: number;
  currentUserId: number;
  otherUser: ChatUser | null;
  socket: Socket | null;
  connected: boolean;
};

function DirectChatPanel(props: DirectChatPanelProps) {
  const { otherUser, otherUserId, currentUserId, socket, connected } = props;
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Read receipts
  const [theirReadCursor, setTheirReadCursor] = useState<number | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages + read cursor
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const [res, cursorRes] = await Promise.all([
          apiGet<DirectMessage[]>(
            apiClient,
            `/api/chat/conversations/${otherUserId}/messages`,
            { params: { limit: 100 } },
          ),
          apiGet<{ lastReadMsgId: number | null }>(
            apiClient,
            `/api/chat/conversations/${otherUserId}/read-cursor`,
          ),
        ]);

        if (!isMounted) return;
        setMessages(mapDirectMessagesResponse(res));
        setTheirReadCursor(cursorRes?.lastReadMsgId ?? null);
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [apiClient, otherUserId]);

  // Mark as read when messages change or conversation opens
  useEffect(() => {
    if (!socket || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderUserId === otherUserId) {
      socket.emit("dm:read", {
        otherUserId,
        lastReadMsgId: lastMsg.id,
      });
    }
  }, [socket, messages, otherUserId]);

  useEffect(() => {
    if (!socket) return;

    function handleMessage(payload: RawDirectMessage) {
      const mapped = mapDirectMessage(payload);
      if (
        mapped.senderUserId !== otherUserId &&
        mapped.receipientUserId !== otherUserId
      ) {
        return;
      }

      setMessages((prev) => [...prev, mapped]);
    }
    function handleTyping(payload: {
      senderUserId: number;
      receipientUserId: number;
      isTyping: boolean;
    }) {
      const senderId = Number(payload.senderUserId);
      if (senderId !== otherUserId) return;
      if (payload.isTyping) {
        setTypingLabel("Typing...");
      } else {
        setTypingLabel(null);
      }
    }

    function handleEdit(payload: { id: number; body: string; updatedAt: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === Number(payload.id)
            ? { ...m, body: payload.body, updatedAt: payload.updatedAt }
            : m,
        ),
      );
    }

    function handleDelete(payload: { id: number; deletedAt: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === Number(payload.id)
            ? { ...m, body: null, imageUrl: null, deletedAt: payload.deletedAt }
            : m,
        ),
      );
    }

    function handleRead(payload: { readerUserId: number; lastReadMsgId: number }) {
      if (Number(payload.readerUserId) === otherUserId) {
        setTheirReadCursor(Number(payload.lastReadMsgId));
      }
    }

    socket.on("dm:message", handleMessage);
    socket.on("dm:typing", handleTyping);
    socket.on("dm:edit", handleEdit);
    socket.on("dm:delete", handleDelete);
    socket.on("dm:read", handleRead);

    return () => {
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
      socket.off("dm:edit", handleEdit);
      socket.off("dm:delete", handleDelete);
      socket.off("dm:read", handleRead);
    };
  }, [socket, otherUserId]);

  function setSendTyping(isTyping: boolean) {
    if (!socket) return;
    socket.emit("dm:typing", { receipientUserId: otherUserId, isTyping });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setInput(value);
    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setSendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      setSendTyping(false);
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
      toast("not Connected", { description: "Realtime connection is not established." });
      return;
    }
    const body = input.trim();
    if (!body && !imageUrl) return;

    setSending(true);
    try {
      socket.emit("dm:send", {
        receipientUserId: otherUserId,
        body: body || null,
        imageUrl: imageUrl || null,
      });
      setInput("");
      setImageUrl(null);
      setSendTyping(false);
    } finally {
      setSending(false);
    }
  }

  function handleEditStart(msg: DirectMessage) {
    setEditingId(msg.id);
    setEditText(msg.body ?? "");
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditText("");
  }

  function handleEditSave() {
    if (!socket || !editingId || !editText.trim()) return;
    socket.emit("dm:edit", { messageId: editingId, newBody: editText.trim() });
    setEditingId(null);
    setEditText("");
  }

  function handleDeleteMsg(msgId: number) {
    if (!socket) return;
    socket.emit("dm:delete", { messageId: msgId });
  }

  const title =
    otherUser?.handle && otherUser?.handle !== ""
      ? `@${otherUser?.handle}`
      : (otherUser?.displayName ?? "Conversation");

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-3">
        <div>
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Direct message conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${
              connected
                ? "bg-primary/10 text-primary"
                : "bg-accent text-accent-foreground"
            }`}
          >
            {connected ? (
              <><Wifi className="w-3 h-3" /> Online</>
            ) : (
              <><WifiOff className="w-3 h-3" /> Offline</>
            )}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto bg-background/60 p-4 chat-scroll">
        {/* Skeleton loaders */}
        {isLoading && (
          <div className="space-y-4 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs space-y-2 ${i % 2 === 0 ? "items-end" : ""}`}>
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
              <Send className="h-6 w-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground/70">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Send the first message to start the conversation
            </p>
          </div>
        )}

        {!isLoading &&
          messages.map((msg, idx) => {
            const isMe = msg.senderUserId === currentUserId;
            const label = isMe ? "You" : title;
            const isDeleted = !!(msg as any).deletedAt;
            const isEdited = !!(msg as any).updatedAt;
            const isBeingEdited = editingId === msg.id;

            const time = new Date(msg.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Read receipt: show on last sent message that the other user has read
            const isLastSentByMe =
              isMe &&
              !isDeleted &&
              idx === [...messages].reverse().findIndex((m) => m.senderUserId === currentUserId)
                ? false
                : isMe && messages.slice(idx + 1).every((m) => m.senderUserId !== currentUserId);
            const isSeen = isMe && theirReadCursor !== null && msg.id <= theirReadCursor;

            return (
              <div
                className={`msg-enter group/msg flex gap-2 text-xs ${isMe ? "justify-end" : "justify-start"}`}
                key={msg.id}
              >
                <div className={`max-w-xs ${isMe ? "order-2" : ""}`}>
                  <div
                    className={`mb-1 flex items-center gap-1.5 text-[12px] font-medium ${
                      isMe ? "text-muted-foreground justify-end" : "text-muted-foreground"
                    }`}
                  >
                    {label} · {time}
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
                            className={`inline-block rounded-2xl px-3.5 py-2.5 transition-colors duration-150
                            ${isMe
                              ? "rounded-br-sm bg-primary/80 text-primary-foreground"
                              : "rounded-bl-sm bg-accent text-accent-foreground"
                            }`}
                          >
                            <p className="wrap-break-word text-[14px] leading-relaxed">{msg.body}</p>
                          </div>
                          {/* Edit/Delete actions on hover (own messages only) */}
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

                  {/* Read receipt indicator */}
                  {isMe && !isDeleted && isLastSentByMe && (
                    <div className={`mt-0.5 flex justify-end`}>
                      <span className={`read-receipt ${isSeen ? "seen" : "delivered"}`} title={isSeen ? "Seen" : "Delivered"}>
                        <CheckCheck className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* Typing indicator with bouncing dots */}
        {typingLabel && (
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
            <span className="text-[11px] text-muted-foreground">
              Cloudinary Image Upload
            </span>
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

export default DirectChatPanel;
