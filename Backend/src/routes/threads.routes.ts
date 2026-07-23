import { Router } from "express";
import {
  createThread,
  listCategories,
  parseThreadListFilter,
  listThreads,
  updateThread,
} from "../modules/threads/threads.repository.js";
import { getAuth } from "../config/clerk.js";
import { UnauthorizedError, BadRequestError } from "../lib/errors.js";
import { z } from "zod";
import { getUserFromClerk } from "../modules/users/user.service.js";
import {
  listRepliesForThread,
  createReply,
  findReplyAuthorId,
  deleteReplyById,
  likeThreadOnce,
  removeLikeThreadOnce,
  getThreadDetailsWithCounts,
} from "../modules/threads/replies.repository.js";
import { createLikeNotification, createReplyNotification } from "../modules/notifications/notifications.service.js";
import { strictLimiter } from "../middlewares/rate-limiter.js";

export const threadsRouter = Router();

const createThreadSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(2000),
  categorySlug: z.string().trim().min(2).max(100),
});

const editThreadSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  body: z.string().trim().min(10).max(2000).optional(),
});

threadsRouter.get("/categories", async (_req, res, next) => {
  try {
    const extractListOfCategories = await listCategories();

    res.json({
      data: extractListOfCategories,
    });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/threads", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return new UnauthorizedError("User not authenticated");
    }
    const profile = await getUserFromClerk(auth.userId);
    const paresedBody = createThreadSchema.parse(req.body);

    const newlyCreatedThread = await createThread({
      categorySlug: paresedBody.categorySlug,
      authorUserId: String(profile.user.id),
      body: paresedBody.body,
      title: paresedBody.title,
    });
    res.status(201).json({ data: newlyCreatedThread });
  } catch (error) {
    next(error);
  }
});

// Edit thread (author only)
threadsRouter.patch("/threads/:threadId", strictLimiter, async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }
    const profile = await getUserFromClerk(auth.userId);
    const parsed = editThreadSchema.parse(req.body);

    const updated = await updateThread({
      threadId,
      authorUserId: profile.user.id,
      title: parsed.title,
      body: parsed.body,
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/threads/:threadId", async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const profile = await getUserFromClerk(auth.userId);
    const viewerUserId = profile.user.id;

    const thread = await getThreadDetailsWithCounts({
      threadId,
      viewerUserId,
    });

    res.json({ data: thread });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/threads", async (req, res, next) => {
  try {
    const filter = await parseThreadListFilter({
      page: req.query.page,
      pageSize: req.query.pageSize,
      category: req.query.category,
      q: req.query.q,
      sort: req.query.sort,
    });

    const extractListOfThreads = await listThreads(filter);
    res.json({ data: extractListOfThreads });
  } catch (error) {
    next(error);
  }
});

// replies and likes end points

threadsRouter.get("/threads/:threadId/replies", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }
    const replies = await listRepliesForThread(threadId);
    res.json({ data: replies });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/threads/:threadId/replies", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }

    const bodyRaw = typeof req.body?.body === "string" ? req.body.body : "";
    if (bodyRaw.trim().length < 1) {
      throw new BadRequestError("Reply body must be at least 1 character long");
    }

    const profile = await getUserFromClerk(auth.userId);

    const reply = await createReply({
      threadId,
      authorId: profile.user.id,
      body: bodyRaw,
    });

    // notification -> triger here bbut later
    await createReplyNotification({
      threadId,
      actorUserId: profile.user.id,
    });


    res.status(201).json({ data: reply });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/replies/:replyId", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const replyId = Number(req.params.replyId);
    if (!Number.isInteger(replyId) || replyId <= 0) {
      throw new BadRequestError("Invalid reply ID");
    }

    const profile = await getUserFromClerk(auth.userId);

    const authorId = await findReplyAuthorId(replyId);

    if (authorId !== profile.user.id) {
      throw new UnauthorizedError(
        "You are not authorized to delete this reply",
      );
    }

    await deleteReplyById(replyId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/threads/:threadId/like", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }

    const profile = await getUserFromClerk(auth.userId);

    await likeThreadOnce({
      threadId,
      userId: profile.user.id,
    });

    // notification -> triger here bbut later
    await createLikeNotification({
      threadId,
      actorUserId: profile.user.id,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/threads/:threadId/like", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }

    const profile = await getUserFromClerk(auth.userId);

    await removeLikeThreadOnce({
      threadId,
      userId: profile.user.id,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
