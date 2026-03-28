import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const W = 800, H = 400;
const JET_W = 60, JET_H = 28;
const GRAVITY = 0.45, THRUST = -0.9, MAX_SPEED = 9;
const OBS_W = 28, OBS_GAP = 155, OBS_SPEED_BASE = 3;

const colors = {
  sky: ["#020817", "#0c1a3d", "#1e3a5f"],
  jet: "#38bdf8",
  jetGlow: "rgba(56,189,248,0.4)",
  obs: "#ef4444",
  obsGlow: "rgba(239,68,68,0.3)",
  star: "#e6edf3",
  trail: "rgba(56,189,248,0.15)",
  score: "#fbbf24",
  ground: "#1e3a5f",
};

function lerp(a, b, t) { return a + (b - a) * t; }

export default function JetGame({ token, onRefreshProfile }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const animRef = useRef(null);

  const [gameState, setGameState] = useState("idle"); // idle | playing | dead
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [saving, setSaving] = useState(false);

  const logEvent = useCallback(async (event, data) => {
    if (!token) return;
    try {
      await fetch("/api/game/event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event, data }),
      });
    } catch {}
  }, [token]);

  const saveScore = useCallback(async (scoreData) => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/game/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(scoreData),
      });
      const data = await res.json();
      if (data.isHighScore) setIsNewHigh(true);
      if (data.highScore) setHighScore(data.highScore);
      onRefreshProfile?.();
    } catch {}
    setSaving(false);
  }, [token, onRefreshProfile]);

  const initState = () => ({
    jet: { x: 120, y: H / 2, vy: 0, thrusting: false, trail: [] },
    obstacles: [],
    stars: Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.85,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.4 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    })),
    clouds: Array.from({ length: 5 }, (_, i) => ({
      x: 100 + i * 160, y: 20 + Math.random() * 80,
      w: 60 + Math.random() * 80, speed: 0.3 + Math.random() * 0.3, alpha: 0.06,
    })),
    score: 0,
    obstaclesAvoided: 0,
    elapsed: 0,
    spawnTimer: 0,
    speed: OBS_SPEED_BASE,
    level: 1,
    frameCount: 0,
    startTime: Date.now(),
  });

  const startGame = useCallback(() => {
    stateRef.current = initState();
    setGameState("playing");
    setScore(0);
    setIsNewHigh(false);
    logEvent("game_start", { timestamp: new Date().toISOString() });
  }, [logEvent]);

  // Key / touch handlers
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (stateRef.current) stateRef.current.jet.thrusting = true;
      }
    };
    const onUp = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        if (stateRef.current) stateRef.current.jet.thrusting = false;
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  const handleTouch = (pressing) => {
    if (stateRef.current) stateRef.current.jet.thrusting = pressing;
  };

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const spawnObs = (st) => {
      const gapY = 60 + Math.random() * (H - OBS_GAP - 120);
      st.obstacles.push({
        x: W + OBS_W,
        topH: gapY,
        botY: gapY + OBS_GAP,
        botH: H - gapY - OBS_GAP,
        passed: false,
      });
    };

    const checkCollision = (jet, obs) => {
      const jx = jet.x, jy = jet.y;
      const pad = 6;
      if (jx + JET_W - pad > obs.x && jx + pad < obs.x + OBS_W) {
        if (jy + pad < obs.topH || jy + JET_H - pad > obs.botY) return true;
      }
      if (jy < 0 || jy + JET_H > H - 30) return true;
      return false;
    };

    const loop = () => {
      const st = stateRef.current;
      if (!st) return;

      // Update jet
      if (st.jet.thrusting) st.jet.vy = Math.max(st.jet.vy + THRUST, -MAX_SPEED);
      else st.jet.vy = Math.min(st.jet.vy + GRAVITY, MAX_SPEED);
      st.jet.y += st.jet.vy;

      // Trail
      st.jet.trail.push({ x: st.jet.x, y: st.jet.y + JET_H / 2 });
      if (st.jet.trail.length > 18) st.jet.trail.shift();

      // Level scaling
      st.elapsed = (Date.now() - st.startTime) / 1000;
      st.level = Math.floor(st.elapsed / 20) + 1;
      st.speed = OBS_SPEED_BASE + (st.level - 1) * 0.5 + st.score * 0.003;

      // Spawn obstacles
      st.spawnTimer++;
      const spawnInterval = Math.max(55, 100 - st.level * 6);
      if (st.spawnTimer >= spawnInterval) { spawnObs(st); st.spawnTimer = 0; }

      // Move obstacles
      st.obstacles = st.obstacles.filter((o) => o.x > -OBS_W - 10);
      st.obstacles.forEach((o) => {
        o.x -= st.speed;
        if (!o.passed && o.x + OBS_W < st.jet.x) {
          o.passed = true;
          st.score += 10;
          st.obstaclesAvoided++;
          setScore(st.score);
        }
        if (checkCollision(st.jet, o)) {
          const duration = Math.floor(st.elapsed);
          cancelAnimationFrame(animRef.current);
          setGameState("dead");
          logEvent("collision", { score: st.score, obstaclesAvoided: st.obstaclesAvoided, duration });
          saveScore({ score: st.score, duration, obstaclesAvoided: st.obstaclesAvoided, level: st.level });
        }
      });

      // Stars parallax
      st.stars.forEach((s) => { s.x -= s.speed; if (s.x < 0) { s.x = W; s.y = Math.random() * H * 0.85; } });
      st.clouds.forEach((c) => { c.x -= c.speed; if (c.x < -c.w) c.x = W + c.w; });

      st.frameCount++;

      // --- DRAW ---
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#020817");
      grad.addColorStop(0.5, "#0c1a3d");
      grad.addColorStop(1, "#0f2952");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Stars
      st.stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,237,243,${s.alpha})`;
        ctx.fill();
      });

      // Clouds
      st.clouds.forEach((c) => {
        ctx.fillStyle = `rgba(56,189,248,${c.alpha})`;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w / 2, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ground
      const groundGrad = ctx.createLinearGradient(0, H - 30, 0, H);
      groundGrad.addColorStop(0, "#1e3a5f");
      groundGrad.addColorStop(1, "#0c1a3d");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, H - 30, W, 30);
      ctx.strokeStyle = "rgba(56,189,248,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();

      // Jet trail
      st.jet.trail.forEach((pt, i) => {
        const alpha = (i / st.jet.trail.length) * 0.5;
        const r = lerp(2, 6, i / st.jet.trail.length);
        const grad2 = ctx.createRadialGradient(pt.x - 8, pt.y, 0, pt.x - 8, pt.y, r * 2);
        grad2.addColorStop(0, `rgba(251,191,36,${alpha})`);
        grad2.addColorStop(1, "transparent");
        ctx.fillStyle = grad2;
        ctx.beginPath(); ctx.arc(pt.x - 8, pt.y, r * 2, 0, Math.PI * 2); ctx.fill();
      });

      // Obstacles
      st.obstacles.forEach((o) => {
        // Glow
        const obsGlow = ctx.createLinearGradient(o.x, 0, o.x + OBS_W, 0);
        obsGlow.addColorStop(0, "rgba(239,68,68,0.4)");
        obsGlow.addColorStop(0.5, "rgba(239,68,68,0.6)");
        obsGlow.addColorStop(1, "rgba(239,68,68,0.4)");
        ctx.fillStyle = obsGlow;
        // Top obstacle
        ctx.beginPath();
        ctx.roundRect(o.x - 3, 0, OBS_W + 6, o.topH, [0, 0, 6, 6]);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(o.x, 0, OBS_W, o.topH);

        // Bottom obstacle
        ctx.fillStyle = obsGlow;
        ctx.beginPath();
        ctx.roundRect(o.x - 3, o.botY, OBS_W + 6, o.botH + 4, [6, 6, 0, 0]);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(o.x, o.botY, OBS_W, o.botH);

        // Hazard stripes
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        for (let s = 0; s < o.topH; s += 20) ctx.fillRect(o.x, s, OBS_W, 10);
        for (let s = o.botY; s < H; s += 20) ctx.fillRect(o.x, s, OBS_W, 10);

        // Warning lights
        const pulse = 0.5 + 0.5 * Math.sin(st.frameCount * 0.1);
        ctx.fillStyle = `rgba(255,200,0,${pulse})`;
        ctx.beginPath(); ctx.arc(o.x + OBS_W / 2, o.topH, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(o.x + OBS_W / 2, o.botY, 5, 0, Math.PI * 2); ctx.fill();
      });

      // Jet body
      const jx = st.jet.x, jy = st.jet.y;
      const tilt = Math.min(Math.max(st.jet.vy * 2.5, -20), 20);

      ctx.save();
      ctx.translate(jx + JET_W / 2, jy + JET_H / 2);
      ctx.rotate((tilt * Math.PI) / 180);

      // Glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, JET_W);
      glow.addColorStop(0, "rgba(56,189,248,0.3)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(0, 0, JET_W, JET_H, 0, 0, Math.PI * 2); ctx.fill();

      // Body
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(JET_W / 2, 0);
      ctx.lineTo(-JET_W / 3, -JET_H / 2.5);
      ctx.lineTo(-JET_W / 2, 0);
      ctx.lineTo(-JET_W / 3, JET_H / 2.5);
      ctx.closePath();
      ctx.fill();

      // Wing
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-JET_W / 3, -JET_H / 1.5);
      ctx.lineTo(-JET_W / 2.2, JET_H / 1.5);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "#bae6fd";
      ctx.beginPath(); ctx.ellipse(JET_W / 6, -2, 10, 5, 0.3, 0, Math.PI * 2); ctx.fill();

      // Engine flame
      if (st.jet.thrusting) {
        const fl = 8 + Math.random() * 12;
        const flameGrad = ctx.createLinearGradient(-JET_W / 2, 0, -JET_W / 2 - fl, 0);
        flameGrad.addColorStop(0, "#fbbf24");
        flameGrad.addColorStop(0.5, "#f97316");
        flameGrad.addColorStop(1, "transparent");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-JET_W / 2, -5);
        ctx.lineTo(-JET_W / 2 - fl, 0);
        ctx.lineTo(-JET_W / 2, 5);
        ctx.closePath(); ctx.fill();
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.roundRect(16, 14, 160, 52, 10); ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 22px 'Courier New'";
      ctx.fillText(`⭐ ${st.score}`, 30, 42);
      ctx.fillStyle = "#8b949e";
      ctx.font = "11px 'Courier New'";
      ctx.fillText(`LVL ${st.level}  ${st.obstaclesAvoided} evaded`, 30, 58);

      // Speed indicator
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.roundRect(W - 120, 14, 104, 36, 10); ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.font = "12px 'Courier New'";
      ctx.fillText(`▶ ${st.speed.toFixed(1)} spd`, W - 108, 37);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, logEvent, saveScore]);

  // Draw idle/dead screens
  useEffect(() => {
    if (gameState === "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#020817"); grad.addColorStop(1, "#0f2952");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H * 0.85, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,237,243,${Math.random() * 0.6 + 0.2})`; ctx.fill();
    }

    ctx.textAlign = "center";
    if (gameState === "idle") {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 52px 'Courier New'";
      ctx.fillText("✈ JET DASH", W / 2, H / 2 - 50);
      ctx.fillStyle = "#8b949e";
      ctx.font = "16px 'Courier New'";
      ctx.fillText("HOLD [SPACE] or TAP to thrust", W / 2, H / 2 + 4);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "14px 'Courier New'";
      ctx.fillText("▼ CLICK LAUNCH BELOW ▼", W / 2, H / 2 + 36);
    } else if (gameState === "dead") {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 44px 'Courier New'";
      ctx.fillText("CRASHED!", W / 2, H / 2 - 60);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 34px 'Courier New'";
      ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 - 12);
      if (isNewHigh) {
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 20px 'Courier New'";
        ctx.fillText("🏆 NEW HIGH SCORE!", W / 2, H / 2 + 26);
      } else if (highScore > 0) {
        ctx.fillStyle = "#8b949e";
        ctx.font = "14px 'Courier New'";
        ctx.fillText(`Best: ${highScore}`, W / 2, H / 2 + 28);
      }
      ctx.fillStyle = saving ? "#8b949e" : "#38bdf8";
      ctx.font = "14px 'Courier New'";
      ctx.fillText(saving ? "Saving..." : "▼ PLAY AGAIN BELOW ▼", W / 2, H / 2 + 58);
    }
    ctx.textAlign = "left";
  }, [gameState, score, highScore, isNewHigh, saving]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ borderRadius: 12, border: "1px solid #1e3a5f", boxShadow: "0 0 40px rgba(56,189,248,0.12)", cursor: "pointer" }}
        onMouseDown={() => gameState === "playing" && handleTouch(true)}
        onMouseUp={() => handleTouch(false)}
        onTouchStart={(e) => { e.preventDefault(); gameState === "playing" && handleTouch(true); }}
        onTouchEnd={(e) => { e.preventDefault(); handleTouch(false); }}
      />

      <div style={{ display: "flex", gap: 12 }}>
        {(gameState === "idle" || gameState === "dead") && (
          <button
            style={{
              background: gameState === "dead" && saving ? "#1e3a5f" : "linear-gradient(90deg, #0ea5e9, #38bdf8)",
              border: "none", borderRadius: 10, padding: "14px 44px",
              color: gameState === "dead" && saving ? "#8b949e" : "#020817",
              fontSize: 16, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace", letterSpacing: 2,
              boxShadow: "0 4px 20px rgba(56,189,248,0.3)",
            }}
            onClick={!saving ? startGame : undefined}
          >
            {gameState === "idle" ? "🚀 LAUNCH" : saving ? "SAVING..." : "↩ FLY AGAIN"}
          </button>
        )}
        {gameState === "playing" && (
          <button
            style={{ background: "none", border: "1px solid #30363d", borderRadius: 10, padding: "14px 28px", color: "#8b949e", cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}
            onMouseDown={() => handleTouch(true)}
            onMouseUp={() => handleTouch(false)}
          >
            ▲ THRUST
          </button>
        )}
      </div>

      <p style={{ color: "#30363d", fontSize: 12, fontFamily: "monospace", margin: 0 }}>
        SPACE / ↑ arrow / Hold button or tap canvas to thrust
      </p>
    </div>
  );
}