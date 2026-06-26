import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { uploadFile } from "@/lib/s3";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";

// GET - Retrieve all versions of a document
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await db.document.findUnique({
      where: { id },
      include: {
        permissions: true,
        versions: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { versionIndex: "desc" },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const hasAccess =
      document.ownerId === user.userId ||
      document.permissions.some(p => p.userId === user.userId);

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ versions: document.versions });
  } catch (error: any) {
    console.error("GET versions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Upload new version OR Rollback to an older version
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await db.document.findUnique({
      where: { id },
      include: {
        permissions: true,
        versions: { orderBy: { versionIndex: "desc" } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const hasWriteAccess =
      document.ownerId === user.userId ||
      document.permissions.some(p => p.userId === user.userId && ["OWNER", "EDITOR"].includes(p.role));

    if (!hasWriteAccess) {
      return NextResponse.json({ error: "Write access denied" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // A. Handle Version Rollback or Rich Text Checkpoint (JSON)
    if (contentType.includes("application/json")) {
      const { action, versionId, changeSummary, content } = await req.json();

      // Case A.1: Rollback to a previous version
      if (action === "rollback") {
        if (!versionId) {
          return NextResponse.json({ error: "Missing versionId for rollback" }, { status: 400 });
        }

        const versionToRollback = await db.version.findUnique({
          where: { id: versionId },
        });

        if (!versionToRollback || versionToRollback.documentId !== id) {
          return NextResponse.json({ error: "Version not found for this document" }, { status: 404 });
        }

        const nextVersionIndex = (document.versions[0]?.versionIndex || 0) + 1;

        // Clone the file key of the old version into a new version entry
        const newVersion = await db.version.create({
          data: {
            documentId: id,
            versionIndex: nextVersionIndex,
            fileKey: versionToRollback.fileKey,
            changeSummary: changeSummary || `Rolled back to version ${versionToRollback.versionIndex}`,
            createdById: user.userId,
          },
        });

        // Audit Log
        const ipAddress = req.headers.get("x-forwarded-for") || "";
        await logAudit(
          user.userId,
          "ROLLBACK",
          id,
          { fromVersion: versionToRollback.versionIndex, toVersion: nextVersionIndex },
          ipAddress
        );

        return NextResponse.json({ version: newVersion });
      }

      // Case A.2: Create a version checkpoint for a rich text document (saves current editor text as a version)
      if (action === "checkpoint") {
        const nextVersionIndex = (document.versions[0]?.versionIndex || 0) + 1;
        const richTextBuffer = Buffer.from(content || document.content || "");
        
        // Encrypt content buffer
        const encryptedBuffer = encrypt(richTextBuffer);
        const storageKey = `uploads/${uuidv4()}_${document.title}_v${nextVersionIndex}`;
        const fileUrl = await uploadFile(storageKey, encryptedBuffer, "text/html");

        const newVersion = await db.version.create({
          data: {
            documentId: id,
            versionIndex: nextVersionIndex,
            fileKey: fileUrl,
            changeSummary: changeSummary || `Checkpoint created by ${user.name}`,
            createdById: user.userId,
          },
        });

        // Update main document content
        await db.document.update({
          where: { id },
          data: {
            content: content || document.content,
            fileSize: richTextBuffer.length,
          },
        });

        // Audit Log
        const ipAddress = req.headers.get("x-forwarded-for") || "";
        await logAudit(user.userId, "CHECKPOINT", id, { version: nextVersionIndex }, ipAddress);

        return NextResponse.json({ version: newVersion });
      }

      return NextResponse.json({ error: "Invalid action for JSON request" }, { status: 400 });
    }

    // B. Handle Upload New Version (Multipart Form Data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const changeSummary = formData.get("changeSummary") as string | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";

      // Encrypt the file buffer
      const encryptedBuffer = encrypt(originalBuffer);

      const nextVersionIndex = (document.versions[0]?.versionIndex || 0) + 1;
      const storageKey = `uploads/${uuidv4()}_${document.title}_v${nextVersionIndex}`;
      
      // Upload new file version
      const fileUrl = await uploadFile(storageKey, encryptedBuffer, mimeType);

      // Create new Version record
      const newVersion = await db.version.create({
        data: {
          documentId: id,
          versionIndex: nextVersionIndex,
          fileKey: fileUrl,
          changeSummary: changeSummary || `Uploaded version ${nextVersionIndex}`,
          createdById: user.userId,
        },
      });

      // Update main document metadata
      await db.document.update({
        where: { id },
        data: {
          fileSize: originalBuffer.length,
          mimeType,
        },
      });

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "UPLOAD_VERSION", id, { version: nextVersionIndex }, ipAddress);

      return NextResponse.json({ version: newVersion });
    }

    return NextResponse.json({ error: "Unsupported Media Type" }, { status: 415 });
  } catch (error: any) {
    console.error("POST versions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
