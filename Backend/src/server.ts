import { createApp } from "./app.js";
import { assertDatabaseConnection } from "./db/db.js";
import { logger } from "./lib/logger.js";
import http from 'node:http';


async function boosStrap()
{
  try {
    await assertDatabaseConnection();
    const app=createApp();
    const server=http.createServer(app);
    const port=Number(process.env.PORT) || 5000;

    server.listen(port,()=>{
      logger.info(`Server is running on port http://localhost:${port}`);
    })
  } catch (error) {
    logger.error('Error starting the server');
    logger.error(error);
    process.exit(1);
  }
}

boosStrap();