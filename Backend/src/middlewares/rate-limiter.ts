import rateLimit from 'express-rate-limit';

// Global API rate limiter — 100 requests per minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,   // Disable `X-RateLimit-*` headers
  message: {
    error: {
      message: 'Too many requests, please try again later.',
      status: 429,
    },
  },
});

// Strict rate limiter for write-heavy endpoints — 20 requests per minute per IP
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Rate limit exceeded for this action. Please slow down.',
      status: 429,
    },
  },
});
