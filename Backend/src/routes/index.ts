import {Router} from 'express'
import { userRouter } from './user.routes.js';

export const apiRouter=Router();

apiRouter.use("/me",userRouter);