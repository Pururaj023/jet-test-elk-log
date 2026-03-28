import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import JetGame from "./components/JetGame";
import AuthModal from "./components/AuthModal";
import Profile from "./components/Profile";
import "./app.css";

function AppInner() {
  const { user, token, loading, refreshProfile } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={s.loadingText}>✈ LOADING...</div>
      </div>
    );
  }

  return (
    <div style={s.app}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.brand}>
          <span style={s.brandIcon}>✈</span>
          <span style={s.brandText}>JET DASH</span>
          <span style={s.brandSub}>ARCADE</span>
        </div>

        <div style={s.nav}>
          {user ? (
            <>
              <div style={s.userBadge}>
                <span style={s.userDot}></span>
                <span style={s.userName}>{user.username}</span>
                <span style={s.userScore}>⭐ {user.highScore}</span>
              </div>
              <button style={s.btnSecondary} onClick={() => setShowProfile(true)}>
                PROFILE
              </button>
            </>
          ) : (
            <button style={s.btnPrimary} onClick={() => setShowAuth(true)}>
              LOGIN / REGISTER
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={s.main}>
        {!user && (
          <div style={s.guestBanner}>
            <span style={s.guestIcon}>💡</span>
            <span>
              Playing as guest — scores won't be saved.{" "}
              <span style={s.guestLink} onClick={() => setShowAuth(true)}>
                Login to track your progress →
              </span>
            </span>
          </div>
        )}

        <JetGame token={token} onRefreshProfile={refreshProfile} />
      </main>

      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
    </div>
  );
}

const s = {
  app: { minHeight: "100vh", background: "#020817", color: "#e6edf3", fontFamily: "'Courier New', monospace" },
  loading: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#020817" },
  loadingText: { color: "#38bdf8", fontSize: 20, letterSpacing: 4, animation: "pulse 1s infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid #0c1a3d", background: "rgba(2,8,23,0.9)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100 },
  brand: { display: "flex", alignItems: "baseline", gap: 8 },
  brandIcon: { fontSize: 24 },
  brandText: { fontSize: 22, fontWeight: 700, color: "#38bdf8", letterSpacing: 4 },
  brandSub: { fontSize: 10, color: "#30363d", letterSpacing: 3 },
  nav: { display: "flex", alignItems: "center", gap: 12 },
  userBadge: { display: "flex", alignItems: "center", gap: 8, background: "rgba(56,189,248,0.08)", border: "1px solid #1e3a5f", borderRadius: 8, padding: "6px 14px" },
  userDot: { width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block" },
  userName: { color: "#e6edf3", fontSize: 13 },
  userScore: { color: "#fbbf24", fontSize: 13 },
  btnPrimary: { background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", border: "none", borderRadius: 8, padding: "9px 20px", color: "#020817", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12, letterSpacing: 1 },
  btnSecondary: { background: "none", border: "1px solid #30363d", borderRadius: 8, padding: "9px 20px", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: 12, letterSpacing: 1 },
  main: { display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: 16 },
  guestBanner: { background: "rgba(56,189,248,0.06)", border: "1px solid #1e3a5f", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: "#8b949e", display: "flex", alignItems: "center", gap: 10 },
  guestIcon: { fontSize: 16 },
  guestLink: { color: "#38bdf8", cursor: "pointer", textDecoration: "underline" },
};

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}