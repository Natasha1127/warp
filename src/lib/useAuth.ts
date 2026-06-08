"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  grade: number | null;
}

/**
 * ログイン中のユーザーを取得するクライアントフック。
 * @param required true の場合、未ログインなら /login へリダイレクトする。
 */
export function useAuth(required = true) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) {
          const { user } = await r.json();
          if (!cancelled) setUser(user);
        } else if (required) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          router.replace(`/login?next=${next}`);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [required, router]);

  return { user, loading };
}

/** ログアウトしてトップへ戻す */
export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}
