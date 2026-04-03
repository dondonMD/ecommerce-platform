import { Redis } from "@upstash/redis";
import { ENV } from "./env";

let redisClient: Redis | null | undefined;

/**
 * Initialize Upstash Redis lazily so cold starts do not block app boot.
 */
export async function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = ENV.upstashRedisRestUrl;
  const token = ENV.upstashRedisRestToken;

  if (!url || !token) {
    console.warn("[Redis] Upstash REST credentials missing; caching is disabled.");
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function checkRedisHealth(timeoutMs = 2000) {
  const client = await getRedisClient();
  if (!client) {
    return { ok: false as const, reason: "redis_not_configured" };
  }

  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("redis_timeout")), timeoutMs)
      ),
    ]);

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "redis_error",
    };
  }
}

/**
 * Cache wrapper with TTL
 */
export class Cache {
  private static instance: Cache;
  private client: Redis | null = null;

  private constructor() {}

  static async getInstance(): Promise<Cache> {
    if (!Cache.instance) {
      Cache.instance = new Cache();
      Cache.instance.client = await getRedisClient();
    }
    return Cache.instance;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const result = await this.client.get<string>(key);
      return result ?? null;
    } catch (error) {
      console.warn("[Cache] Get error:", error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, { ex: ttlSeconds });
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.warn("[Cache] Set error:", error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.warn("[Cache] Del error:", error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn("[Cache] Exists error:", error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.warn("[Cache] Invalidate pattern error:", error);
    }
  }
}

/**
 * Cache keys
 */
export const CACHE_KEYS = {
  PRODUCTS_LIST: (params: any) => `products:list:${JSON.stringify(params)}`,
  PRODUCT_DETAIL: (id: number) => `products:detail:${id}`,
  USER_CART: (userId: number) => `cart:user:${userId}`,
  PRODUCT_INVENTORY: (productId: number) => `inventory:product:${productId}`,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  PRODUCTS_LIST: 300,
  PRODUCT_DETAIL: 600,
  USER_CART: 1800,
  PRODUCT_INVENTORY: 60,
} as const;
