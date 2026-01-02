import { beforeAll, afterAll, vi } from "vitest";

// Set up test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "mysql://testuser:testpass@localhost:3307/ecommerce_test";
process.env.REDIS_URL = "redis://localhost:6380";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.SESSION_SECRET = "test-session-secret";

// Mock the database connection to return null
vi.mock("./server/db", () => ({
  getDb: () => Promise.resolve(null),
  upsertUser: () => Promise.reject(new Error("Database not available")),
  getProducts: () => Promise.reject(new Error("Database not available")),
  createProduct: () => Promise.reject(new Error("Database not available")),
  updateProduct: () => Promise.reject(new Error("Database not available")),
  deleteProduct: () => Promise.reject(new Error("Database not available")),
  getUserCart: () => Promise.reject(new Error("Database not available")),
  addToCart: () => Promise.reject(new Error("Database not available")),
  updateCartItem: () => Promise.reject(new Error("Database not available")),
  removeFromCart: () => Promise.reject(new Error("Database not available")),
  clearCart: () => Promise.reject(new Error("Database not available")),
  createOrder: () => Promise.reject(new Error("Database not available")),
  getUserOrders: () => Promise.reject(new Error("Database not available")),
  updateOrderStatus: () => Promise.reject(new Error("Database not available")),
}));

// Mock Redis client to prevent connection errors
const mockRedis = {
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  set: () => Promise.resolve("OK"),
  del: () => Promise.resolve(1),
  expire: () => Promise.resolve(1),
  exists: () => Promise.resolve(0),
  ping: () => Promise.resolve("PONG"),
};

vi.mock("redis", () => ({
  createClient: () => mockRedis,
}));

// Mock AWS S3 to prevent connection errors
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send() {
      return Promise.resolve({});
    }
  },
  PutObjectCommand: class {},
  GetObjectCommand: class {},
  DeleteObjectCommand: class {},
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: () => Promise.resolve("https://mock-signed-url.com"),
}));

// Mock Stripe to prevent API calls
vi.mock("stripe", () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: () => ({}),
    };
    paymentIntents = {
      create: () => Promise.resolve({ id: "pi_test", client_secret: "secret" }),
    };
  },
}));

// Global test setup - simplified, no docker containers needed
beforeAll(async () => {
  console.log("Test environment setup complete - using mocked services");
});

afterAll(async () => {
  console.log("Test cleanup complete");
});