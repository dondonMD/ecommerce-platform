import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Rate limiting configurations
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: "Too many requests from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for sensitive operations
    message: {
      error: "Too many sensitive operations from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Stripe webhook endpoint (needs raw body for signature verification)
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    let event: Stripe.Event;

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log('PaymentIntent was successful:', paymentIntent.id);
          
          // Find order by payment intent ID
          const order = await db.getOrderByPaymentIntentId(paymentIntent.id);
          if (order) {
            // Update order status to completed
            await db.updateOrderStatus(order.id, 'completed');
            
            // Update inventory (move from reserved to sold)
            const orderItems = await db.getOrderItems(order.id);
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
            await db.clearCart(order.userId);
            
            console.log(`Order ${order.id} completed successfully via webhook`);
          } else {
            console.error(`Order not found for payment intent ${paymentIntent.id}`);
          }
          break;
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          console.log('PaymentIntent failed:', failedPayment.id);
          
          // Find order by payment intent ID and mark as failed
          const failedOrder = await db.getOrderByPaymentIntentId(failedPayment.id);
          if (failedOrder) {
            await db.updateOrderStatus(failedOrder.id, 'failed');
            
            // Release reserved inventory back to stock
            const failedOrderItems = await db.getOrderItems(failedOrder.id);
            for (const item of failedOrderItems) {
              const inv = await db.getInventory(item.productId);
              if (inv) {
                await db.updateInventory(item.productId, {
                  reserved: Math.max(0, inv.reserved - item.quantity),
                  stock: inv.stock + item.quantity, // Return to available stock
                });
              }
            }
            
            console.log(`Order ${failedOrder.id} marked as failed via webhook`);
          } else {
            console.error(`Order not found for failed payment intent ${failedPayment.id}`);
          }
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Apply general rate limiting to all routes
  app.use(generalLimiter);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Health check endpoint (no rate limiting needed)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  // Apply strict rate limiting to tRPC API (contains sensitive operations)
  app.use("/api/trpc", strictLimiter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
