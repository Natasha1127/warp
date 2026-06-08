import { clearSessionCookie } from "@/lib/auth";

/** ログアウト：セッションCookieを破棄 */
export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
