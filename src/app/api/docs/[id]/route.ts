import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { downloadFile, deleteFile } from "@/lib/s3";
import { decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// GET - Retrieve single document details OR download/decrypt the file
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const shouldDownload = searchParams.get("download") === "true";

    // Retrieve document and check access
    const document = await db.document.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        permissions: true,
        tags: true,
        versions: {
          orderBy: { versionIndex: "desc" },
          take: 1,
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
          console.error("Decryption failed:", decryptError);
          return NextResponse.json({ error: "Failed to decrypt document" }, { status: 500 });
        }
      }

      // Log download audit
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "DOWNLOAD", document.id, { version: latestVersion.versionIndex }, ipAddress);

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": document.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(document.title)}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }

    // Log viewing audit
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.userId, "VIEW", document.id, { title: document.title }, ipAddress);

    return NextResponse.json({ document });
  } catch (error: any) {
    console.error("GET single doc error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update document metadata or content
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, content, tags } = body;

    // Check document access
    const document = await db.document.findUnique({
      where: { id },
      include: { permissions: true },
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

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;

    // Process Tag updates if provided
    if (tags && Array.isArray(tags)) {
      // Disconnect all existing tags first
      await db.document.update({
        where: { id },
        data: { tags: { set: [] } },
      });

      updateData.tags = {
        connectOrCreate: tags.map((name: string) => {
          const cleanName = name.trim().toLowerCase();
          return {
            where: { name: cleanName },
            create: { name: cleanName },
          };
        }),
      };
    }

    const updatedDoc = await db.document.update({
      where: { id },
      data: updateData,
      include: { tags: true },
    });

    // Log update audit
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.userId, "UPDATE", id, { fields: Object.keys(updateData) }, ipAddress);

    return NextResponse.json({ document: updatedDoc });
  } catch (error: any) {
    console.error("PUT doc error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete a document/folder
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only owner can delete the document
    const document = await db.document.findUnique({
      where: { id },
      include: {
        versions: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId !== user.userId) {
      return NextResponse.json({ error: "Only owners can delete documents" }, { status: 403 });
    }

    // Recursively retrieve and delete storage files if it's a folder,
    // or delete the file versions for this specific document.
    const filesToDelete: string[] = [];

    async function collectFiles(docId: string) {
      const doc = await db.document.findUnique({
        where: { id: docId },
        include: { versions: true, children: true },
      });
      if (!doc) return;

      for (const ver of doc.versions) {
        filesToDelete.push(ver.fileKey);
      }

      for (const child of doc.children) {
        await collectFiles(child.id);
      }
    }

    await collectFiles(id);

    // Delete files from storage (S3 or local fallback)
    for (const key of filesToDelete) {
      await deleteFile(key);
    }

    // Delete the database entry (Cascade delete handles permissions, versions, share links, audit logs in the DB)
    await db.document.delete({
      where: { id },
    });

    // Log delete audit
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.userId, "DELETE", null, { title: document.title, docId: id }, ipAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE doc error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
