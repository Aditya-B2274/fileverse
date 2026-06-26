import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // Hash password & create user
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    // Create session token
    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Log the registration
    const ipAddress = req.headers.get("x-forwarded-for") || "";
    await logAudit(user.id, "REGISTER", null, { email: user.email }, ipAddress);

    // Create response and set cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    // Set JWT in HTTP-only cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
