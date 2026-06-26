import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// GET - Retrieve audit logs for a document
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await db.document.findUnique({
      where: { id },
      include: { permissions: true },
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

    // Fetch audit logs sorted by newest first
    const auditLogs = await db.auditLog.findMany({
      where: { documentId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ auditLogs });
  } catch (error: any) {
    console.error("GET audit logs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
