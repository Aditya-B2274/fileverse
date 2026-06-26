"use client";

import React from "react";
import { ShieldCheck, FolderOpen, Tag, Search, X, LogOut } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface SidebarProps {
  selectedTag: string | null;
  searchQuery: string;
  onClearFilters: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  selectedTag,
  searchQuery,
  onClearFilters,
  onLogout,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <ShieldCheck size={28} style={{ color: "#a855f7" }} />
        <span>FileVerse</span>
      </div>

      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${!selectedTag && !searchQuery ? styles.navItemActive : ""}`}
          onClick={onClearFilters}
          style={{ background: "none", border: "none", width: "100%", textAlign: "left" }}
        >
          <FolderOpen size={20} />
          <span>Files Explorer</span>
        </button>

        <div style={{ margin: "24px 0 8px 0" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 600 }}>Active Filters</span>
        </div>

        {selectedTag && (
          <div className={`${styles.navItem} ${styles.navItemActive}`}>
            <Tag size={18} />
            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>Tag: {selectedTag}</span>
            <X size={14} style={{ marginLeft: "auto", cursor: "pointer" }} onClick={onClearFilters} />
          </div>
        )}

        {searchQuery && (
          <div className={`${styles.navItem} ${styles.navItemActive}`}>
            <Search size={18} />
            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>Search: &quot;{searchQuery.substring(0, 10)}...&quot;</span>
            <X size={14} style={{ marginLeft: "auto", cursor: "pointer" }} onClick={onClearFilters} />
          </div>
        )}

        {!selectedTag && !searchQuery && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "4px 16px" }}>
            No active filters
          </div>
        )}

        <button onClick={onLogout} className="secondary-btn" style={{ marginTop: "auto", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--color-danger)", width: "100%" }}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </nav>
    </aside>
  );
}
