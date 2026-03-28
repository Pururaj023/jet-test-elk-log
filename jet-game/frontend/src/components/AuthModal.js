import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.username, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button style={styles.close} onClick={onClose}>✕</button>
        <div style={styles.logo}>✈️</div>
        <h2 style={styles.title}>{mode === "login" ? "PILOT LOGIN" : "JOIN THE FLEET"}</h2>

        <form onSubmit={handle} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          {mode === "register" && (
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          )}
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "FLY IN →" : "TAKE OFF →"}
          </button>
        </form>

        <p style={styles.switch}>
          {mode === "login" ? "New pilot? " : "Have an account? "}
          <span style={styles.link} onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,20,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" },
  modal: { background: "linear-gradient(135deg, #0d1117, #161b22)", border: "1px solid #30363d", borderRadius: 16, padding: "40px 36px", width: 360, position: "relative", boxShadow: "0 0 60px rgba(56,189,248,0.15)" },
  close: { position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "#8b949e", fontSize: 18, cursor: "pointer" },
  logo: { textAlign: "center", fontSize: 44, marginBottom: 8 },
  title: { textAlign: "center", color: "#38bdf8", fontFamily: "'Courier New', monospace", letterSpacing: 3, fontSize: 18, marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "12px 14px", color: "#e6edf3", fontSize: 14, fontFamily: "inherit", outline: "none" },
  error: { color: "#f85149", fontSize: 13, margin: 0 },
  btn: { background: "linear-gradient(90deg, #0ea5e9, #38bdf8)", border: "none", borderRadius: 8, padding: "13px", color: "#0d1117", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 1, fontFamily: "'Courier New', monospace" },
  switch: { textAlign: "center", color: "#8b949e", fontSize: 13, marginTop: 16 },
  link: { color: "#38bdf8", cursor: "pointer", textDecoration: "underline" },
};