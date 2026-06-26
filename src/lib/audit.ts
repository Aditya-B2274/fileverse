import db from "./db";

export async function logAudit(
  userId: string | null,
  action: string,
  documentId: string | null,
  details: Record<string, any>,
  ipAddress?: string | null
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        documentId,
        details: JSON.stringify(details),
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
