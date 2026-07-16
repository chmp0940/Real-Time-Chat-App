import express from 'express';
import cors from 'cors'
import helmet from 'helmet';
import { notFounderHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';
import {clerkMiddleware} from "./config/clerk.js"
import { apiRouter } from './routes/index.js';
import { env } from './config/env.js';


export function createApp()
{
  const app=express();

  app.use(clerkMiddleware());

  app.use(helmet());
  app.use(
    cors({
      origin:[env.FRONTEND_URL],
      credentials:true
    })
  )

  app.use(express.json());

app.use('/api',apiRouter);

  app.use(notFounderHandler);
  app.use(errorHandler);

  return app;
}