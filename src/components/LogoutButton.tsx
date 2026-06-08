"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/useAuth";

export default function LogoutButton() {
  const router = useRouter();
  async function handle() {
    await logout();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={handle}
      className="text-xs font-bold text-white/70 hover:text-white underline underline-offset-2"
    >
      ログアウト
    </button>
  );
}
