import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  
  if (user) {
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.userId, "LOGOUT", null, { email: user.email }, ipAddress);
  }

  const response = NextResponse.json({ success: true });
  
  // Clear the token cookie
  response.cookies.set("token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
