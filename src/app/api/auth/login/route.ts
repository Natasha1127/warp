import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** ログイン：メール＋パスワードを検証してセッションCookieを発行 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "メールアドレスとパスワードを入力してください" }, { status: 400 });
  }
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  // ユーザー有無を区別しない（情報漏えい防止）
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return Response.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, grade: user.grade },
  });
}
