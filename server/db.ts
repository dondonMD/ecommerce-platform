import { connect } from "@tidbcloud/serverless";
import { eq, and, gte, lte, like, desc, asc, sql } from "drizzle-orm";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { drizzle as drizzleTidb } from "drizzle-orm/tidb-serverless";
import { InsertUser, users, products, cartItems, orders, orderItems, inventory } from "../drizzle/schema";
import { ENV } from './_core/env';
import { Cache, CACHE_KEYS, CACHE_TTL } from './_core/cache';
import type { Product, InsertProduct, CartItem, InsertCartItem, Order, InsertOrder, OrderItem, InsertOrderItem, Inventory } from "../drizzle/schema";

type DbClient = ReturnType<typeof drizzleMysql> | ReturnType<typeof drizzleTidb> | any;

let _db: DbClient | null = null;
let _dbInitAttempted = false;

function getInsertedId(result: unknown): number {
  const value =
    (result as any)?.insertId ??
    (result as any)?.[0]?.insertId ??
    (result as any)?.lastInsertRowid;

  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Insert did not return a valid id");
  }

  return id;
}

function toNumber(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lazily create the drizzle instance so cold starts do not block app boot.
 * Prefer TiDB's serverless HTTP driver in production when a valid URL is provided.
 * Gracefully fall back to standard MySQL driver (mysql2) if TIDB_URL is missing or malformed.
 */
function getRuntimeDb(): DbClient | null {
  if (_dbInitAttempted) {
    return _db;
  }

  _dbInitAttempted = true;

  try {
    // 1. Try TiDB Serverless HTTP driver first (if configured and valid)
    if (ENV.tidbUrl && (ENV.tidbUrl.startsWith('https://') || ENV.tidbUrl.includes('tidbcloud.com'))) {
      try {
        console.log("[Database] Initializing with TiDB serverless driver...");
        const client = connect({ url: ENV.tidbUrl });
        _db = drizzleTidb({ client });
        return _db;
      } catch (error) {
        console.warn("[Database] TiDB serverless initialization failed, trying fallback...", error);
      }
    }

    // 2. Fall back to standard MySQL driver
    if (ENV.databaseUrl) {
      const isLocalhost = ENV.databaseUrl.includes('localhost') || ENV.databaseUrl.includes('127.0.0.1');
      
      if (process.env.VERCEL && isLocalhost) {
        console.error("[Database] ❌ CRITICAL: DATABASE_URL points to localhost but app is running on Vercel. Please update your Vercel Environment Variables.");
      }

      if (ENV.databaseUrl.startsWith('mysql://')) {
        console.log(`[Database] Initializing with standard MySQL driver (mysql2)... ${isLocalhost ? '(⚠️ LOCALHOST)' : ''}`);
        
        // For non-localhost connections (TiDB Cloud), we must ensure SSL is enabled
        if (!isLocalhost) {
          const pool = mysql.createPool({
            uri: ENV.databaseUrl,
            ssl: {
              rejectUnauthorized: false,
            },
            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,
          });
          _db = drizzleMysql(pool);
        } else {
          _db = drizzleMysql(ENV.databaseUrl);
        }
        
        return _db;
      } else {
        console.warn("[Database] DATABASE_URL format invalid (expected mysql://):", ENV.databaseUrl);
      }
    } else {
      console.warn("[Database] No TiDB_URL or DATABASE_URL configured.");
    }
  } catch (error) {
    console.error("[Database] Critical initialization error:", error);
  }

  _db = null;
  return _db;
}

export async function getDb(): Promise<DbClient | null> {
  return getRuntimeDb();
}

export async function checkDatabaseHealth(timeoutMs = 3000) {
  const db = await getDb();
  if (!db) {
    return { ok: false as const, reason: "database_not_configured" };
  }

  try {
    await Promise.race([
      db.execute(sql`select 1 as ok`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("database_timeout")), timeoutMs)
      ),
    ]);

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "database_error",
    };
  }
}

/**
 * User Management Functions
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Product Management Functions
 */
export async function createProduct(product: InsertProduct): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values(product);
  const productId = getInsertedId(result);
  
  // Initialize inventory for the product
  await db.insert(inventory).values({ productId: Number(productId) });
  
  const created = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
  return created[0];
}

export async function updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products).set(updates).where(eq(products.id, id));
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(products).where(eq(products.id, id));
  await db.delete(inventory).where(eq(inventory.productId, id));
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const cache = await Cache.getInstance();
  const cacheKey = CACHE_KEYS.PRODUCT_DETAIL(id);

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[Cache] Failed to parse cached product:', error);
    }
  }

  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const product = result.length > 0 ? result[0] : undefined;

  // Cache the result if found
  if (product) {
    await cache.set(cacheKey, JSON.stringify(product), CACHE_TTL.PRODUCT_DETAIL);
  }

  return product;
}

export async function getProducts(opts: {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'popular';
  page?: number;
  limit?: number;
} = {}): Promise<{ products: Product[]; total: number }> {
  const cache = await Cache.getInstance();
  const cacheKey = CACHE_KEYS.PRODUCTS_LIST(opts);

  // Try to get from cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[Cache] Failed to parse cached products:', error);
    }
  }

  const db = await getDb();
  if (!db) return { products: [], total: 0 };
  
  const { search, category, minPrice, maxPrice, sortBy = 'newest', page = 1, limit = 20 } = opts;
  
  const conditions = [eq(products.isActive, true)];
  
  if (search) {
    conditions.push(like(products.name, `%${search}%`));
  }
  if (category) {
    conditions.push(eq(products.category, category));
  }
  if (minPrice !== undefined) {
    conditions.push(gte(products.price, minPrice.toString()));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(products.price, maxPrice.toString()));
  }
  
  // Build query with sorting
  let baseQuery = db.select().from(products).where(and(...conditions));
  
  const offset = (page - 1) * limit;
  
  let results: Product[] = [];
  switch (sortBy) {
    case 'price-asc':
      results = await baseQuery.orderBy(asc(products.price)).limit(limit).offset(offset);
      break;
    case 'price-desc':
      results = await baseQuery.orderBy(desc(products.price)).limit(limit).offset(offset);
      break;
    case 'popular':
      results = await baseQuery.orderBy(desc(products.stock)).limit(limit).offset(offset);
      break;
    case 'newest':
    default:
      results = await baseQuery.orderBy(desc(products.createdAt)).limit(limit).offset(offset);
  }
  
  // Get total count
  const countResult = await (db as any)
    .select({ count: sql`COUNT(*)` })
    .from(products)
    .where(and(...conditions));
  const total = toNumber(countResult[0]?.count);

  const result = { products: results, total };

  // Cache the result
  await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.PRODUCTS_LIST);

  return result;
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(products)
    .where(and(eq(products.category, category), eq(products.isActive, true)))
    .limit(50);
}

/**
 * Cart Management Functions
 */
export async function addToCart(userId: number, productId: number, quantity: number): Promise<CartItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if item already exists in cart
  const existing = await db.select().from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update quantity
    await db.update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id));
    
    const updated = await db.select().from(cartItems).where(eq(cartItems.id, existing[0].id)).limit(1);
    
    // Invalidate cart cache
    const cache = await Cache.getInstance();
    await cache.del(CACHE_KEYS.USER_CART(userId));
    
    return updated[0];
  }
  
  // Create new cart item
  const result = await db.insert(cartItems).values({ userId, productId, quantity });
  const cartItemId = getInsertedId(result);
  const created = await db.select().from(cartItems).where(eq(cartItems.id, cartItemId)).limit(1);
  
  // Invalidate cart cache
  const cache = await Cache.getInstance();
  await cache.del(CACHE_KEYS.USER_CART(userId));
  
  return created[0];
}

export async function updateCartItem(userId: number, productId: number, quantity: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (quantity <= 0) {
    // Remove item if quantity is 0 or less
    await db.delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
  } else {
    await db.update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
  }

  // Invalidate cart cache
  const cache = await Cache.getInstance();
  await cache.del(CACHE_KEYS.USER_CART(userId));
}

export async function removeFromCart(userId: number, productId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

  // Invalidate cart cache
  const cache = await Cache.getInstance();
  await cache.del(CACHE_KEYS.USER_CART(userId));
}

export async function getCart(userId: number): Promise<CartItem[]> {
  const cache = await Cache.getInstance();
  const cacheKey = CACHE_KEYS.USER_CART(userId);

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[Cache] Failed to parse cached cart:', error);
    }
  }

  const db = await getDb();
  if (!db) return [];
  
  const cart = await db.select().from(cartItems).where(eq(cartItems.userId, userId));

  // Cache the result
  await cache.set(cacheKey, JSON.stringify(cart), CACHE_TTL.USER_CART);

  return cart;
}

export async function clearCart(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(cartItems).where(eq(cartItems.userId, userId));

  // Invalidate cart cache
  const cache = await Cache.getInstance();
  await cache.del(CACHE_KEYS.USER_CART(userId));
}

/**
 * Order Management Functions
 */
export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(orders).values(order);
  const orderId = getInsertedId(result);
  
  const created = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return created[0];
}

export async function updateOrderStatus(orderId: number, status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result[0];
}

export async function updateOrder(orderId: number, updates: Partial<Order>): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders).set(updates).where(eq(orders.id, orderId));
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result[0];
}

export async function getOrderById(orderId: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderByPaymentIntentId(paymentIntentId: string): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrders(userId: number, page = 1, limit = 10): Promise<{ orders: Order[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const offset = (page - 1) * limit;
  const results = await db.select().from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
  
  const countResult = await (db as any)
    .select({ count: sql`COUNT(*)` })
    .from(orders)
    .where(eq(orders.userId, userId));
  const total = toNumber(countResult[0]?.count);
  
  return { orders: results, total };
}

export async function createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(orderItems).values(item);
  const orderItemId = getInsertedId(result);
  const created = await db.select().from(orderItems).where(eq(orderItems.id, orderItemId)).limit(1);
  return created[0];
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

/**
 * Inventory Management Functions
 */
export async function getInventory(productId: number): Promise<Inventory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(inventory).where(eq(inventory.productId, productId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateInventory(productId: number, updates: Partial<Inventory>): Promise<Inventory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(inventory).set(updates).where(eq(inventory.productId, productId));
  const result = await db.select().from(inventory).where(eq(inventory.productId, productId)).limit(1);
  return result[0];
}

/**
 * Check available stock considering reservations
 */
export async function getAvailableStock(productId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const product = await getProductById(productId);
  const inv = await getInventory(productId);
  
  if (!product || !inv) return 0;
  
  return product.stock - inv.reserved;
}

/**
 * Admin Dashboard Functions
 */
export async function getTotalProducts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await (db as any)
    .select({ count: sql`count(*)` })
    .from(products)
    .where(eq(products.isActive, true));
  return toNumber(result[0]?.count);
}

export async function getTotalOrders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await (db as any)
    .select({ count: sql`count(*)` })
    .from(orders);
  return toNumber(result[0]?.count);
}

export async function getTotalRevenue(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await (db as any)
    .select({
      total: sql`sum(cast(${orders.totalAmount} as decimal(10,2)))`,
    })
    .from(orders)
    .where(eq(orders.status, 'completed'));
  
  return toNumber(result[0]?.total);
}
