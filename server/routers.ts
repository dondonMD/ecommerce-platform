import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import type { InsertProduct } from "../drizzle/schema";
import Stripe from "stripe";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}

/**
 * Admin-only procedure for admin operations
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  /**
   * Authentication routes
   */
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /**
   * Product Management Routes
   */
  products: router({
    // Get all products with filtering and pagination
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        sortBy: z.enum(['newest', 'price-asc', 'price-desc', 'popular']).optional(),
        page: z.number().int().positive().optional().default(1),
        limit: z.number().int().positive().optional().default(20),
      }))
      .query(({ input }) => db.getProducts(input)),

    // Get single product
    getById: publicProcedure
      .input(z.number().int().positive())
      .query(({ input }) => db.getProductById(input)),

    // Get products by category
    getByCategory: publicProcedure
      .input(z.string())
      .query(({ input }) => db.getProductsByCategory(input)),

    // Admin: Create product
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        price: z.number().positive(),
        category: z.string().min(1).max(100),
        stock: z.number().int().nonnegative(),
        sku: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createProduct({
          name: input.name,
          description: input.description,
          price: input.price.toString(),
          category: input.category,
          stock: input.stock,
          sku: input.sku,
          isActive: true,
        });
      }),

    // Admin: Update product
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        category: z.string().min(1).max(100).optional(),
        stock: z.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...rest } = input;
        const updates: Record<string, any> = {};
        if (rest.name !== undefined) updates.name = rest.name;
        if (rest.description !== undefined) updates.description = rest.description;
        if (rest.price !== undefined) updates.price = rest.price.toString();
        if (rest.category !== undefined) updates.category = rest.category;
        if (rest.stock !== undefined) updates.stock = rest.stock;
        if (rest.isActive !== undefined) updates.isActive = rest.isActive;
        return db.updateProduct(id, updates);
      }),

    // Admin: Delete product
    delete: adminProcedure
      .input(z.number().int().positive())
      .mutation(({ input }) => db.deleteProduct(input)),

    // Admin: Upload product image
    uploadImage: adminProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        imageBase64: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const fileKey = `products/${input.productId}/${Date.now()}-${input.filename}`;
        
        const { url } = await storagePut(fileKey, buffer, 'image/jpeg');
        
        // Update product with image URL
        await db.updateProduct(input.productId, {
          imageUrl: url,
          imageKey: fileKey,
        });
        
        return { url, key: fileKey };
      }),
  }),

  /**
   * Shopping Cart Routes
   */
  cart: router({
    // Get user's cart
    get: protectedProcedure
      .query(async ({ ctx }) => {
        const cartItems = await db.getCart(ctx.user.id);
        
        // Enrich cart items with product details
        const enriched = await Promise.all(
          cartItems.map(async (item) => {
            const product = await db.getProductById(item.productId);
            const available = await db.getAvailableStock(item.productId);
            return {
              ...item,
              product: product || null,
              availableStock: available,
            };
          })
        );
        
        return enriched;
      }),

    // Add to cart
    addItem: protectedProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify product exists
        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
        }

        // Check available stock
        const available = await db.getAvailableStock(input.productId);
        if (input.quantity > available) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `Only ${available} items available` 
          });
        }

        return db.addToCart(ctx.user.id, input.productId, input.quantity);
      }),

    // Update cart item quantity
    updateItem: protectedProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().nonnegative(),
      }))
      .mutation(({ input, ctx }) => 
        db.updateCartItem(ctx.user.id, input.productId, input.quantity)
      ),

    // Remove from cart
    removeItem: protectedProcedure
      .input(z.number().int().positive())
      .mutation(({ input, ctx }) => 
        db.removeFromCart(ctx.user.id, input)
      ),

    // Clear cart
    clear: protectedProcedure
      .mutation(({ ctx }) => db.clearCart(ctx.user.id)),
  }),

  /**
   * Order Routes
   */
  orders: router({
    // Get user's orders
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().positive().optional().default(1),
        limit: z.number().int().positive().optional().default(10),
      }))
      .query(({ input, ctx }) => 
        db.getUserOrders(ctx.user.id, input.page, input.limit)
      ),

    // Get order details
    getById: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const order = await db.getOrderById(input);
        
        if (!order || order.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }
        
        const items = await db.getOrderItems(input);
        return { ...order, items };
      }),

    // Create order from cart
    create: protectedProcedure
      .input(z.object({
        shippingAddress: z.string(),
        billingAddress: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get user's cart
        const cartItems = await db.getCart(ctx.user.id);
        
        if (cartItems.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cart is empty' });
        }

        // Calculate total and verify stock
        let totalAmount = 0;
        const orderItems = [];

        for (const cartItem of cartItems) {
          const product = await db.getProductById(cartItem.productId);
          if (!product) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Product ${cartItem.productId} not found` });
          }

          const available = await db.getAvailableStock(cartItem.productId);
          if (cartItem.quantity > available) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: `Insufficient stock for ${product.name}` 
            });
          }

          const priceNum = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
          totalAmount += priceNum * cartItem.quantity;
          const priceStr = typeof product.price === 'string' ? product.price : String(product.price);
          orderItems.push({
            productId: cartItem.productId,
            productName: product.name,
            quantity: cartItem.quantity,
            price: priceStr,
          });
        }

        // Create order
        const order = await db.createOrder({
          userId: ctx.user.id,
          status: 'pending',
          totalAmount: totalAmount.toFixed(2),
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress || input.shippingAddress,
          items: JSON.stringify(orderItems),
        });

        // Create order items
        for (const item of orderItems) {
          await db.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: String(item.price),
          });
        }

        // Reserve inventory
        for (const cartItem of cartItems) {
          const inv = await db.getInventory(cartItem.productId);
          if (inv) {
            await db.updateInventory(cartItem.productId, {
              reserved: inv.reserved + cartItem.quantity,
            });
          }
        }

        return order;
      }),

    // Admin: Update order status
    updateStatus: adminProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
      }))
      .mutation(({ input }) => 
        db.updateOrderStatus(input.orderId, input.status)
      ),

    // Admin: Get all orders (placeholder for now)
    listAll: adminProcedure
      .input(z.object({
        page: z.number().int().positive().optional().default(1),
        limit: z.number().int().positive().optional().default(20),
      }))
      .query(async () => {
        // Placeholder - returns empty for now
        return { orders: [], total: 0 };
      }),
  }),

  /**
   * Payment Routes
   */
  payments: router({
    // Create payment intent
    createIntent: protectedProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        amount: z.number().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        const stripe = getStripeClient();
        
        if (!order || order.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }

        if (!stripe) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Payment service not configured' 
          });
        }

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(input.amount * 100), // Convert to cents
            currency: 'usd',
            metadata: {
              orderId: input.orderId.toString(),
              userId: ctx.user.id.toString(),
            },
          });

          // Store payment intent ID in the order
          await db.updateOrder(input.orderId, { stripePaymentIntentId: paymentIntent.id });

          return {
            clientSecret: paymentIntent.client_secret,
            publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
          };
        } catch (error) {
          console.error('Stripe error:', error);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to create payment intent' 
          });
        }
      }),

    // Confirm payment
    confirm: protectedProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        paymentIntentId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        const stripe = getStripeClient();
        
        if (!order || order.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }

        if (!stripe) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Payment service not configured' 
          });
        }

        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
          
          if (paymentIntent.status === 'succeeded') {
            // Update order status
            await db.updateOrderStatus(input.orderId, 'completed');
            
            // Update inventory (move from reserved to sold)
            const orderItems = await db.getOrderItems(input.orderId);
            for (const item of orderItems) {
              const inv = await db.getInventory(item.productId);
              if (inv) {
                await db.updateInventory(item.productId, {
                  reserved: Math.max(0, inv.reserved - item.quantity),
                  sold: inv.sold + item.quantity,
                });
              }
            }

            // Clear user's cart
            await db.clearCart(ctx.user.id);
            
            return { success: true, status: 'completed' };
          }
          
          return { success: false, status: paymentIntent.status };
        } catch (error) {
          console.error('Payment confirmation error:', error);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to confirm payment' 
          });
        }
      }),
  }),

  /**
   * Admin Dashboard Routes
   */
  admin: router({
    // Get dashboard stats
    stats: adminProcedure
      .query(async () => {
        // Get total products
        const totalProducts = await db.getTotalProducts();
        
        // Get total orders
        const totalOrders = await db.getTotalOrders();
        
        // Get total revenue
        const totalRevenue = await db.getTotalRevenue();
        
        return {
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue.toFixed(2),
        };
      }),

    // Get inventory status
    inventory: adminProcedure
      .query(async () => {
        // Placeholder - returns empty for now
        return [] as any[];
      }),
  }),
});

export type AppRouter = typeof appRouter;
