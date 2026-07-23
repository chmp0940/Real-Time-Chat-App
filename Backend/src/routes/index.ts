import {Router} from 'express'
import { userRouter } from './user.routes.js';
import { threadsRouter } from './threads.routes.js';
import { notificationRouter } from './notification.routes.js';
import { chatRouter } from './chat.routes.js';
import { uploadRouter } from './upload.routes.js';
import { groupChatRouter } from './group-chat.routes.js';

export const apiRouter=Router();

apiRouter.use("/me",userRouter);

apiRouter.use("/threads",threadsRouter); 

apiRouter.use("/notifications",notificationRouter);

apiRouter.use("/chat",chatRouter)
apiRouter.use("/upload",uploadRouter)
apiRouter.use("/group-chat",groupChatRouter)