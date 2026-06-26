"use client";

import React from "react";
import { Search } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  user: { id: string; name: string; email: string } | null;
}

export default function Header({ searchQuery, onSearchChange, user }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.searchBar}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search by title, description..."
          className={`form-input ${styles.searchInput}`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {user && (
        <div className={styles.userProfile}>
          <div className={styles.userInfo} style={{ alignItems: "flex-end" }}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
          <div className={styles.avatar}>
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
