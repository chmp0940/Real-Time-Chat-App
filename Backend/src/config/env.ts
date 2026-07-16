import 'dotenv/config';
import { z } from 'zod';


const EnvSchema=z.object({
  PORT:z.string().default('5000'),
  NODE_ENV:z.string().default('development'),

  // Hosted databases (Neon, Supabase, etc.) provide a single connection string.
  // When DATABASE_URL is set, it takes priority over individual DB_* variables.
  DATABASE_URL:z.string().optional(),

  // Individual DB vars — used for local development with Docker Postgres
  DB_Host:z.string().default('localhost'),
  DB_Port:z.string().default('6450'),
  DB_User:z.string().default('postgres'),
  DB_Password:z.string().default('postgres'),
  DB_Name:z.string().default('realtime_chat_app_and_threads_app'),

  // Clerk authentication
  CLERK_PUBLISHABLE_KEY:z.string(),
  CLERK_SECRET_KEY:z.string(),

  // Cloudinary for image uploads
  CLOUDINARY_CLOUD_NAME:z.string(),
  CLOUDINARY_API_KEY:z.string(),
  CLOUDINARY_API_SECRET:z.string(),

  // Frontend URL — used for CORS (allows the frontend to call the backend)
  FRONTEND_URL:z.string().default('http://localhost:4000'),
})

const parsed=EnvSchema.safeParse(process.env);

if(!parsed.success){
  console.error('Invalid environment variables',parsed.error.format());
  process.exit(1);
}

export const env=parsed.data; 