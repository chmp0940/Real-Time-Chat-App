import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let message = "Internal Server Error";
  let details: unknown = undefined;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    message = "Validation Error";
    details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  logger.error(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  // Log full error stack for debugging
  if (err && (err as any).stack) {
    logger.error((err as any).stack);
  } else {
    logger.error(String(err));
  }
  res.status(status).json({
    error: {
      message,
      status,
      details,
    },
  });
};
