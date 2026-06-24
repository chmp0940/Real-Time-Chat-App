import { Router } from "express";
import {
  createThread,
  listCategories,
  getThreadById,
  parseThreadListFilter,
  listThreads,
} from "../modules/threads/threads.repository.js";
import { getAuth } from "../config/clerk.js";
import { UnauthorizedError, BadRequestError } from "../lib/errors.js";
import { z } from "zod";
import { getUserFromClerk } from "../modules/users/user.service.js";

export const threadsRouter = Router();

const createThreadSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(2000),
  categorySlug: z.string().trim().min(2).max(100),
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

threadsRouter.post("threads", async (req, res, next) => {
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

threadsRouter.get("/threads/:threadID", async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadID);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      throw new BadRequestError("Invalid thread ID");
    }
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    // let viewerUserId:number|null=null;
    // const profile=await getUserFromClerk(auth.userId);
    // const viwerUserId=profile.user.id;

    const thread = await getThreadById(threadId);

    res.json({ data: thread });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/threads", async (req, res, next) => {
  try {
    const filter=await parseThreadListFilter({
      page: req.query.page,
      pageSize: req.query.pageSize,
      category: req.query.category,
      q: req.query.q,
      sort: req.query.sort,
    });

    const extractListOfThreads = await listThreads(filter);
    res.json({ data: extractListOfThreads });
  }
  catch (error) {
    next(error);
  }
})
