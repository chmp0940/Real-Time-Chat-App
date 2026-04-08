import 'dotenv/config';
import { z } from 'zod';


const EnvSchema=z.object({
  PORT:z.string().default('5000'),
  DB_Host:z.string().default('localhost'),
  DB_Port:z.string().default('6450'),
  DB_User:z.string().default('postgres'),
  DB_Password:z.string().default('postgres'),
  DB_Name:z.string().default('realtime_chat_app_and_threads_app'),
  CLERK_PUBLISHABLE_KEY:z.string(),
  CLERK_SECRET_KEY:z.string(),
})

const parsed=EnvSchema.safeParse(process.env);

if(!parsed.success){
  console.error('Invalid environment variables',parsed.error.format());
  process.exit(1);
}

export const env=parsed.data; 