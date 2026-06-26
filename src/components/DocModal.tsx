"use client";

import React, { useState } from "react";
import styles from "@/styles/Dashboard.module.css";

interface DocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, tags: string) => void;
}

export default function DocModal({ isOpen, onClose, onSubmit }: DocModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title, description, tags);
    setTitle("");
    setDescription("");
    setTags("");
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} glass-panel`} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Create Collaboration Document</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Title</label>
            <input
              type="text"
              placeholder="Design Specification.html"
              className="form-input"
              style={{ marginTop: "4px" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Description</label>
            <input
              type="text"
              placeholder="Outline of the frontend components..."
              className="form-input"
              style={{ marginTop: "4px" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="design, project-alpha, team-spec"
              className="form-input"
              style={{ marginTop: "4px" }}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className={styles.modalActions}>
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="gradient-btn">
              Create and Edit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
