import { Router } from "express";
import { getAuth } from "../config/clerk.js";
import { UnauthorizedError, BadRequestError } from "../lib/errors.js";
import { getUserFromClerk } from "../modules/users/user.service.js";
import { z } from "zod";
import {
  createRoom,
  listRoomsForUser,
  listAllRooms,
  listRoomMembers,
  joinRoom,
  leaveRoom,
  removeMemberFromRoom,
  listRoomMessages,
  isRoomMember,
} from "../modules/chat/group-chat.service.js";

export const groupChatRouter = Router();

const createRoomSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

// Create a room
groupChatRouter.post("/rooms", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const profile = await getUserFromClerk(auth.userId);
    const parsed = createRoomSchema.parse(req.body);

    const room = await createRoom(parsed.name, profile.user.id);
    res.status(201).json({ data: room });
  } catch (error) {
    next(error);
  }
});

// List rooms the current user belongs to
groupChatRouter.get("/rooms", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const profile = await getUserFromClerk(auth.userId);
    const rooms = await listRoomsForUser(profile.user.id);
    res.json({ data: rooms });
  } catch (error) {
    next(error);
  }
});

// List ALL rooms (for browse & join)
groupChatRouter.get("/rooms/browse", async (_req, res, next) => {
  try {
    const rooms = await listAllRooms();
    res.json({ data: rooms });
  } catch (error) {
    next(error);
  }
});

// Get room members
groupChatRouter.get("/rooms/:roomId/members", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0)
      throw new BadRequestError("Invalid room ID");

    const members = await listRoomMembers(roomId);
    res.json({ data: members });
  } catch (error) {
    next(error);
  }
});

// Join a room (anyone can join)
groupChatRouter.post("/rooms/:roomId/join", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const profile = await getUserFromClerk(auth.userId);
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0)
      throw new BadRequestError("Invalid room ID");

    await joinRoom(roomId, profile.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Leave a room
groupChatRouter.post("/rooms/:roomId/leave", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const profile = await getUserFromClerk(auth.userId);
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0)
      throw new BadRequestError("Invalid room ID");

    await leaveRoom(roomId, profile.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Remove member (creator only)
groupChatRouter.delete(
  "/rooms/:roomId/members/:userId",
  async (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) throw new UnauthorizedError("Not authenticated");

      const profile = await getUserFromClerk(auth.userId);
      const roomId = Number(req.params.roomId);
      const targetUserId = Number(req.params.userId);

      if (!Number.isInteger(roomId) || roomId <= 0)
        throw new BadRequestError("Invalid room ID");
      if (!Number.isInteger(targetUserId) || targetUserId <= 0)
        throw new BadRequestError("Invalid user ID");

      await removeMemberFromRoom(roomId, targetUserId, profile.user.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Get room messages
groupChatRouter.get("/rooms/:roomId/messages", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError("Not authenticated");

    const profile = await getUserFromClerk(auth.userId);
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0)
      throw new BadRequestError("Invalid room ID");

    // Check membership
    const isMember = await isRoomMember(roomId, profile.user.id);
    if (!isMember) throw new UnauthorizedError("Not a member of this room");

    const limit = Number(req.query.limit) || 100;
    const messages = await listRoomMessages(roomId, limit);
    res.json({ data: messages });
  } catch (error) {
    next(error);
  }
});
