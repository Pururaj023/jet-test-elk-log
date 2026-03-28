require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initElasticsearch, sendLog, getElasticsearchStatus } = require("./services/elasticsearch");
const { router: authRouter } = require("./routes/auth");
const gameRouter = require("./routes/game");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    sendLog({
      level: res.statusCode >= 400 ? "warn" : "info",
      event: "http_request",
      message: `${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`,
      data: { method: req.method, path: req.path, status: res.statusCode, duration: Date.now() - start },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  });
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/game", gameRouter);

// Health check
app.get("/api/health", (req, res) => {
  const esStatus = getElasticsearchStatus();
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    elasticsearch: esStatus,
    timestamp: new Date().toISOString(),
  });
});

// Start
const start = async () => {
  await initElasticsearch();

  app.listen(PORT, () => {
    console.log(`\n🚀 Jet Game Backend running on http://localhost:${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/api/health\n`);
  });

  await sendLog({
    level: "info",
    event: "server_start",
    message: `Server started on port ${PORT}`,
  });
};

start();