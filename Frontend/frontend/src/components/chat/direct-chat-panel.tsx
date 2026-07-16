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
import { title } from "process";
import { Send, Wifi, WifiOff } from "lucide-react";
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

  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await apiGet<DirectMessage[]>(
          apiClient,
          `/api/chat/conversations/${otherUserId}/messages`,
          {
            params: { limit: 100 },
          },
        );

        if (!isMounted) return;
        console.log(res, "directChat");
        setMessages(mapDirectMessagesResponse(res));
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

    socket.on("dm:message", handleMessage);
    socket.on("dm:typing", handleTyping);

    return () => {
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [socket, otherUserId]);

  function setSendTyping(isTyping: boolean) {
    if (!socket) return;

    socket.emit("dm:typing", {
      receipientUserId: otherUserId,
      isTyping,
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setInput(value);
    if (!socket) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
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
      toast("not Connected", {
        description: "Realtime connection is not established. ",
      });
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
              <>
                <Wifi className="w-3 h-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto bg-background/60 p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">Loading messages...</p>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">
              No messages yet. Start the first initiative
            </p>
          </div>
        )}

        {!isLoading &&
          messages.map((msg) => {
            console.log(msg.senderUserId, otherUserId, "otherUserId");

            const isOther = msg.senderUserId === currentUserId;
            const label = isOther ? title : "You";

            const time = new Date(msg.createdAt).toLocaleDateString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                className={`flex gap-2 text-xs ${
                  isOther ? "justify-start" : "justify-end"
                }`}
                key={msg.id}
              >
                <div className={`max-w-xs ${isOther ? "" : "order-2"}`}>
                  <div
                    className={`mb-1 text-[12px] font-medium ${
                      isOther
                        ? "text-muted-foreground"
                        : "text-muted-foreground text-right"
                    }`}
                  >
                    {label} - {time}
                  </div>

                  {msg?.body && (
                    <div
                      className={`inline-block rounded-lg px-3 py-2 transition-colors duration-150
                      ${
                        isOther
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary/80 text-primary-foreground"
                      }
                      `}
                    >
                      <p className="wrap-break-word text-[16px] leading-relaxed">
                        {msg.body}
                      </p>
                    </div>
                  )}

                  {msg?.imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-border">
                      <img
                        src={msg.imageUrl}
                        alt="attachment"
                        className="max-h-52 max-w-xs rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {typingLabel && (
          <div className="flex justify-start gap-2 text-xs">
            <div className="italic text-muted-foreground">{typingLabel}</div>
          </div>
        )}
        <div ref={messageEndRef} />
      </CardContent>

      <div className="space-y-3 border-t border-border bg-car  p-5">
        {imageUrl && (
          <div className="rounded-lg border border-border bg-background/70 p-2">
            <p className="text-[12px] text-muted-foreground mb-2">
              Image ready to send:
            </p>
            <img
              src={imageUrl}
              alt="pending"
              className="max-h-32 rounded-lg border border-border object-contain"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* image upload component  */}
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
