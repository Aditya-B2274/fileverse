import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 }); // Graceful unauthorized check
  }

  return NextResponse.json({ user });
}
