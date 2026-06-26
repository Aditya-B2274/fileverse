import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { uploadFile } from "@/lib/s3";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";

// GET - Retrieve documents/folders
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId"); // "root", specific ID, or null (global list)
    const searchQuery = searchParams.get("search");
    const tagQuery = searchParams.get("tag");

    // Base filter: user must be the owner OR have a permission record
    const accessFilter = {
      OR: [
        { ownerId: user.userId },
        { permissions: { some: { userId: user.userId } } },
      ],
    };

    let whereClause: any = { ...accessFilter };

    // Handle Search and Tag filters (global search ignores parentId)
    if (searchQuery || tagQuery) {
      if (searchQuery) {
        whereClause.OR = [
          { title: { contains: searchQuery } },
          { description: { contains: searchQuery } },
        ];
      }
      if (tagQuery) {
        whereClause.tags = {
          some: { name: tagQuery },
        };
      }
    } else {
      // Direct folder navigation
      if (parentId === "root") {
        whereClause.parentId = null;
      } else if (parentId) {
        // First check access to parent folder
        const parentFolder = await db.document.findFirst({
          where: {
            id: parentId,
            isFolder: true,
            ...accessFilter,
          },
        });
        if (!parentFolder) {
          return NextResponse.json({ error: "Folder not found or access denied" }, { status: 403 });
        }
        whereClause.parentId = parentId;
      }
    }

    const documents = await db.document.findMany({
      where: whereClause,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tags: true,
      },
      orderBy: [
        { isFolder: "desc" }, // folders first
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error("GET docs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create Folder, Document, or Upload File
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // 1. Handle File Upload (Multipart Form Data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const title = formData.get("title") as string | null;
      const description = formData.get("description") as string | null;
      let parentId = formData.get("parentId") as string | null;
      const tagsString = formData.get("tags") as string | null; // Comma separated tags

      if (parentId === "root" || !parentId) {
        parentId = null;
      }

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // Check access to parent folder if specified
      if (parentId) {
        const parentFolder = await db.document.findFirst({
          where: {
            id: parentId,
            isFolder: true,
            OR: [
              { ownerId: user.userId },
              { permissions: { some: { userId: user.userId, role: { in: ["OWNER", "EDITOR"] } } } },
            ],
          },
        });
        if (!parentFolder) {
          return NextResponse.json({ error: "Parent folder not found or write access denied" }, { status: 403 });
        }
      }

      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const fileName = title || file.name || "Untitled File";

      // Encrypt the file buffer
      const encryptedBuffer = encrypt(originalBuffer);

      // Upload to Storage (S3 or local fallback)
      const storageKey = `uploads/${uuidv4()}_${fileName}`;
      const fileUrl = await uploadFile(storageKey, encryptedBuffer, mimeType);

      // Create Document in Database
      const document = await db.document.create({
        data: {
          title: fileName,
          description: description || "",
          isFolder: false,
          parentId,
          ownerId: user.userId,
          fileSize: originalBuffer.length,
          mimeType,
          isEncrypted: true,
        },
      });

      // Create initial Version record
      await db.version.create({
        data: {
          documentId: document.id,
          versionIndex: 1,
          fileKey: fileUrl,
          changeSummary: "Initial upload",
          createdById: user.userId,
        },
      });

      // Process Tags
      if (tagsString) {
        const tagNames = tagsString.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
        for (const name of tagNames) {
          await db.document.update({
            where: { id: document.id },
            data: {
              tags: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            },
          });
        }
      }

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "UPLOAD", document.id, { title: fileName, size: originalBuffer.length }, ipAddress);

      return NextResponse.json({ document });
    }

    // 2. Handle Folder or Rich Text Doc Creation (JSON Payload)
    else {
      const body = await req.json();
      const { title, description, isFolder, content, tags } = body;
      let parentId = body.parentId;

      if (parentId === "root" || !parentId) {
        parentId = null;
      }

      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      // Check access to parent folder
      if (parentId) {
        const parentFolder = await db.document.findFirst({
          where: {
            id: parentId,
            isFolder: true,
            OR: [
              { ownerId: user.userId },
              { permissions: { some: { userId: user.userId, role: { in: ["OWNER", "EDITOR"] } } } },
            ],
          },
        });
        if (!parentFolder) {
          return NextResponse.json({ error: "Parent folder not found or write access denied" }, { status: 403 });
        }
      }

      // Create Document/Folder
      const docData: any = {
        title,
        description: description || "",
        isFolder: !!isFolder,
        parentId,
        ownerId: user.userId,
      };

      if (!isFolder) {
        docData.content = content || "";
        docData.mimeType = "text/html"; // Default for in-app collaborative docs
      }

      // Process Tag relations
      if (tags && Array.isArray(tags)) {
        docData.tags = {
          connectOrCreate: tags.map((name: string) => {
            const cleanName = name.trim().toLowerCase();
            return {
              where: { name: cleanName },
              create: { name: cleanName },
            };
          }),
        };
      }

      const document = await db.document.create({
        data: docData,
        include: { tags: true },
      });

      // Audit Log
      const actionType = isFolder ? "CREATE_FOLDER" : "CREATE_DOC";
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, actionType, document.id, { title }, ipAddress);

      return NextResponse.json({ document });
    }
  } catch (error: any) {
    console.error("POST doc error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
