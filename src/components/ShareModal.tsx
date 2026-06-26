"use client";

import React, { useState } from "react";
import { X, UserPlus, Globe, Trash2 } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface DocItem {
  id: string;
  title: string;
  isFolder: boolean;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: DocItem | null;
  permissions: any[];
  shareLinks: any[];
  onShareUser: (email: string, role: string) => void;
  onGenerateLink: (role: string, expiresDays: string) => void;
  onRevokeUser: (userId: string) => void;
  onRevokeLink: (linkId: string) => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  doc,
  permissions,
  shareLinks,
  onShareUser,
  onGenerateLink,
  onRevokeUser,
  onRevokeLink,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("VIEWER");
  
  const [linkRole, setLinkRole] = useState("VIEWER");
  const [linkExpiry, setLinkExpiry] = useState("7");

  if (!isOpen || !doc) return null;

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onShareUser(email, userRole);
    setEmail("");
  };

  const copyLink = (token: string) => {
    const fullUrl = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(fullUrl);
    alert("Share link copied to clipboard!");
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} glass-panel`} style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className={styles.modalTitle}>Share &ldquo;{doc.title}&rdquo;</h3>
          <X size={20} style={{ cursor: "pointer", color: "var(--text-secondary)" }} onClick={onClose} />
        </div>

        {/* Part 1: Invite Collaborators */}
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "20px" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <UserPlus size={16} />
            <span>Invite Collaborators</span>
          </h4>
          <form onSubmit={handleShareSubmit} style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              placeholder="collaborator@example.com"
              className="form-input"
              style={{ flex: 1 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select
              className="form-input"
              style={{ width: "110px", padding: "8px" }}
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
            <button type="submit" className="gradient-btn" style={{ padding: "8px 16px" }}>
              Invite
            </button>
          </form>
        </div>

        {/* Part 2: Public Share Links */}
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "20px" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Globe size={16} />
            <span>Create Public Shareable Link</span>
          </h4>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", gap: "8px" }}>
              <select
                className="form-input"
                style={{ padding: "8px" }}
                value={linkRole}
                onChange={(e) => setLinkRole(e.target.value)}
              >
                <option value="VIEWER">Can View</option>
                <option value="EDITOR">Can Edit</option>
              </select>
              <select
                className="form-input"
                style={{ padding: "8px" }}
                value={linkExpiry}
                onChange={(e) => setLinkExpiry(e.target.value)}
              >
                <option value="1">Expires in 1 day</option>
                <option value="7">Expires in 7 days</option>
                <option value="30">Expires in 30 days</option>
                <option value="0">Never Expires</option>
              </select>
            </div>
            <button
              type="button"
              className="secondary-btn"
              style={{ padding: "8px 16px" }}
              onClick={() => onGenerateLink(linkRole, linkExpiry)}
            >
              Generate Link
            </button>
          </div>
        </div>

        {/* Part 3: Active permissions lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "200px", overflowY: "auto" }}>
          <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>Active Collaborators & Links</h4>

          {/* Users */}
          {permissions.map((perm) => (
            <div key={perm.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "6px" }}>
              <div>
                <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{perm.user.name}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>({perm.user.email})</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={styles.tagPill} style={{ fontSize: "0.75rem" }}>{perm.role}</span>
                <Trash2 size={14} style={{ color: "var(--color-danger)", cursor: "pointer" }} onClick={() => onRevokeUser(perm.user.id)} />
              </div>
            </div>
          ))}

          {/* Links */}
          {shareLinks.map((link) => (
            <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "6px" }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--accent-primary)", textDecoration: "underline", cursor: "pointer" }} onClick={() => copyLink(link.token)}>
                  Copy Share Token ({link.role.toLowerCase()})
                </span>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {link.expiresAt ? `Expires: ${new Date(link.expiresAt).toLocaleDateString()}` : "Never Expires"}
                </div>
              </div>
              <Trash2 size={14} style={{ color: "var(--color-danger)", cursor: "pointer", flexShrink: 0 }} onClick={() => onRevokeLink(link.id)} />
            </div>
          ))}

          {permissions.length === 0 && shareLinks.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
              This document is private and not shared yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
