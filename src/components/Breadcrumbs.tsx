"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface BreadcrumbsProps {
  currentFolderId: string;
  folderHistory: { id: string; title: string }[];
  documentsLength: number;
  navigateBreadcrumb: (id: string, index: number) => void;
}

export default function Breadcrumbs({
  currentFolderId,
  folderHistory,
  documentsLength,
  navigateBreadcrumb,
}: BreadcrumbsProps) {
  return (
    <div className={styles.breadcrumbs}>
      <span 
        className={styles.breadcrumbLink} 
        onClick={() => navigateBreadcrumb("root", 0)}
      >
        All Files
      </span>
      {folderHistory.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          <span 
            className={styles.breadcrumbLink} 
            onClick={() => navigateBreadcrumb(folder.id, index + 1)}
          >
            {folder.title === "root" ? "All Files" : folder.title}
          </span>
        </React.Fragment>
      ))}
      {currentFolderId !== "root" && documentsLength > 0 && (
        <>
          <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-primary)" }}>Inside Folder</span>
        </>
      )}
    </div>
  );
}
