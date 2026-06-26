"use client";

import React, { useState } from "react";
import styles from "@/styles/Dashboard.module.css";

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => void;
}

export default function FolderModal({ isOpen, onClose, onSubmit }: FolderModalProps) {
  const [folderName, setFolderName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    onSubmit(folderName);
    setFolderName("");
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} glass-panel`} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>New Folder</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input
            type="text"
            placeholder="Folder Name"
            className="form-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
            required
          />
          <div className={styles.modalActions}>
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="gradient-btn">
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
