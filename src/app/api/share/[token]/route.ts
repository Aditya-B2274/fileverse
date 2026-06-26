import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { downloadFile } from "@/lib/s3";
import { decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// GET - Resolve a public share token (details or download)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(req.url);
    const shouldDownload = searchParams.get("download") === "true";

    // Retrieve the share link details
    const shareLink = await db.shareLink.findUnique({
      where: { token },
      include: {
        document: {
          include: {
            versions: {
              orderBy: { versionIndex: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 404 });
    }

    // Check expiration
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    const document = shareLink.document;

    // Handle File Download (with decryption on the fly)
    if (shouldDownload && !document.isFolder) {
      if (document.versions.length === 0) {
        return NextResponse.json({ error: "No file versions available to download" }, { status: 400 });
      }

      const latestVersion = document.versions[0];
      const encryptedFileBuffer = await downloadFile(latestVersion.fileKey);

      let fileBuffer = encryptedFileBuffer;
      if (document.isEncrypted) {
        try {
          fileBuffer = decrypt(encryptedFileBuffer);
        } catch (decryptError) {
          console.error("Link decryption failed:", decryptError);
          return NextResponse.json({ error: "Failed to decrypt document" }, { status: 500 });
        }
      }

      // Log download audit
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(null, "LINK_DOWNLOAD", document.id, { token, version: latestVersion.versionIndex }, ipAddress);

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": document.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(document.title)}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }

    // Log view audit
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(null, "LINK_VIEW", document.id, { token }, ipAddress);

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        content: document.content,
        isFolder: document.isFolder,
        updatedAt: document.updatedAt,
        mimeType: document.mimeType,
      },
      role: shareLink.role, // EDITOR or VIEWER
    });
  } catch (error: any) {
    console.error("GET resolve share link error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update shared document via public link (if editor)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { content, title } = body;

    const shareLink = await db.shareLink.findUnique({
      where: { token },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 404 });
    }

    if (shareLink.role !== "EDITOR") {
      return NextResponse.json({ error: "Write permission denied on this link" }, { status: 403 });
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (title !== undefined) updateData.title = title;

    const updatedDoc = await db.document.update({
      where: { id: shareLink.documentId },
      data: updateData,
    });

    // Log update audit
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(null, "LINK_UPDATE", shareLink.documentId, { token }, ipAddress);

    return NextResponse.json({ document: updatedDoc });
  } catch (error: any) {
    console.error("PUT share link edit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
