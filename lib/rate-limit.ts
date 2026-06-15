/**
 * Rate limiting utilities for API endpoints
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Maximum number of requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * In-memory rate limiter
 * Note: For production with multiple instances, consider Redis or similar
 */
class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Check if request is within rate limit
   * @returns Object with allowed status and remaining requests
   */
  check(
    key: string,
    config: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // If no entry or window expired, reset
    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: config.windowMs,
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetTime - now,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.store.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /** Dashboard API: 30 requests per minute */
  dashboard: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  /** Auth API: 5 requests per 15 minutes */
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  },
  /** General API: 100 requests per minute */
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
} as const;

/**
 * Get client identifier from request headers
 * Uses X-Forwarded-For or falls back to a default
 */
export function getClientId(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback for local development
  return "localhost";
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetIn: number,
  limit: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(resetIn / 1000).toString(),
  };
}
