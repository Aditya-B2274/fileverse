"use client";

import React from "react";
import { Upload } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface UploadZoneProps {
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export default function UploadZone({
  dragActive,
  onDrag,
  onDrop,
}: UploadZoneProps) {
  return (
    <div 
      className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ""}`}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
    >
      <Upload size={32} className={styles.uploadIcon} />
      <div>
        <p style={{ fontWeight: 500 }}>Drag and drop files here to upload encrypted at rest</p>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>Supporting PDF, DOCX, Images, Text up to 10MB</p>
      </div>
    </div>
  );
}
