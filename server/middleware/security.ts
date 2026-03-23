import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import type { Express } from "express";

// ─────────────────────────────────────────────
// Security Middleware
// Adds helmet, rate limiting, and CORS to Express
// ─────────────────────────────────────────────

/**
 * Apply all security middleware to the Express app.
 * Call this BEFORE registering routes.
 */
export function applySecurityMiddleware(app: Express) {
  // Trust proxy (required for rate limiting behind reverse proxy)
  app.set("trust proxy", 1);

  // ─── Helmet: sets various HTTP headers for security ───
  app.use(
    helmet({
      // Custom CSP that allows blob: URLs (needed for CSV template download)
      // and worker-src for papaparse CSV parsing
      contentSecurityPolicy: process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://manus-analytics.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: ["'self'", "https:", "wss:"],
              workerSrc: ["'self'", "blob:"],
              childSrc: ["'self'", "blob:"],
              frameSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'", "https:", "blob:"],
            },
          }
        : false,
      // Allow cross-origin embedding for dev tools
      crossOriginEmbedderPolicy: false,
    })
  );

  // ─── CORS: restrict cross-origin requests ───
  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin) return callback(null, true);
        // Allow any origin in development
        if (process.env.NODE_ENV !== "production") return callback(null, true);
        // Check against allowed origins
        if (allowedOrigins.some((allowed) => origin.startsWith(allowed) || origin === allowed)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // ─── Rate Limiting: prevent abuse ───
  // General API rate limit: 100 requests per minute per IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    // Skip rate limiting in test environment
    skip: () => process.env.NODE_ENV === "test",
  });
  app.use("/api/trpc", apiLimiter);

  // Stricter rate limit for auth endpoints: 10 requests per minute
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts, please try again later." },
    skip: () => process.env.NODE_ENV === "test",
  });
  app.use("/api/oauth", authLimiter);

  // Webhook rate limit: 200 requests per minute (higher for automated systems)
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many webhook requests." },
    skip: () => process.env.NODE_ENV === "test",
  });
  app.use("/api/webhooks", webhookLimiter);

  console.log("[Security] Middleware applied: helmet, CORS, rate limiting");
}

/**
 * Build the list of allowed CORS origins from environment.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Always allow the app's own domain
  if (process.env.VITE_APP_URL) {
    origins.push(process.env.VITE_APP_URL);
  }

  // Allow manus.space and manus.computer domains
  origins.push("https://apexcrm-knxkwfan.manus.space");

  // Allow custom origins from env (comma-separated)
  const customOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (customOrigins) {
    origins.push(...customOrigins.split(",").map((o) => o.trim()));
  }

  return origins;
}
