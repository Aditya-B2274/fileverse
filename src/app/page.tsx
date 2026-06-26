"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, ArrowRight, Cpu
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          router.push("/dashboard");
        } else {
          setChecking(false);
        }
      } catch (err) {
        setChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)" }}>
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% -10%, rgba(99, 102, 241, 0.15) 0%, transparent 60%), radial-gradient(circle at 10% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%), var(--bg-primary)",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Landing Header */}
      <header style={{ height: "80px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 80px", borderBottom: "1px solid var(--border-color)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-primary)" }}>
          <ShieldCheck size={32} style={{ color: "#a855f7" }} />
          <span>FileVerse</span>
        </div>
        <button className="secondary-btn" onClick={() => router.push("/login")}>
          <span>Sign In</span>
          <ArrowRight size={16} />
        </button>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px", gap: "60px", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="animate-slide-up" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", maxWidth: "800px" }}>


          <h1 style={{ fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Secure Storage, Real-Time Collaboration &{" "}
            <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Total Encryption
            </span>
          </h1>



          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            <button className="gradient-btn" style={{ padding: "14px 28px", fontSize: "1.05rem" }} onClick={() => router.push("/login")}>
              <span>Enter Workspace</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "30px 80px", display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <span>© 2026 FileVerse.</span>

      </footer>
    </div>
  );
}
