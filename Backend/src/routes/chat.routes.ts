import { Router } from "express";
import { getAuth } from "../config/clerk.js";
import { getUserFromClerk } from "../modules/users/user.service.js";
import {
  listChatUsers,
  listDirectMessages,
  markConversationAsRead,
  getReadCursor,
  getUnreadCountsForUser,
} from "../modules/chat/chat.service.js";
import { strictLimiter } from "../middlewares/rate-limiter.js";

export const chatRouter = Router();

chatRouter.get("/users", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await getUserFromClerk(auth.userId);
    const currentUserId = profile?.user.id as number;

    const users = await listChatUsers(currentUserId);
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

chatRouter.get("/conversations/:otherUserId/messages",
  async (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await getUserFromClerk(auth.userId);
      const currentUserId = profile?.user.id as number;

      const rawOtherId = req.params.otherUserId;
      const otherUserId = Number(rawOtherId);
      const limitParam = req.query.limit;
      const limit =
        typeof limitParam === "string" ? parseInt(limitParam, 10) : 50;

      const messages = await listDirectMessages({
        userId: currentUserId,
        otherUserId,
        limit: limit || 50,
      });
      res.json({ data: messages });
    } catch (err) {
      next(err);
    }
  },
);

// Mark conversation as read (read receipts)
chatRouter.post("/conversations/:otherUserId/read", strictLimiter, async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = await getUserFromClerk(auth.userId);
    const currentUserId = profile?.user.id as number;
    const otherUserId = Number(req.params.otherUserId);
    const lastReadMsgId = Number(req.body.lastReadMsgId);

    if (!Number.isFinite(otherUserId) || otherUserId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    if (!Number.isFinite(lastReadMsgId) || lastReadMsgId <= 0) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    await markConversationAsRead({
      ownerUserId: currentUserId,
      otherUserId,
      lastReadMsgId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Get read cursor for a conversation
chatRouter.get("/conversations/:otherUserId/read-cursor", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = await getUserFromClerk(auth.userId);
    const currentUserId = profile?.user.id as number;
    const otherUserId = Number(req.params.otherUserId);

    const lastReadMsgId = await getReadCursor(otherUserId, currentUserId);
    res.json({ data: { lastReadMsgId } });
  } catch (err) {
    next(err);
  }
});

// Get unread counts for all conversations
chatRouter.get("/unread-counts", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = await getUserFromClerk(auth.userId);
    const currentUserId = profile?.user.id as number;

    const counts = await getUnreadCountsForUser(currentUserId);
    res.json({ data: counts });
  } catch (err) {
    next(err);
  }
});
