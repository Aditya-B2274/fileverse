"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, ShieldAlert, ShieldCheck } from "lucide-react";
import styles from "@/styles/Auth.module.css";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin ? { email, password } : { email, name, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Successful auth - redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError("Network error. Please verify your connection.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.authCard} glass-panel`}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <ShieldCheck size={32} strokeWidth={2.5} style={{ color: "#a855f7" }} />
            <span>FileVerse</span>
          </div>
          <h1 className={styles.title}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className={styles.subtitle}>
            {isLogin 
              ? "Access your secure documents from anywhere" 
              : "Start collaborating with secure file sharing"
            }
          </p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <ShieldAlert size={20} />
            <span>{error}</span>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {!isLogin && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Full Name</label>
              <div style={{ position: "relative" }}>
                <User size={18} className={styles.text_muted} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="form-input"
                  style={{ paddingLeft: "42px" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
              <input
                type="email"
                placeholder="you@example.com"
                className="form-input"
                style={{ paddingLeft: "42px" }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
              <input
                type="password"
                placeholder="••••••••"
                className="form-input"
                style={{ paddingLeft: "42px" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="gradient-btn" style={{ justifyContent: "center", marginTop: "10px", width: "100%" }} disabled={loading}>
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <span>{isLogin ? "Sign In" : "Sign Up"}</span>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <span>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <span
            className={styles.link}
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin ? "Create one" : "Sign in instead"}
          </span>
        </div>
      </div>
    </div>
  );
}
