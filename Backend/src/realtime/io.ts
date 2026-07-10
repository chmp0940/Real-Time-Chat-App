import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getUserFromClerk } from "../modules/users/user.service.js";


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
  io?.emit("presence", {
    onlineUserIds: getOnlineUsersIds(),
  });
}

export function initIo(httpServer: HttpServer) {
  if (io) return io; // sagefuared only create once

  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:4000",
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

      if (!Number.isFinite(localUserId) || localUserId <= 0) {
        console.log(`[Invalid userId]--------> ${socket.id} `);
        socket.disconnect(true);
        return;
      }

      (socket.data as { userId: number }) = {
        userId: localUserId,
      };
      // storing userId in socket.data for future reference

      // JOIin noti room
      const notiRoom = `notifications:user:${localUserId}`;
      socket.join(notiRoom);

      addOnlineUser(localUserId, socket.id);
      broadCastPresence();
    } catch (err) {
      console.log(`[Error while socket Connection]--------> ${err} `);
      socket.disconnect(true);
    }
  });
}
export function getIo()
{
  return io;
}
