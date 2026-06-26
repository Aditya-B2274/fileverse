"use client";

import React from "react";
import { Folder, File, Download, Share2, Trash2 } from "lucide-react";
import styles from "@/styles/Dashboard.module.css";

interface DocItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  isFolder: boolean;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isEncrypted: boolean;
  fileSize: number;
  mimeType: string;
  owner: { id: string; name: string; email: string };
  tags: { id: string; name: string }[];
}

interface FileCardProps {
  doc: DocItem;
  currentUserId?: string;
  onCardClick: () => void;
  onDownload: (doc: DocItem, e: React.MouseEvent) => void;
  onShare: (doc: DocItem, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onTagClick: (tagName: string) => void;
}

function formatRelativeTime(dateString: string) {
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

export default function FileCard({
  doc,
  currentUserId,
  onCardClick,
  onDownload,
  onShare,
  onDelete,
  onTagClick,
}: FileCardProps) {
  return (
    <div className={`${styles.card} glass-panel`} onClick={onCardClick}>
      <div className={styles.cardHeader}>
        <div className={`${styles.iconWrapper} ${doc.isFolder ? styles.folderIcon : styles.fileIcon}`}>
          {doc.isFolder ? <Folder size={22} /> : <File size={22} />}
        </div>

        <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
          {!doc.isFolder && (
            <button className={styles.cardMenu} title="Download" onClick={(e) => onDownload(doc, e)}>
              <Download size={15} />
            </button>
          )}
          {currentUserId && doc.ownerId === currentUserId && (
            <>
              <button className={styles.cardMenu} title="Share settings" onClick={(e) => onShare(doc, e)}>
                <Share2 size={15} />
              </button>
              <button className={styles.cardMenu} title="Delete" onClick={(e) => onDelete(doc.id, e)}>
                <Trash2 size={15} style={{ color: "var(--color-danger)" }} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{doc.title}</h3>
        <p className={styles.cardMeta}>
          <span>By {doc.ownerId === currentUserId ? "Me" : doc.owner.name}</span>
          {!doc.isFolder && (
            <>
              <span>•</span>
              <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
            </>
          )}
          <span>•</span>
          <span title={new Date(doc.createdAt).toLocaleString()}>
            {formatRelativeTime(doc.createdAt)}
          </span>
        </p>

        {doc.tags && doc.tags.length > 0 && (
          <div className={styles.cardTags}>
            {doc.tags.map((t) => (
              <span
                key={t.id}
                className={styles.tagPill}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(t.name);
                }}
              >
                #{t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
