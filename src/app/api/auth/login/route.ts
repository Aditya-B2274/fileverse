import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { comparePassword, signToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Create session token
    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Log login
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.id, "LOGIN", null, { email: user.email }, ipAddress);

    // Create response and set cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
