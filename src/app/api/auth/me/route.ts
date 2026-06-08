import { getCurrentUser } from "@/lib/auth";

/** 現在のログインユーザーを返す（未ログインは401）*/
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "未ログインです" }, { status: 401 });
  }
  return Response.json({ user });
}
