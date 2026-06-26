import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";

// GET - Retrieves the JWT token for the current authenticated user (for WebSocket handshake)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value || "";

  return NextResponse.json({ token });
}
