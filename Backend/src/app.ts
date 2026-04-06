import express from 'express';
import cors from 'cors'
import helmet from 'helmet';
import { notFounderHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp()
{
  const app=express();

  app.use(helmet());
  app.use(
    cors({
      origin:["http://localhost:4000"],
      credentials:true
    })
  )

  app.use(express.json());

  app.use(notFounderHandler);
  app.use(errorHandler);

  return app;
}