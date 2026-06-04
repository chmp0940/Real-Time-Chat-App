import{Router} from 'express'
import { z } from 'zod';
// zod is a schema validation library. we will use it to validate the request body for updating user profile.
import { toUserProfileResponse, UserProfile, userProfileResponse } from '../modules/users/user.types.js';
import{getAuth} from '../config/clerk.js'
import { UnauthorizedError } from '../lib/errors.js';
import {
  getUserFromClerk,
  updateUserProfile,
} from "../modules/users/user.service.js";

export const userRouter=Router();

// user update schema
const userProfileUpdateSchema = z.object({
  displayName:z.string().trim().max(50).optional(),
  handle:z.string().trim().max(30).optional(),
  bio:z.string().trim().max(500).optional(),
  avatarUrl:z.url('Avatr must be a valid URL').optional(),
});


function toResponse(profile:UserProfile):userProfileResponse{

  return toUserProfileResponse(profile);
}



//get -> api/me

userRouter.get('/',async(req,res,next)=>{
  try {
    const auth=getAuth(req);
    if(!auth.userId)
    {
      throw new UnauthorizedError('Unauthorized');
    }

    const profile=await getUserFromClerk(auth.userId);
    const response=toResponse(profile);
    res.json({data:response});
  } catch (error) {
    next(error);
  }
})



// patch- api/me

userRouter.patch('/',async(req,res,next)=>{
  try {
    const auth=getAuth(req);
    if(!auth.userId)
    {
      throw new UnauthorizedError('Unauthorized');
    } 
    const parsedBody=userProfileUpdateSchema.parse(req.body);
    // we will implement the update user profile functionality in the future. for now, we will just return the updated profile.
    const displayName=parsedBody.displayName && parsedBody.displayName.trim().length>0 ? parsedBody.displayName.trim() : undefined;
    const handle=parsedBody.handle && parsedBody.handle.trim().length>0 ? parsedBody.handle.trim() : undefined;
    const bio=parsedBody.bio && parsedBody.bio.trim().length>0 ? parsedBody.bio.trim() : undefined;
    const avatarUrl=parsedBody.avatarUrl && parsedBody.avatarUrl.trim().length>0 ? parsedBody.avatarUrl.trim() : undefined;
    
    try {
      const profile=await updateUserProfile({
        clerkUserId:auth.userId,
        displayName,
        handle,
        bio,
        avatarUrl,
      })
      const response=toResponse(profile);
      res.json({data:response});
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update user profile');
    }
  }
    catch (error) { 
    next(error);
  }
})