import { query } from "../../db/db.js";
import { User, UserRow } from "./user.types.js";

function hydrateUser(row: UserRow): User {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertUserFromClerkProfile(params: {
  clerkUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<User> {
  const { clerkUserId, displayName, avatarUrl } = params;
  const result = await query<UserRow>(
    `INSERT INTO users(clerk_user_id, display_name, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (clerk_user_id) 
      DO UPDATE SET
        updated_at = NOW()
      RETURNING 
        id,
        clerk_user_id,
        display_name,
        handle,
        avatar_url,
        bio,
        created_at,
        updated_at
    `,
    [clerkUserId, displayName, avatarUrl],
  );
  return hydrateUser(result.rows[0]);
}

export async function repoUpdateUserProfile(params:{
  clerkUserId: string;
  displayName?: string|null;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}):Promise<User>{
  const {clerkUserId,displayName,handle,bio,avatarUrl}=params;
  const setClauses:string[]=[];
  const values:any[]=[clerkUserId];// first value is always clerkUserId for the WHERE clause
  let index=2;

  // push a column =$ index -> string ->push into setClauses
  // push the actual values int this values array

  if(typeof displayName !== 'undefined')
  {
    
    setClauses.push(`display_name = $${index++}`); // display_name=$2
    values.push(displayName);
  }
  if(typeof handle !== 'undefined')
  {
    setClauses.push(`handle = $${index++}`);
    values.push(handle);
  }
  if(typeof bio !== 'undefined')
  {
    setClauses.push(`bio = $${index++}`);
    values.push(bio);
  }
  if(typeof avatarUrl !== 'undefined')
  {
    setClauses.push(`avatar_url = $${index++}`);
    values.push(avatarUrl);
  }

  setClauses.push(`updated_at = NOW()`); // we always want to update the updated_at column

  const result=await query<UserRow>(
    `UPDATE users
      SET ${setClauses.join(', ')}
      WHERE clerk_user_id = $1    
      RETURNING
        id,
        clerk_user_id,  
        display_name,
        handle,
        avatar_url,
        bio,
        created_at,
        updated_at
    `,
    values
  )
  if(result.rows.length===0)
  {
    throw new Error(`User with clerk_user_id ${clerkUserId} not found`);
  }
  
  return hydrateUser(result.rows[0]);
}