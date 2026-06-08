import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "warp_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30日

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-insecure-secret";
}

// ── パスワード ──
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── セッショントークン（ステートレス・HMAC署名）──
function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

/** userId を含む署名付きトークンを作る */
export function createSessionToken(userId: string): string {
  const payload = Buffer.from(userId, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** トークンを検証して userId を返す（不正なら null）*/
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // タイミング攻撃対策の固定長比較
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

// ── Cookie 操作（Route Handler / Server Action 内で使用）──
export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** 現在ログイン中の userId を取得（未ログインなら null）*/
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

/** 現在ログイン中のユーザー情報を取得（未ログインなら null）*/
export async function getCurrentUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, grade: true },
  });
}
