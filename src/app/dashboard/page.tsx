"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { File } from "lucide-react";

// Import custom components
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FileCard from "@/components/FileCard";
import FolderModal from "@/components/FolderModal";
import DocModal from "@/components/DocModal";
import ShareModal from "@/components/ShareModal";
import Breadcrumbs from "@/components/Breadcrumbs";
import Toolbar from "@/components/Toolbar";
import UploadZone from "@/components/UploadZone";

// Import custom state hook
import { useDashboard } from "@/hooks/useDashboard";

import styles from "@/styles/Dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();

  const {
    user, documents, currentFolderId, folderHistory,
    searchQuery, setSearchQuery,
    selectedTag, setSelectedTag,
    showFolderModal, setShowFolderModal,
    showDocModal, setShowDocModal, showShareModal, sharingDoc,
    activePermissions, activeShareLinks,
    loading, dragActive,

    handleLogout, handleClearFilters, handleCreateFolderSubmit, handleCreateDocSubmit,
    handleDrag, handleDrop, handleFileChange, enterFolder, navigateBreadcrumb,
    handleDelete, handleDownload, openShareModal, closeShareModal,
    handleShareUserSubmit, handleGenerateShareLinkSubmit, handleRevokeUserSubmit, handleRevokeLinkSubmit,
  } = useDashboard();

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <Sidebar
        selectedTag={selectedTag}
        searchQuery={searchQuery}
        onClearFilters={handleClearFilters}
        onLogout={handleLogout}
      />

      {/* Workspace */}
      <main className={styles.workspace}>
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setSelectedTag(null);
          }}
          user={user}
        />

        {/* Content Pane */}
        <section className={styles.content}>
          <div className={styles.toolbar}>
            {/* Folder breadcrumbs */}
            <Breadcrumbs
              currentFolderId={currentFolderId}
              folderHistory={folderHistory}
              documentsLength={documents.length}
              navigateBreadcrumb={navigateBreadcrumb}
            />

            {/* Quick Actions */}
            <Toolbar
              onNewFolder={() => setShowFolderModal(true)}
              onCreateDoc={() => setShowDocModal(true)}
              onFileChange={handleFileChange}
            />
          </div>

          {/* Drag & drop zone */}
          <UploadZone
            dragActive={dragActive}
            onDrag={handleDrag}
            onDrop={handleDrop}
          />

          {/* Loading or File Grid */}
          <div>
            <h2 className={styles.sectionTitle}>
              {searchQuery ? "Search Results" : selectedTag ? `Files tagged "${selectedTag}"` : "Documents & Folders"}
            </h2>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
                <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
              </div>
            ) : documents.length === 0 ? (
              <div className={styles.emptyState}>
                <File size={48} className={styles.emptyStateIcon} />
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: "1.1rem" }}>No items found</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "4px" }}>Create a folder, rich doc, or drop a file to begin.</p>
                </div>
              </div>
            ) : (
              <div className={styles.grid}>
                {documents.map((doc) => (
                  <FileCard
                    key={doc.id}
                    doc={doc}
                    currentUserId={user?.id}
                    onCardClick={() => {
                      if (doc.isFolder) {
                        enterFolder(doc.id, doc.title);
                      } else {
                        router.push(`/doc/${doc.id}`);
                      }
                    }}
                    onDownload={handleDownload}
                    onShare={openShareModal}
                    onDelete={handleDelete}
                    onTagClick={(name) => setSelectedTag(name)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modals */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onSubmit={handleCreateFolderSubmit}
      />

      <DocModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        onSubmit={handleCreateDocSubmit}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={closeShareModal}
        doc={sharingDoc}
        permissions={activePermissions}
        shareLinks={activeShareLinks}
        onShareUser={handleShareUserSubmit}
        onGenerateLink={handleGenerateShareLinkSubmit}
        onRevokeUser={handleRevokeUserSubmit}
        onRevokeLink={handleRevokeLinkSubmit}
      />
    </div>
  );
}
