const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { sendLog, sendScore, getRecentLogs, getElasticsearchStatus } = require("../services/elasticsearch");
const { users } = require("./auth");

// Save game score
router.post("/score", authMiddleware, async (req, res) => {
  try {
    const { score, duration, obstaclesAvoided, level } = req.body;
    const user = users.get(req.userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    const isHighScore = score > user.highScore;
    if (isHighScore) user.highScore = score;

    user.totalGames += 1;
    user.scores.unshift({ score, duration, obstaclesAvoided, level, playedAt: new Date().toISOString() });
    if (user.scores.length > 20) user.scores.pop(); // Keep last 20

    // Send to Elasticsearch
    await sendScore({
      userId: user.id,
      username: user.username,
      score,
      duration,
      obstaclesAvoided,
      level,
    });

    await sendLog({
      level: "info",
      event: "game_over",
      userId: user.id,
      username: user.username,
      message: `Game over - Score: ${score}, Duration: ${duration}s, Obstacles: ${obstaclesAvoided}`,
      data: { score, duration, obstaclesAvoided, level, isHighScore },
    });

    res.json({
      saved: true,
      isHighScore,
      highScore: user.highScore,
      totalGames: user.totalGames,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save score" });
  }
});

// Get user profile + scores
router.get("/profile", authMiddleware, async (req, res) => {
  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  await sendLog({
    level: "info",
    event: "profile_viewed",
    userId: user.id,
    username: user.username,
    message: `Profile viewed by ${user.username}`,
  });

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    highScore: user.highScore,
    totalGames: user.totalGames,
    recentScores: user.scores.slice(0, 10),
    memberSince: user.createdAt,
  });
});

// Get recent logs (admin/debug)
router.get("/logs", authMiddleware, async (req, res) => {
  const logs = await getRecentLogs(50);
  const status = getElasticsearchStatus();
  res.json({ logs, elasticsearchStatus: status });
});

// Log game event (start, collision, etc.)
router.post("/event", authMiddleware, async (req, res) => {
  try {
    const { event, data } = req.body;
    const user = users.get(req.userId);

    await sendLog({
      level: "info",
      event,
      userId: req.userId,
      username: user?.username || "unknown",
      message: `Game event: ${event}`,
      data,
    });

    res.json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log event" });
  }
});

// Leaderboard
router.get("/leaderboard", async (req, res) => {
  const allUsers = [...users.values()].map((u) => ({
    username: u.username,
    highScore: u.highScore,
    totalGames: u.totalGames,
  }));

  allUsers.sort((a, b) => b.highScore - a.highScore);
  res.json(allUsers.slice(0, 10));
});

module.exports = router;