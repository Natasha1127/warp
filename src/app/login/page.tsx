"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

const GRADES = [1, 2, 3, 4, 5, 6];

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // すでにログイン済みならホーム（next先）へ
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me").then((r) => {
      if (r.ok && !cancelled) router.replace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, name, grade: grade ?? undefined };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "うまくいきませんでした。もう一度お試しください。");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="space-bg min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="relative z-10 w-full max-w-sm node-pop">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block text-6xl mb-2 float select-none">🚀</Link>
          <h1 className="font-display text-4xl font-black text-white neon-text">WARP</h1>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-4 p-1 rounded-2xl glass">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className="flex-1 py-2.5 rounded-xl font-display font-black text-sm transition-all"
              style={
                mode === m
                  ? { background: "#fffdf8", color: "#3c3c4e" }
                  : { background: "transparent", color: "rgba(255,255,255,0.7)" }
              }
            >
              {m === "login" ? "ログイン" : "新規とうろく"}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl px-5 py-6 space-y-4"
          style={{ background: "#fffdf8", border: "3px solid rgba(255,255,255,0.6)" }}
        >
          {!isLogin && (
            <Field label="なまえ">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={30}
                placeholder="たろう"
                className="auth-input"
              />
            </Field>
          )}

          <Field label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="example@mail.com"
              className="auth-input"
            />
          </Field>

          <Field label="パスワード">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? 1 : 6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? "パスワード" : "6文字以上"}
              className="auth-input"
            />
          </Field>

          {!isLogin && (
            <Field label="学年（にんい）">
              <div className="grid grid-cols-6 gap-1.5">
                {GRADES.map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGrade(grade === g ? null : g)}
                    className="py-2 rounded-lg text-sm font-black transition-all"
                    style={
                      grade === g
                        ? { background: "#7c6ff0", color: "#fff" }
                        : { background: "#f0ecff", color: "#7c6ff0" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {error && (
            <div className="rounded-xl px-3 py-2.5 text-sm font-bold text-center"
                 style={{ background: "#fdecea", color: "#ea2b2b", border: "2px solid #ff4b4b" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="duo3d w-full py-3.5 rounded-2xl font-display font-extrabold text-base text-white"
            style={{
              background: loading ? "#9bd86a" : "#58cc02",
              ["--d3d" as string]: "#3f9700",
            }}
          >
            {loading ? "..." : isLogin ? "ログイン" : "とうろくしてはじめる"}
          </button>
        </form>

        <p className="text-center text-xs text-white/60 mt-4">
          {isLogin ? "アカウントがない人は「新規とうろく」へ" : "登録すると、きみだけの学習記録が残るよ"}
        </p>
      </div>

      <style jsx global>{`
        .auth-input {
          width: 100%;
          padding: 0.7rem 0.9rem;
          border-radius: 0.9rem;
          border: 2px solid #e3e3ea;
          background: #fff;
          color: #3c3c4e;
          font-weight: 700;
          font-size: 0.95rem;
          outline: none;
        }
        .auth-input:focus {
          border-color: #1cb0f6;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold mb-1.5" style={{ color: "#afa99a" }}>{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="space-bg min-h-screen flex items-center justify-center">
        <div className="text-white/80"><span className="rocket inline-block">🚀</span> 読み込み中...</div>
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}
