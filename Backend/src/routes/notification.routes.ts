import { Router } from "express";
import { getAuth } from "../config/clerk.js";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { getUserFromClerk } from "../modules/users/user.service.js";
import {
  listNotificationsForUser,
  markNotificationAsRead,
} from "../modules/notifications/notifications.service.js";


export const notificationRouter = Router();

// get unreadonly=true|false
// api/notifications?unread_only=true|false

// mounted at /api/notifications -> handle GET /api/notifications
notificationRouter.get("/", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Please Sign In");
    }

    const profile = await getUserFromClerk(auth.userId);
    if (!profile) {
      throw new UnauthorizedError("Please Sign In");
    }

    const isUnreadOnly = req.query.unread_only === "true";

    const notifications = await listNotificationsForUser({
      userId: profile.user.id,
      unreadOnly: isUnreadOnly,
    });

    res.json({ data: notifications });
  } catch (err) {
    next(err);
  }
});

// to read certain notification only
// post  /api/notifications/:id
notificationRouter.post("/:id/read", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Please Sign In");
    }

    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      throw new BadRequestError("Invalid notification ID");
    }

    const profile = await getUserFromClerk(auth.userId);
    if (!profile) {
      throw new UnauthorizedError("Please Sign In");
    }

    await markNotificationAsRead({
      userId: profile.user.id,
      notificationId: notificationId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// post/api/notification/read-all
