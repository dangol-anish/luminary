// Simple in-memory rate limiter for API endpoints

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Configuration: for different endpoints
const rateLimitConfigs: Record<string, { maxRequests: number; windowSeconds: number }> = {
  "/api/evaluate": { maxRequests: 10, windowSeconds: 60 }, // 10 requests per minute
  "/api/metrics": { maxRequests: 30, windowSeconds: 60 },
  "/api/calls": { maxRequests: 30, windowSeconds: 60 },
  "/api/alerts": { maxRequests: 20, windowSeconds: 60 },
};

function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(userId: string, endpoint: string): { allowed: boolean; remaining: number; resetIn: number } {
  cleanupExpiredRecords(); // Lazy cleanup on each check
  const config = rateLimitConfigs[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint
    return { allowed: true, remaining: 0, resetIn: 0 };
  }

  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // New window
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowSeconds };
  }

  if (record.count < config.maxRequests) {
    // Still within limit
    record.count++;
    const remaining = config.maxRequests - record.count;
    const resetIn = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: true, remaining, resetIn };
  }

  // Rate limit exceeded
  const resetIn = Math.ceil((record.resetTime - now) / 1000);
  return { allowed: false, remaining: 0, resetIn };
}