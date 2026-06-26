"use client";

import React from "react";
import { FolderPlus, FilePlus, Upload } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface ToolbarProps {
  onNewFolder: () => void;
  onCreateDoc: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Toolbar({
  onNewFolder,
  onCreateDoc,
  onFileChange,
}: ToolbarProps) {
  return (
    <div className={styles.actions}>
      <button className="secondary-btn" onClick={onNewFolder}>
        <FolderPlus size={16} style={{ color: "#f59e0b" }} />
        <span>New Folder</span>
      </button>
      
      <button className="secondary-btn" onClick={onCreateDoc}>
        <FilePlus size={16} style={{ color: "var(--accent-primary)" }} />
        <span>Create Doc</span>
      </button>

      <label className="gradient-btn" style={{ cursor: "pointer" }}>
        <Upload size={16} />
        <span>Upload File</span>
        <input 
          type="file" 
          style={{ display: "none" }} 
          onChange={onFileChange}
        />
      </label>
    </div>
  );
}
