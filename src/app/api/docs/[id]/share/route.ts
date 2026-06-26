import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

// GET - Retrieve sharing info (permissions and share links)
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
        permissions: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        shareLinks: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Only OWNER of document can manage sharing
    if (document.ownerId !== user.userId) {
      return NextResponse.json({ error: "Only owners can view sharing permissions" }, { status: 403 });
    }

    return NextResponse.json({
      permissions: document.permissions,
      shareLinks: document.shareLinks,
    });
  } catch (error: any) {
    console.error("GET share details error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Grant access to user by email OR generate public share link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const document = await db.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId !== user.userId) {
      return NextResponse.json({ error: "Only owners can share documents" }, { status: 403 });
    }

    // Case 1: Share document with a specific user by email
    if (action === "share_user") {
      const { email, role } = body;
      if (!email || !role) {
        return NextResponse.json({ error: "Missing email or role" }, { status: 400 });
      }

      if (!["EDITOR", "VIEWER"].includes(role)) {
        return NextResponse.json({ error: "Invalid sharing role" }, { status: 400 });
      }

      // Find user by email
      const targetUser = await db.user.findUnique({
        where: { email },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User with this email not found" }, { status: 404 });
      }

      if (targetUser.id === user.userId) {
        return NextResponse.json({ error: "You cannot share a document with yourself" }, { status: 400 });
      }

      // Upsert Permission
      const permission = await db.permission.upsert({
        where: {
          documentId_userId: {
            documentId: id,
            userId: targetUser.id,
          },
        },
        update: { role },
        create: {
          documentId: id,
          userId: targetUser.id,
          role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "SHARE_USER", id, { sharedWith: email, role }, ipAddress);

      return NextResponse.json({ permission });
    }

    // Case 2: Generate public shareable link
    if (action === "share_link") {
      const { role, expiresDays } = body;

      if (!role || !["EDITOR", "VIEWER"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      const token = crypto.randomBytes(24).toString("hex");
      let expiresAt: Date | null = null;
      if (expiresDays && Number(expiresDays) > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(expiresDays));
      }

      const shareLink = await db.shareLink.create({
        data: {
          documentId: id,
          token,
          role,
          expiresAt,
        },
      });

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "GENERATE_LINK", id, { role, expiresAt }, ipAddress);

      return NextResponse.json({ shareLink });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST share error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Revoke user permission OR delete public share link
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const document = await db.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId !== user.userId) {
      return NextResponse.json({ error: "Only owners can revoke sharing" }, { status: 403 });
    }

    // Case 1: Revoke user permission
    if (action === "revoke_user") {
      const { userId } = body;
      if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }

      await db.permission.delete({
        where: {
          documentId_userId: {
            documentId: id,
            userId,
          },
        },
      });

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "REVOKE_USER", id, { revokedUserId: userId }, ipAddress);

      return NextResponse.json({ success: true });
    }

    // Case 2: Revoke/delete public share link
    if (action === "revoke_link") {
      const { linkId } = body;
      if (!linkId) {
        return NextResponse.json({ error: "Missing linkId" }, { status: 400 });
      }

      const link = await db.shareLink.findUnique({
        where: { id: linkId },
      });

      if (!link || link.documentId !== id) {
        return NextResponse.json({ error: "Share link not found" }, { status: 404 });
      }

      await db.shareLink.delete({
        where: { id: linkId },
      });

      // Audit Log
      const ipAddress = req.headers.get("x-forwarded-for") || "";
      await logAudit(user.userId, "REVOKE_LINK", id, { token: link.token }, ipAddress);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("DELETE share error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
