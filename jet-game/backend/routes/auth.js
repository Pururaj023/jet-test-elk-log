const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { sendLog } = require("../services/elasticsearch");

// In-memory user store (replace with DB in production)
const users = new Map();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Check existing
    for (const [, user] of users) {
      if (user.username === username) {
        return res.status(409).json({ error: "Username already taken" });
      }
      if (user.email === email) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      highScore: 0,
      totalGames: 0,
      scores: [],
    };

    users.set(userId, user);

    const token = generateToken(userId);

    await sendLog({
      level: "info",
      event: "user_registered",
      userId,
      username,
      message: `New user registered: ${username}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({
      token,
      user: { id: userId, username, email, highScore: 0, totalGames: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    let foundUser = null;
    for (const [, user] of users) {
      if (user.username === username) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser || !(await bcrypt.compare(password, foundUser.password))) {
      await sendLog({
        level: "warn",
        event: "login_failed",
        username,
        message: `Failed login attempt for: ${username}`,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(foundUser.id);

    await sendLog({
      level: "info",
      event: "user_login",
      userId: foundUser.id,
      username,
      message: `User logged in: ${username}`,
      ip: req.ip,
    });

    res.json({
      token,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        highScore: foundUser.highScore,
        totalGames: foundUser.totalGames,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = { router, users };