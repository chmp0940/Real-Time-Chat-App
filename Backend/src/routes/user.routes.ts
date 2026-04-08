import{Router} from 'express'
import { z } from 'zod';
// zod is a schema validation library. we will use it to validate the request body for updating user profile.
import { toUserProfileResponse, UserProfile, userProfileResponse } from '../modules/users/user.types.js';
import{getAuth} from '../config/clerk.js'
import { UnauthorizedError } from '../lib/errors.js';
import { getUserFromClerk } from '../modules/users/user.service.js';

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