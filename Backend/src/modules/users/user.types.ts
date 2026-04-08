

// schema DB vs that we r going to expose to api consumer is different. we need to transform the data before sending it to the client. this file is for that transformation and also for defining the types of the data that we are going to send to the client.


export type UserRow={
  id:Number;
  clerk_user_id:string;
  display_Name:string|null;
  handle:string|null;
  avatar_url:string|null;
  bio:string|null;
  created_at:Date;
  updated_at:Date;
}

export type User={
  id:Number;
  clerkUserId:string;
  displayName:string|null;
  handle:string|null;
  avatarUrl:string|null;
  bio:string|null;
  createdAt:Date;
  updatedAt:Date;
}

export type UserProfile={
  user:User;
  clerkEmail:string|null;
  clerkFullName:string|null;
}

export type userProfileResponse={
  id:Number;
  clerkUserId:string;
  displayName:string|null;
  email:string|null;
  handle:string|null;
  avatarUrl:string|null;
  bio:string|null;
}

export function toUserProfileResponse(profile:UserProfile):userProfileResponse{
  const {user,clerkEmail,clerkFullName}=profile;

  return {
    id:user.id,
    clerkUserId:user.clerkUserId,
    displayName:user.displayName ??clerkFullName??null,
    email:clerkEmail??null,
    handle:user.handle??null,
    avatarUrl:user.avatarUrl ?? null,
    bio:user.bio??null
  };
}

// The database schema and the API response structure are different.
// This file defines the TypeScript types for user-related data returned to the client.
// It also contains transformation logic to convert database + Clerk data into a clean API response.
// Internal DB fields are filtered and only required fields are exposed to the API consumer.
// This helps maintain a clear separation between backend data models and public API responses.