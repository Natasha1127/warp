import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";

const RegisterSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(6, "パスワードは6文字以上にしてください"),
  name: z.string().min(1, "なまえを入力してください").max(30),
  grade: z.number().int().min(1).max(6).optional(),
});

/** 新規登録：ユーザー作成してログイン状態にする */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return Response.json({ error: msg }, { status: 400 });
  }
  const { email, password, name, grade } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return Response.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      grade: grade ?? null,
    },
    select: { id: true, email: true, name: true, role: true, grade: true },
  });

  await setSessionCookie(user.id);
  return Response.json({ user });
}
