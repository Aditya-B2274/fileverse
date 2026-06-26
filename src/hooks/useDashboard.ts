"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface DocItem {
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

export function useDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [folderHistory, setFolderHistory] = useState<{ id: string; title: string }[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [sharingDoc, setSharingDoc] = useState<DocItem | null>(null);
  const [activePermissions, setActivePermissions] = useState<any[]>([]);
  const [activeShareLinks, setActiveShareLinks] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    async function getSession() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!data.user) {
          router.push("/login");
        } else {
          setUser(data.user);
        }
      } catch (err) {
        router.push("/login");
      }
    }
    getSession();
  }, [router]);

  const loadDocs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let url = `/api/docs?`;
      if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}`;
      } else if (selectedTag) {
        url += `tag=${encodeURIComponent(selectedTag)}`;
      } else {
        url += `parentId=${currentFolderId}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Load documents error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId, searchQuery, selectedTag]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearFilters = () => {
    setSelectedTag(null);
    setSearchQuery("");
    setCurrentFolderId("root");
    setFolderHistory([]);
  };

  const handleCreateFolderSubmit = async (folderName: string) => {
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: folderName,
          isFolder: true,
          parentId: currentFolderId,
        }),
      });

      if (res.ok) {
        setShowFolderModal(false);
        loadDocs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateDocSubmit = async (title: string, description: string, tags: string) => {
    try {
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          isFolder: false,
          parentId: currentFolderId,
          content: "<h1>" + title + "</h1><p>Start collaborating here...</p>",
          tags: tagsArray,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowDocModal(false);
        router.push(`/doc/${data.document.id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFileToServer(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFileToServer(e.target.files[0]);
    }
  };

  const uploadFileToServer = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("parentId", currentFolderId);

    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        loadDocs();
      } else {
        alert("Upload failed. Security limits might apply.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const enterFolder = (id: string, title: string) => {
    const parentTitle = currentFolderId === "root" ? "All Files" : folderHistory[folderHistory.length - 1]?.title || "Parent";
    setFolderHistory([...folderHistory, { id: currentFolderId, title: parentTitle }]);
    setCurrentFolderId(id);
    setSelectedTag(null);
    setSearchQuery("");
  };

  const navigateBreadcrumb = (id: string, index: number) => {
    setCurrentFolderId(id);
    setFolderHistory(folderHistory.slice(0, index));
    setSelectedTag(null);
    setSearchQuery("");
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document? All version histories and files will be permanently erased.")) return;

    try {
      const res = await fetch(`/api/docs/${docId}`, { method: "DELETE" });
      if (res.ok) {
        loadDocs();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async (doc: DocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/docs/${doc.id}?download=true`, "_blank");
  };

  const openShareModal = async (doc: DocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSharingDoc(doc);
    setShowShareModal(true);
    try {
      const res = await fetch(`/api/docs/${doc.id}/share`);
      const data = await res.json();
      if (res.ok) {
        setActivePermissions(data.permissions || []);
        setActiveShareLinks(data.shareLinks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setSharingDoc(null);
  };

  const handleShareUserSubmit = async (email: string, role: string) => {
    if (!sharingDoc) return;
    try {
      const res = await fetch(`/api/docs/${sharingDoc.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share_user",
          email,
          role,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const updatedRes = await fetch(`/api/docs/${sharingDoc.id}/share`);
        const updatedData = await updatedRes.json();
        setActivePermissions(updatedData.permissions || []);
      } else {
        alert(data.error || "User sharing failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateShareLinkSubmit = async (role: string, expiresDays: string) => {
    if (!sharingDoc) return;
    try {
      const res = await fetch(`/api/docs/${sharingDoc.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share_link",
          role,
          expiresDays: Number(expiresDays),
        }),
      });

      if (res.ok) {
        const updatedRes = await fetch(`/api/docs/${sharingDoc.id}/share`);
        const updatedData = await updatedRes.json();
        setActiveShareLinks(updatedData.shareLinks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeUserSubmit = async (userId: string) => {
    if (!sharingDoc) return;
    try {
      const res = await fetch(`/api/docs/${sharingDoc.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_user",
          userId,
        }),
      });

      if (res.ok) {
        setActivePermissions(activePermissions.filter(p => p.userId !== userId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeLinkSubmit = async (linkId: string) => {
    if (!sharingDoc) return;
    try {
      const res = await fetch(`/api/docs/${sharingDoc.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_link",
          linkId,
        }),
      });

      if (res.ok) {
        setActiveShareLinks(activeShareLinks.filter(l => l.id !== linkId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    user,
    documents,
    currentFolderId,
    folderHistory,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    showFolderModal,
    setShowFolderModal,
    showDocModal,
    setShowDocModal,
    showShareModal,
    sharingDoc,
    activePermissions,
    activeShareLinks,
    loading,
    uploading,
    dragActive,
    handleLogout,
    handleClearFilters,
    handleCreateFolderSubmit,
    handleCreateDocSubmit,
    handleDrag,
    handleDrop,
    handleFileChange,
    enterFolder,
    navigateBreadcrumb,
    handleDelete,
    handleDownload,
    openShareModal,
    closeShareModal,
    handleShareUserSubmit,
    handleGenerateShareLinkSubmit,
    handleRevokeUserSubmit,
    handleRevokeLinkSubmit,
  };
}
