import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getUserFromClerk } from "../modules/users/user.service.js";
import { sendDirectMessage, editDirectMessage, softDeleteDirectMessage, markConversationAsRead } from "../modules/chat/chat.service.js";
import { listRoomsForUser, sendRoomMessage, isRoomMember, editRoomMessage, softDeleteRoomMessage } from "../modules/chat/group-chat.service.js";
import { env } from "../config/env.js";

// HTTP server gives normal API routes.
// Socket.IO sits on top of that HTTP server for real-time events.
// When client connects, backend verifies user, puts user into a personal room, and updates online presence list.
let io: Server | null = null;

const onlineUsers = new Map<number, Set<String>>();

function addOnlineUser(rawUserId: unknown, socketId: String) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) {
    console.error("Invalid user ID");
    return;
  }

  const existing = onlineUsers.get(userId);

  if (existing) {
    existing.add(socketId);
  } else {
    onlineUsers.set(userId, new Set([socketId]));
  }
}

function removeOnlineUser(rawUserId: unknown, socketId: String) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) {
    console.error("Invalid user ID");
    return;
  }

  const existing = onlineUsers.get(userId);

  if (!existing) {
    return;
  }

  existing.delete(socketId);

  if (existing.size === 0) {
    onlineUsers.delete(userId);
  }
}

function getOnlineUsersIds(): number[] {
  return Array.from(onlineUsers.keys());
}

function broadCastPresence() {
  io?.emit("presence:update", {
    onlineUserIds: getOnlineUsersIds(),
  });
}

export function initIo(httpServer: HttpServer) {
  if (io) return io; // sagefuared only create once

  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    console.log(`[io connection]--------> ${socket.id} connected`);

    try {
      // doing first authenction check with clerk userId from socket handshake auth
      const clerkUserId = socket.handshake.auth?.userId;

      if (!clerkUserId || typeof clerkUserId !== "string") {
        console.log(`[Missing clerkUserId]--------> ${socket.id} `);
        socket.disconnect(true);
        return;
      }

      const profile = await getUserFromClerk(clerkUserId);
      const rawLocalUserId = profile?.user?.id;
      const localUserId = Number(rawLocalUserId);

      const displayName = profile?.user?.displayName ?? null;
      const handle = profile?.user?.handle ?? null;

      if (!Number.isFinite(localUserId) || localUserId <= 0) {
        console.log(`[Invalid userId]--------> ${socket.id} `);
        socket.disconnect(true);
        return;
      }

      (socket.data as {
        userId: number;
        displayName: string | null;
        handle: string | null;
      }) = {
        userId: localUserId,
        displayName: displayName,
        handle: handle,
      };
      // storing userId in socket.data for future reference

      // JOIin noti room
      const notiRoom = `notifications:user:${localUserId}`;
      socket.join(notiRoom);

      // join Dm room (create room)
      const dmRoom = `dm:user:${localUserId}`;
      socket.join(dmRoom);

      socket.on("dm:send", async (payload: unknown) => {
        try {
          const data = payload as {
            receipientUserId: number;
            body: string | null;
            imageUrl?: string | null;
          };
          const senderUserId = (socket.data as { userId: number }).userId;

          if (!senderUserId) return;
          const receipientUserId = Number(data.receipientUserId);

          if (!Number.isFinite(receipientUserId) || receipientUserId <= 0) {
            console.log(`[Invalid receipientUserId]--------> ${socket.id} `);
            return;
          }
          // no self dm
          if (senderUserId === receipientUserId) {
            console.log(`[Self DM not allowed]--------> ${socket.id} `);
            return;
          }

          console.log(
            `[dm:send]--------> ${socket.id} sending dm to ${receipientUserId} `,
          );

          const message = await sendDirectMessage({
            senderUserId,
            receipientUserId,
            body: data.body ?? null,
            imageUrl: data.imageUrl ?? null,
          });

          const senderRoom = `dm:user:${senderUserId}`;
          const receipientRoom = `dm:user:${receipientUserId}`;

          io?.to(senderRoom).to(receipientRoom).emit("dm:message", message);
        } catch (err) {
          console.log(`[Error while sending dm]--------> ${err} `);
        }
      });

      socket.on("dm:typing", (payload: unknown) => {
        const data = payload as {
          receipientUserId: number;
          isTyping: boolean;
        };
        const senderUserId = (socket.data as { userId?: number }).userId;

        if (!senderUserId) return;
        const receipientUserId = Number(data.receipientUserId);

        if (!Number.isFinite(receipientUserId) || receipientUserId <= 0) {
          console.log(`[Invalid receipientUserId]--------> ${socket.id} `);
          return;
        }

        const receipientRoom = `dm:user:${receipientUserId}`;
        io?.to(receipientRoom).emit("dm:typing", {
          senderUserId,
          receipientUserId,
          isTyping: !!data.isTyping,
        });
      });

      // ── DM: edit message ──
      socket.on("dm:edit", async (payload: unknown) => {
        try {
          const data = payload as { messageId: number; newBody: string };
          const senderUserId = (socket.data as { userId: number }).userId;
          if (!senderUserId) return;

          const result = await editDirectMessage({
            messageId: Number(data.messageId),
            senderUserId,
            newBody: data.newBody,
          });

          // Broadcast edit to both users
          const senderRoom = `dm:user:${senderUserId}`;
          io?.to(senderRoom).emit("dm:edit", result);
          // Also need to find the recipient — we broadcast to all dm rooms
          // since the frontend filters by conversation
          io?.emit("dm:edit", result);
        } catch (err) {
          console.log(`[Error dm:edit] ${err}`);
        }
      });

      // ── DM: delete message ──
      socket.on("dm:delete", async (payload: unknown) => {
        try {
          const data = payload as { messageId: number };
          const senderUserId = (socket.data as { userId: number }).userId;
          if (!senderUserId) return;

          const result = await softDeleteDirectMessage({
            messageId: Number(data.messageId),
            senderUserId,
          });

          io?.emit("dm:delete", result);
        } catch (err) {
          console.log(`[Error dm:delete] ${err}`);
        }
      });

      // ── DM: read receipt ──
      socket.on("dm:read", async (payload: unknown) => {
        try {
          const data = payload as { otherUserId: number; lastReadMsgId: number };
          const ownerUserId = (socket.data as { userId: number }).userId;
          if (!ownerUserId) return;

          await markConversationAsRead({
            ownerUserId,
            otherUserId: Number(data.otherUserId),
            lastReadMsgId: Number(data.lastReadMsgId),
          });

          // Notify the other user that their messages have been read
          const otherRoom = `dm:user:${Number(data.otherUserId)}`;
          io?.to(otherRoom).emit("dm:read", {
            readerUserId: ownerUserId,
            lastReadMsgId: Number(data.lastReadMsgId),
          });
        } catch (err) {
          console.log(`[Error dm:read] ${err}`);
        }
      });

      // ── Group chat: auto-join all rooms the user belongs to ──
      try {
        const userRooms = await listRoomsForUser(localUserId);
        for (const room of userRooms) {
          socket.join(`room:${room.id}`);
        }
        console.log(`[io] User ${localUserId} joined ${userRooms.length} group rooms`);
      } catch (err) {
        console.log(`[Error loading user rooms] ${err}`);
      }

      // ── Group chat: join a room dynamically (after creating/joining via API) ──
      socket.on("room:join", (payload: unknown) => {
        const data = payload as { roomId: number };
        const roomId = Number(data.roomId);
        if (!Number.isFinite(roomId) || roomId <= 0) return;
        socket.join(`room:${roomId}`);
        console.log(`[room:join] User ${localUserId} joined room:${roomId}`);
      });

      // ── Group chat: send message ──
      socket.on("room:send", async (payload: unknown) => {
        try {
          const data = payload as {
            roomId: number;
            body: string | null;
            imageUrl?: string | null;
          };
          const senderUserId = (socket.data as { userId: number }).userId;
          if (!senderUserId) return;

          const roomId = Number(data.roomId);
          if (!Number.isFinite(roomId) || roomId <= 0) return;

          // Verify membership
          const isMember = await isRoomMember(roomId, senderUserId);
          if (!isMember) return;

          const message = await sendRoomMessage({
            roomId,
            senderUserId,
            body: data.body ?? null,
            imageUrl: data.imageUrl ?? null,
          });

          io?.to(`room:${roomId}`).emit("room:message", message);
        } catch (err) {
          console.log(`[Error room:send] ${err}`);
        }
      });

      // ── Group chat: typing ──
      socket.on("room:typing", (payload: unknown) => {
        const data = payload as {
          roomId: number;
          isTyping: boolean;
        };
        const senderUserId = (socket.data as { userId?: number }).userId;
        if (!senderUserId) return;

        const roomId = Number(data.roomId);
        if (!Number.isFinite(roomId) || roomId <= 0) return;

        // Broadcast to room except sender
        socket.to(`room:${roomId}`).emit("room:typing", {
          roomId,
          senderUserId,
          isTyping: !!data.isTyping,
        });
      });

      // ── Group chat: edit message ──
      socket.on("room:edit", async (payload: unknown) => {
        try {
          const data = payload as { messageId: number; newBody: string };
          const senderUserId = (socket.data as { userId: number }).userId;
          if (!senderUserId) return;

          const result = await editRoomMessage({
            messageId: Number(data.messageId),
            senderUserId,
            newBody: data.newBody,
          });

          io?.to(`room:${result.roomId}`).emit("room:edit", result);
        } catch (err) {
          console.log(`[Error room:edit] ${err}`);
        }
      });

      // ── Group chat: delete message ──
      socket.on("room:delete", async (payload: unknown) => {
        try {
          const data = payload as { messageId: number };
          const senderUserId = (socket.data as { userId: number }).userId;
          if (!senderUserId) return;

          const result = await softDeleteRoomMessage({
            messageId: Number(data.messageId),
            senderUserId,
          });

          io?.to(`room:${result.roomId}`).emit("room:delete", result);
        } catch (err) {
          console.log(`[Error room:delete] ${err}`);
        }
      });

      addOnlineUser(localUserId, socket.id);
      broadCastPresence();

      socket.on("disconnect", () => {
        removeOnlineUser(localUserId, socket.id);
        broadCastPresence();
      });
    } catch (err) {
      console.log(`[Error while socket Connection]--------> ${err} `);
      socket.disconnect(true);
    }
  });
}
export function getIo() {
  return io;
}
