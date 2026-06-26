"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, Save, Users, History, Activity, Share2, 
  Bold, Italic, Underline, Heading1, Heading2, AlignLeft, 
  X, Check, AlertTriangle, ShieldAlert
} from "lucide-react";
import styles from "@/styles/Editor.module.css";
import dashboardStyles from "@/styles/Dashboard.module.css";

interface VersionItem {
  id: string;
  versionIndex: number;
  changeSummary: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function DocumentEditorPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [doc, setDoc] = useState<any | null>(null);
  const [role, setRole] = useState<"OWNER" | "EDITOR" | "VIEWER">("VIEWER");
  
  // Real-time states
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "editing" | "error">("saved");

  // Drawers
  const [activeDrawer, setActiveDrawer] = useState<"versions" | "audit" | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Checkpoint Modal
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointSummary, setCheckpointSummary] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isIncomingEdit = useRef<boolean>(false);

  // Check auth and fetch document
  useEffect(() => {
    async function loadEditorData() {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        if (!userData.user) {
          router.push("/login");
          return;
        }
        setUser(userData.user);

        // Fetch doc details
        const docRes = await fetch(`/api/docs/${docId}`);
        const docData = await docRes.json();
        if (!docRes.ok) {
          router.push("/dashboard");
          return;
        }

        setDoc(docData.document);
        
        // Determine role
        if (docData.document.ownerId === userData.user.id) {
          setRole("OWNER");
        } else {
          const perm = docData.document.permissions?.find((p: any) => p.userId === userData.user.id);
          setRole(perm ? (perm.role as any) : "VIEWER");
        }

        // Set initial editor content
        if (editorRef.current) {
          editorRef.current.innerHTML = docData.document.content || "<h1>Untitled Document</h1><p>Start collaborating...</p>";
        }
      } catch (err) {
        console.error(err);
        router.push("/dashboard");
      }
    }
    loadEditorData();
  }, [docId, router]);

  // Connect WebSockets for Real-time Collaboration
  useEffect(() => {
    if (!user || !docId) return;

    let socket: WebSocket | null = null;

    async function initWS() {
      try {
        // Fetch JWT token securely from backend for handshake
        const tokenRes = await fetch("/api/auth/token");
        const tokenData = await tokenRes.json();
        if (!tokenData.token) return;

        // Connect to companion WebSocket server
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const defaultWsUrl = `${wsProtocol}//${window.location.hostname}:3001`;
        const wsServerUrl = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl;
        const wsUrl = `${wsServerUrl}?token=${encodeURIComponent(tokenData.token)}&docId=${docId}`;
        
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("WebSocket collaboration session connected");
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === "presence") {
              setActiveUsers(message.users);
            } else if (message.type === "edit") {
              // Remote edit received, update content area
              if (editorRef.current && editorRef.current.innerHTML !== message.content) {
                isIncomingEdit.current = true;
                editorRef.current.innerHTML = message.content;
                isIncomingEdit.current = false;
                setSaveStatus("saved");
              }
            }
          } catch (e) {
            console.error("WS parse error:", e);
          }
        };

        socket.onclose = () => {
          console.log("WebSocket session disconnected");
        };
      } catch (err) {
        console.error("WS init failed:", err);
      }
    }

    initWS();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [user, docId]);

  // Sync edits to other users over WS
  const handleEditorInput = () => {
    if (isIncomingEdit.current || role === "VIEWER") return;

    setSaveStatus("editing");

    // Broadcast edit over WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "edit",
          content: editorRef.current?.innerHTML || "",
        })
      );
    }

    // Debounced autosave to DB (saves active content to Document)
    triggerAutosave();
  };

  // Autosave setup (de-bounced)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAutosave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setSaveStatus("saving");

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editorRef.current?.innerHTML || "",
          }),
        });
        if (res.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        setSaveStatus("error");
      }
    }, 2000); // Autosave after 2 seconds of inactivity
  };

  // Text Formatting Helpers
  const formatText = (command: string, value: string = "") => {
    if (role === "VIEWER") return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleEditorInput();
  };

  // Save Checkpoint Version
  const handleSaveCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointSummary.trim() || role === "VIEWER") return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/docs/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkpoint",
          content: editorRef.current?.innerHTML || "",
          changeSummary: checkpointSummary,
        }),
      });

      if (res.ok) {
        setCheckpointSummary("");
        setShowCheckpointModal(false);
        setSaveStatus("saved");
        if (activeDrawer === "versions") {
          loadVersions();
        }
      } else {
        setSaveStatus("error");
      }
    } catch (e) {
      setSaveStatus("error");
    }
  };

  // Load Version History drawer data
  const loadVersions = async () => {
    try {
      const res = await fetch(`/api/docs/${docId}/versions`);
      const data = await res.json();
      if (res.ok) {
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Audit Logs drawer data
  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`/api/docs/${docId}/audit`);
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Rollback
  const handleRollback = async (versionId: string) => {
    if (role === "VIEWER") return;
    if (!confirm("Are you sure you want to rollback to this version? This will generate a new checkpoint version in the timeline.")) return;

    try {
      const res = await fetch(`/api/docs/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          versionId,
        }),
      });

      if (res.ok) {
        // Retrieve updated details
        const docRes = await fetch(`/api/docs/${docId}`);
        const docData = await docRes.json();
        if (res.ok && editorRef.current) {
          editorRef.current.innerHTML = docData.document.content || "";
          // Broadcast rollback update over WS
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: "edit",
                content: docData.document.content || "",
              })
            );
          }
        }
        loadVersions();
        alert("Rollback successful!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle drawers
  const toggleDrawer = (drawerType: "versions" | "audit") => {
    if (activeDrawer === drawerType) {
      setActiveDrawer(null);
    } else {
      setActiveDrawer(drawerType);
      if (drawerType === "versions") loadVersions();
      if (drawerType === "audit") loadAuditLogs();
    }
  };

  return (
    <div className={styles.layout}>
      {/* Main Workspace Section */}
      <section className={styles.mainSection}>
        {/* Editor Top Navigation */}
        <header className={styles.header}>
          <div className={styles.docTitleSection}>
            <button className={dashboardStyles.cardMenu} style={{ marginRight: "10px" }} onClick={() => router.push("/dashboard")} title="Back to Dashboard">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className={styles.docTitle}>{doc ? doc.title : "Loading Document..."}</h1>
              <div className={styles.statusIndicator}>
                {saveStatus === "saved" && (
                  <>
                    <Check size={12} style={{ color: "var(--color-success)" }} />
                    <span>All changes saved to cloud</span>
                  </>
                )}
                {saveStatus === "saving" && (
                  <>
                    <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "1.5px" }}></div>
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === "editing" && (
                  <span>Editing...</span>
                )}
                {saveStatus === "error" && (
                  <>
                    <AlertTriangle size={12} style={{ color: "var(--color-danger)" }} />
                    <span>Error saving changes</span>
                  </>
                )}
                {role === "VIEWER" && (
                  <span style={{ color: "var(--color-warning)", background: "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 600 }}>VIEW ONLY</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Real-time users presence */}
            <div className={styles.presenceSection}>
              {activeUsers.map((u, i) => (
                <div 
                  key={u.userId} 
                  className={styles.avatarCircle} 
                  style={{ 
                    background: `hsl(${(i * 137) % 360}, 65%, 45%)`, 
                    zIndex: 10 - i 
                  }}
                  title={`${u.name} (${u.email})`}
                >
                  {u.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
              ))}
              {activeUsers.length > 0 && (
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: "8px" }}>
                  {activeUsers.length} editing
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className={styles.editorActions}>
              {role !== "VIEWER" && (
                <button className="gradient-btn" onClick={() => setShowCheckpointModal(true)} style={{ padding: "8px 14px" }}>
                  <Save size={16} />
                  <span>Create Checkpoint</span>
                </button>
              )}

              <button className={`secondary-btn ${activeDrawer === "versions" ? dashboardStyles.navItemActive : ""}`} style={{ padding: "8px 14px" }} onClick={() => toggleDrawer("versions")}>
                <History size={16} />
                <span>Version History</span>
              </button>

              <button className={`secondary-btn ${activeDrawer === "audit" ? dashboardStyles.navItemActive : ""}`} style={{ padding: "8px 14px" }} onClick={() => toggleDrawer("audit")}>
                <Activity size={16} />
                <span>Audit Logs</span>
              </button>
            </div>
          </div>
        </header>

        {/* Text styling toolbar */}
        {role !== "VIEWER" && (
          <div style={{ display: "flex", gap: "6px", padding: "8px 30px", borderBottom: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.01)" }}>
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("bold")} title="Bold">
              <Bold size={16} />
            </button>
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("italic")} title="Italic">
              <Italic size={16} />
            </button>
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("underline")} title="Underline">
              <Underline size={16} />
            </button>
            <div style={{ width: "1px", background: "var(--border-color)", margin: "0 4px" }} />
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("formatBlock", "h1")} title="Heading 1">
              <Heading1 size={16} />
            </button>
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("formatBlock", "h2")} title="Heading 2">
              <Heading2 size={16} />
            </button>
            <button className={dashboardStyles.cardMenu} onClick={() => formatText("formatBlock", "p")} title="Paragraph">
              <AlignLeft size={16} />
            </button>
          </div>
        )}

        {/* Document Editing Area */}
        <div className={styles.editorContainer}>
          <div 
            ref={editorRef}
            className={styles.editorPaper}
            contentEditable={role !== "VIEWER"}
            onInput={handleEditorInput}
            suppressContentEditableWarning
          />
        </div>
      </section>

      {/* DRAWERS PANEL (Version History or Audit Logs) */}
      {activeDrawer && (
        <aside className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <h3 className={styles.drawerTitle}>
              {activeDrawer === "versions" ? (
                <>
                  <History size={18} style={{ color: "var(--accent-primary)" }} />
                  <span>Version History</span>
                </>
              ) : (
                <>
                  <Activity size={18} style={{ color: "var(--accent-secondary)" }} />
                  <span>Document Audit Logs</span>
                </>
              )}
            </h3>
            <X size={20} style={{ cursor: "pointer", color: "var(--text-secondary)" }} onClick={() => setActiveDrawer(null)} />
          </div>

          <div className={styles.drawerContent}>
            {activeDrawer === "versions" ? (
              // Versions history timeline list
              versions.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center", paddingTop: "40px" }}>No version history checkpoints found.</div>
              ) : (
                versions.map((ver) => (
                  <div key={ver.id} className={styles.versionItem}>
                    <div className={styles.versionHeader}>
                      <span className={styles.versionIndex}>v{ver.versionIndex}</span>
                      <span className={styles.versionMeta}>{new Date(ver.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.versionMeta}>By {ver.createdBy.name}</div>
                    {ver.changeSummary && <div className={styles.versionSummary}>&quot;{ver.changeSummary}&quot;</div>}
                    
                    {role !== "VIEWER" && (
                      <button className="secondary-btn rollbackBtn" onClick={() => handleRollback(ver.id)}>
                        Rollback here
                      </button>
                    )}
                  </div>
                ))
              )
            ) : (
              // Audit logging timeline list
              auditLogs.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center", paddingTop: "40px" }}>No activity logs recorded.</div>
              ) : (
                auditLogs.map((log) => {
                  let parsedDetails = {};
                  try {
                    parsedDetails = JSON.parse(log.details);
                  } catch (e) {}

                  return (
                    <div key={log.id} className={styles.auditItem}>
                      <div className={`${styles.auditIndicator} ${
                        ["UPLOAD", "CREATE_DOC", "CHECKPOINT"].includes(log.action) 
                          ? styles.auditIndicatorSuccess 
                          : ["DELETE", "REVOKE_USER", "REVOKE_LINK"].includes(log.action)
                            ? styles.auditIndicatorWarning 
                            : ""
                      }`} />
                      <div className={styles.auditContent}>
                        <span className={styles.auditAction}>{log.action.replace("_", " ")}</span>
                        <span className={styles.auditMeta}>
                          {log.user ? log.user.name : "Anonymous Link"} • {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <span className={styles.auditDetails}>
                          {JSON.stringify(parsedDetails)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </aside>
      )}

      {/* COMMIT CHECKPOINT VERSION MODAL */}
      {showCheckpointModal && (
        <div className={dashboardStyles.modalOverlay} onClick={() => setShowCheckpointModal(false)}>
          <div className={`${dashboardStyles.modal} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <h3 className={dashboardStyles.modalTitle}>Save Document Checkpoint</h3>
            <form onSubmit={handleSaveCheckpoint} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Describe the changes you are saving. This creates a permanent version in the document timeline that you can roll back to at any time.
              </p>
              <input 
                type="text" 
                placeholder="e.g. Added section on API endpoints, fixed typography" 
                className="form-input"
                value={checkpointSummary}
                onChange={(e) => setCheckpointSummary(e.target.value)}
                autoFocus
                required
              />
              <div className={dashboardStyles.modalActions}>
                <button type="button" className="secondary-btn" onClick={() => setShowCheckpointModal(false)}>Cancel</button>
                <button type="submit" className="gradient-btn">Create Version v{doc?.versions?.[0] ? doc.versions[0].versionIndex + 1 : 1}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
