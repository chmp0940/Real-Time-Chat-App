export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status:number,message:string,details?:unknown){
    super(message);
    this.status=status;
    this.details=details;
  }
}

export class NotFoundError extends HttpError {
  constructor(message:string='Resource not found',details?:unknown){
    super(404,message,details);
  }   
}

export class BadRequestError extends HttpError {
  constructor(message:string='Bad request',details?:unknown){
    super(400,message,details);
  } 
}

export class UnauthorizedError extends HttpError {
  constructor(message:string='Unauthorized',details?:unknown){
    super(401,message,details);
  } 
}

export class ForbiddenError extends HttpError {
  constructor(message:string='Forbidden',details?:unknown){
    super(403,message,details);
  }
}