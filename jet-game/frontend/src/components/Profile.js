import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Profile({ onClose }) {
  const { user, token, logout } = useAuth();
  const [logs, setLogs] = useState([]);
  const [esStatus, setEsStatus] = useState(null);
  const [tab, setTab] = useState("scores");
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLogs();
    fetchLeaderboard();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/game/logs", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLogs(data.logs || []);
      setEsStatus(data.elasticsearchStatus);
    } catch {}
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/game/leaderboard");
      const data = await res.json();
      setLeaderboard(data);
    } catch {}
  };

  const formatDate = (iso) => new Date(iso).toLocaleString();
  const formatDur = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        <div style={s.header}>
          <div>
            <div style={s.pilotBadge}>✈ PILOT PROFILE</div>
            <h2 style={s.name}>{user?.username}</h2>
            <p style={s.email}>{user?.email}</p>
          </div>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.stats}>
          <Stat label="HIGH SCORE" value={user?.highScore || 0} accent="#fbbf24" />
          <Stat label="TOTAL GAMES" value={user?.totalGames || 0} accent="#34d399" />
          <Stat label="MEMBER SINCE" value={user?.memberSince ? new Date(user.memberSince).toLocaleDateString() : "-"} accent="#a78bfa" small />
        </div>

        {/* ES Status */}
        <div style={s.esBar}>
          <span style={{ color: esStatus?.isConnected ? "#34d399" : "#f85149" }}>
            ● {esStatus?.isConnected ? "Elasticsearch Connected" : "Elasticsearch Offline"}
          </span>
          {!esStatus?.isConnected && (
            <span style={{ color: "#8b949e", fontSize: 11 }}> (logs in memory: {esStatus?.memoryLogCount || 0})</span>
          )}
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {["scores", "leaderboard", "logs"].map((t) => (
            <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={s.content}>
          {tab === "scores" && (
            <div>
              {user?.recentScores?.length ? user.recentScores.map((sc, i) => (
                <div key={i} style={s.row}>
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ color: "#fbbf24" }}>⭐ {sc.score}</span>
                  <span style={{ color: "#8b949e" }}>⏱ {formatDur(sc.duration)}</span>
                  <span style={{ color: "#34d399" }}>🛡 {sc.obstaclesAvoided}</span>
                  <span style={{ color: "#8b949e", fontSize: 11 }}>{formatDate(sc.playedAt)}</span>
                </div>
              )) : <p style={s.empty}>No games played yet. Take off!</p>}
            </div>
          )}

          {tab === "leaderboard" && (
            <div>
              {leaderboard.map((p, i) => (
                <div key={i} style={{ ...s.row, background: p.username === user?.username ? "rgba(56,189,248,0.08)" : "transparent" }}>
                  <span style={{ color: ["#fbbf24", "#9ca3af", "#cd7f32"][i] || "#8b949e", fontWeight: 700, width: 24 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span style={{ color: "#e6edf3", flex: 1 }}>{p.username}</span>
                  <span style={{ color: "#fbbf24" }}>⭐ {p.highScore}</span>
                  <span style={{ color: "#8b949e", fontSize: 12 }}>{p.totalGames} games</span>
                </div>
              ))}
            </div>
          )}

          {tab === "logs" && (
            <div style={{ fontFamily: "monospace" }}>
              {logs.slice(0, 30).map((log, i) => (
                <div key={i} style={{ ...s.logRow, color: log.level === "warn" ? "#f85149" : "#8b949e" }}>
                  <span style={{ color: "#30363d" }}>{formatDate(log["@timestamp"])} </span>
                  <span style={{ color: log.level === "warn" ? "#f85149" : "#38bdf8" }}>[{log.level?.toUpperCase()}] </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button style={s.logout} onClick={() => { logout(); onClose(); }}>LOGOUT</button>
      </div>
    </div>
  );
}

const Stat = ({ label, value, accent, small }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ color: accent, fontSize: small ? 16 : 28, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{value}</div>
    <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: 1 }}>{label}</div>
  </div>
);

const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,20,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(8px)" },
  panel: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 16, width: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 80px rgba(56,189,248,0.1)" },
  header: { display: "flex", justifyContent: "space-between", padding: "24px 28px 0", background: "linear-gradient(135deg, #161b22, #0d1117)" },
  pilotBadge: { color: "#38bdf8", fontSize: 11, letterSpacing: 3, fontFamily: "monospace" },
  name: { color: "#e6edf3", fontSize: 26, margin: "6px 0 2px", fontFamily: "monospace" },
  email: { color: "#8b949e", fontSize: 13, margin: 0 },
  close: { background: "none", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer", alignSelf: "flex-start", marginTop: -4 },
  stats: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "20px 28px", borderBottom: "1px solid #21262d" },
  esBar: { padding: "8px 28px", background: "#0d1117", fontSize: 12, borderBottom: "1px solid #21262d", fontFamily: "monospace" },
  tabs: { display: "flex", borderBottom: "1px solid #21262d" },
  tab: { flex: 1, padding: "12px", background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontFamily: "monospace", fontSize: 12, letterSpacing: 1 },
  tabActive: { color: "#38bdf8", borderBottom: "2px solid #38bdf8", marginBottom: -1 },
  content: { flex: 1, overflowY: "auto", padding: "8px 0" },
  row: { display: "flex", gap: 16, padding: "10px 28px", alignItems: "center", borderBottom: "1px solid #161b22", fontSize: 14 },
  logRow: { padding: "4px 16px", fontSize: 11, borderBottom: "1px solid #0d1117" },
  empty: { textAlign: "center", color: "#8b949e", padding: "40px", fontFamily: "monospace" },
  logout: { margin: "16px 28px", padding: "10px", background: "none", border: "1px solid #f85149", borderRadius: 8, color: "#f85149", cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 },
};