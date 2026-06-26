"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  File, Download, ShieldCheck, Eye, Edit3, Save, 
  Check, AlertTriangle, ShieldAlert, Sparkles
} from "lucide-react";
import styles from "@/styles/Editor.module.css";
import dashboardStyles from "@/styles/Dashboard.module.css";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

export default function PublicSharePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [doc, setDoc] = useState<any | null>(null);
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "editing" | "error">("saved");

  const editorRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) return;

    async function loadShareDetails() {
      try {
        const res = await fetch(`/api/share/${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "This share link is invalid or has expired.");
          setLoading(false);
          return;
        }

        setDoc(data.document);
        setRole(data.role);

        // Populate editor if rich text doc
        if (editorRef.current && data.document.content) {
          editorRef.current.innerHTML = data.document.content;
        }
      } catch (err) {
        setError("Network error loading shared document.");
      } finally {
        setLoading(false);
      }
    }

    loadShareDetails();
  }, [token]);

  // Handle Editing (autosaves for public links if role is EDITOR)
  const handleEditorInput = () => {
    if (role !== "EDITOR") return;

    setSaveStatus("editing");

    if (timerRef.current) clearTimeout(timerRef.current);
    
    setSaveStatus("saving");

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/share/${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editorRef.current?.innerHTML || "",
          }),
        });
        if (res.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        setSaveStatus("error");
      }
    }, 2000);
  };

  // Download shared file
  const handleDownload = () => {
    window.open(`/api/share/${token}?download=true`, "_blank");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)" }}>
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
        <p style={{ marginTop: "16px", color: "var(--text-secondary)" }}>Loading shared document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)", padding: "20px" }}>
        <div className="glass-panel" style={{ maxWidth: "440px", padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ color: "var(--color-danger)", display: "flex", justifyContent: "center" }}>
            <ShieldAlert size={48} />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 600 }}>Access Revoked</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>{error}</p>
          <button className="gradient-btn" onClick={() => router.push("/login")} style={{ justifyContent: "center", marginTop: "10px" }}>
            Sign In to Account
          </button>
        </div>
      </div>
    );
  }

  const isRichDoc = doc?.mimeType === "text/html";

  return (
    <div className={styles.layout} style={{ flexDirection: "column" }}>
      {/* Top Header bar */}
      <header className={styles.header} style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className={styles.docTitleSection}>
          <div className={dashboardStyles.iconWrapper} style={{ width: "36px", height: "36px", color: "var(--accent-secondary)", background: "rgba(168, 85, 247, 0.08)" }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className={styles.docTitle}>{doc?.title}</h1>
            <p className={styles.statusIndicator}>
              {isRichDoc ? (
                role === "EDITOR" ? (
                  saveStatus === "saved" ? (
                    <>
                      <Check size={12} style={{ color: "var(--color-success)" }} />
                      <span>Autosaved public editor</span>
                    </>
                  ) : saveStatus === "saving" ? (
                    <>
                      <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "1.5px" }}></div>
                      <span>Saving edits...</span>
                    </>
                  ) : (
                    <span>Editing...</span>
                  )
                ) : (
                  <>
                    <Eye size={12} style={{ color: "var(--accent-primary)" }} />
                    <span>Public View Only</span>
                  </>
                )
              ) : (
                <span>Public secure download link</span>
              )}
            </p>
          </div>
        </div>

        <div className={styles.editorActions}>
          {!isRichDoc ? (
            <button className="gradient-btn" onClick={handleDownload}>
              <Download size={16} />
              <span>Decrypt & Download</span>
            </button>
          ) : (
            role === "EDITOR" ? (
              <span style={{ fontSize: "0.85rem", color: "var(--color-success)", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <Edit3 size={12} />
                <span>LINK EDITOR ACTIVE</span>
              </span>
            ) : (
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                <Eye size={12} />
                <span>READ ONLY LINK</span>
              </span>
            )
          )}
        </div>
      </header>

      {/* Main Area */}
      <div className={styles.editorContainer} style={{ flex: 1 }}>
        {isRichDoc ? (
          <div 
            ref={editorRef}
            className={styles.editorPaper}
            contentEditable={role === "EDITOR"}
            onInput={handleEditorInput}
            suppressContentEditableWarning
            style={{ minHeight: "80vh" }}
          />
        ) : (
          <div className="glass-panel" style={{ width: "100%", maxWidth: "560px", margin: "80px auto", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center", height: "fit-content" }}>
            <div className={dashboardStyles.iconWrapper} style={{ width: "64px", height: "64px", fontSize: "2rem", color: "var(--accent-primary)", background: "rgba(99, 102, 241, 0.08)" }}>
              <File size={36} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>{doc?.title}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "6px" }}>
                Size: {(doc?.fileSize / 1024).toFixed(1)} KB • Type: {doc?.mimeType} • Uploaded {formatRelativeTime(doc?.updatedAt)}
              </p>
              {doc?.description && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "12px", background: "rgba(255,255,255,0.01)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                  &ldquo;{doc.description}&rdquo;
                </p>
              )}
            </div>
            <button className="gradient-btn" onClick={handleDownload} style={{ width: "100%", justifyContent: "center" }}>
              <Download size={18} />
              <span>Decrypt and Save File</span>
            </button>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Sparkles size={12} />
              <span>This file is encrypted at rest using AES-256 and will be decrypted on download.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
