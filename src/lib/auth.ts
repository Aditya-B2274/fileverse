import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "secure-jwt-secret-key-change-in-production-12345";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function getAuthUser(req?: NextRequest): Promise<JWTPayload | null> {
  let token = "";

  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get("token");
      if (tokenCookie) {
        token = tokenCookie.value;
      }
    } catch (e) {}
  }

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
