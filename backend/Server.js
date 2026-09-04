const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Server: SocketIOServer } = require("socket.io");
const cron = require("node-cron");

const env = require("./config/env");
const db = require("./config/db");
require("./config/firebase"); // Initialise Firebase Admin before any route needs it.
const scheduler = require("./services/scheduler");
const authenticate = require("./middleware/authenticate");
const { updateLocations } = require("./controllers/LocationController");

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------------
app.set("trust proxy", 1); // Correct client IPs behind a hosting proxy (Fly/Render/Railway).
app.use(helmet());
app.use(
  cors({
    // No CORS_ORIGINS configured (development) => reflect any origin.
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    credentials: true,
  })
);
app.use(morgan(env.isProduction ? "combined" : "dev"));

// Stripe signature verification needs the raw body, so this route is mounted
// BEFORE the JSON parser and is deliberately not behind `authenticate`
// (Stripe calls it directly and authenticates via webhook signature).
app.use(
  "/api/stripe-webhooks",
  express.raw({ type: "application/json" }),
  require("./routes/stripeWebhooks")
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// ---------------------------------------------------------------------------
// Health check - unauthenticated, used by hosting platforms and smoke tests.
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    uptime: process.uptime(),
    database: states[db.mongoose.connection.readyState] ?? "unknown",
    firebase: require("./config/firebase").isEnabled() ? "configured" : "not configured",
  });
});

// ---------------------------------------------------------------------------
// API routes (all authenticated)
// ---------------------------------------------------------------------------
const routes = {
  activitylogs: "activityLogs",
  articles: "articles",
  blocklists: "blockLists",
  chats: "chats",
  events: "events",
  favorites: "favorites",
  friendrequests: "friendRequests",
  friends: "friends",
  groupchats: "groupChats",
  locations: "locations",
  media: "medias",
  messages: "messages",
  notifications: "notifications",
  payments: "payments",
  petmatches: "petMatches",
  pets: "pets",
  playdates: "playdates",
  reports: "reports",
  reviews: "reviews",
  services: "services",
  "subscription-history": "subscriptionHistory",
  subscriptions: "subscriptions",
  supportmessages: "supportMessages",
  userpreferences: "userPreferences",
  users: "users",
};

for (const [mountPath, moduleName] of Object.entries(routes)) {
  app.use(`/api/${mountPath}`, authenticate, require(`./routes/${moduleName}`));
}

// ---------------------------------------------------------------------------
// 404 + error handling. The error handler MUST take four arguments or Express
// treats it as ordinary middleware and never invokes it - the previous
// three-argument version silently never ran.
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error("[error]", err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: env.isProduction && status === 500 ? "Internal server error" : err.message,
  });
});

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------
const io = new SocketIOServer(server, {
  cors: { origin: env.corsOrigins.length > 0 ? env.corsOrigins : true },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Clients join a room named after their user id so the server can target them.
  socket.on("join", (userId) => {
    if (userId) socket.join(String(userId));
  });

  socket.on("disconnect", () => console.log(`[socket] disconnected: ${socket.id}`));
});

app.set("io", io);
// Services have no request in scope, so they reach the same rooms through here.
require("./services/realtime").setIO(io);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
/**
 * Reports create paths that can never satisfy their schema.
 *
 * Non-fatal, and skipped in production: the enforcement lives in
 * `test/schemaAudit.test.js`, which fails CI. This is here so a developer who
 * writes one sees it on the next restart rather than on the next bug report -
 * which for the nine we found was months.
 */
const auditSchemas = () => {
  if (env.isProduction) return;

  try {
    const problems = require("./services/schemaAudit").audit();
    if (problems.length === 0) return;

    console.warn(
      `\n[schema] ${problems.length} create path(s) cannot satisfy their model:`
    );
    for (const problem of problems) console.warn(`[schema]   ${problem}`);
    console.warn("[schema] These writes will fail validation at runtime.\n");
  } catch (error) {
    // A broken audit must never stop the server from booting.
    console.warn("[schema] Audit could not run:", error.message);
  }
};

/**
 * Reports reads that are not scoped to the caller, and writes that take
 * identity from the request body. Same posture as the schema audit: loud in
 * development, enforced by `test/authAudit.test.js` in CI, silent in
 * production where a regex pass has no business deciding whether to boot.
 */
const auditAuthorisation = () => {
  if (env.isProduction) return;

  try {
    const problems = require("./services/authAudit").audit();
    if (problems.length === 0) return;

    console.warn(`\n[authz] ${problems.length} authorisation problem(s):`);
    for (const problem of problems) console.warn(`[authz]   ${problem}`);
    console.warn("");
  } catch (error) {
    console.warn("[authz] Audit could not run:", error.message);
  }
};

const start = async () => {
  // Start listening immediately so platform health checks succeed even while the
  // database is still connecting or is temporarily unreachable. /health reports
  // the real database state, so an outage is visible without being fatal.
  server.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port} (${env.nodeEnv})`);
  });

  db.connect().catch((error) => {
    console.error("[db] Initial connection failed:", error.message);
  });

  scheduler.start();
  auditSchemas();
  auditAuthorisation();

  // Refresh cached place data at 00:00 on the 1st of each month.
  cron.schedule("0 0 1 * *", async () => {
    console.log("[cron] Refreshing locations");
    try {
      await updateLocations();
    } catch (error) {
      console.error("[cron] updateLocations failed:", error.message);
    }
  });
};

const shutdown = async (signal) => {
  console.log(`\n[server] ${signal} received, shutting down`);
  scheduler.stop();
  io.close();
  server.close(async () => {
    await db.disconnect();
    process.exit(0);
  });
  // Don't hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (require.main === module) {
  start();
}

module.exports = { app, server, start };
