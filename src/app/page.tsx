import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function Home() {
  const user = await getCurrentUser();

  // ホームはログイン必須。未ログインならログイン画面へ。
  if (!user) {
    redirect("/login?next=/");
  }

  return (
    <div className="space-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* 右上：ログイン状態 */}
      <div className="absolute top-4 right-5 z-20 flex items-center gap-3">
        <span className="text-xs font-bold text-white/80">👋 {user.name}さん</span>
        <LogoutButton />
      </div>

      {/* マスコット */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        <div className="text-8xl mb-6 float select-none">🚀</div>

        <h1 className="font-display text-5xl font-black text-white neon-text mb-3">
          WARP
        </h1>
        <p className="font-display text-lg font-bold text-white leading-relaxed mb-2">
          学ぶのは楽しい。宇宙のように、どこまでも。
        </p>
        <p className="text-sm text-white/70 mb-10">
          つまずいた層を見やぶって、土台へワープ。<br />
          きみだけの学習ルートで、星を一つずつクリアしよう。
        </p>

        {/* メインCTA：学習開始 */}
        <Link
          href="/start"
          className="duo3d w-full py-4 rounded-2xl font-display font-extrabold text-lg text-white text-center mb-4"
          style={{ background: "#58cc02", ["--d3d" as string]: "#3f9700" }}
        >
          はじめる
        </Link>

        {/* メイン：学年をえらぶ */}
        <Link
          href="/grades"
          className="duo3d w-full py-4 rounded-2xl font-display font-extrabold text-lg text-center text-white mb-5"
          style={{ background: "#1cb0f6", ["--d3d" as string]: "#1083b8" }}
        >
          学年を選ぶ
        </Link>

        {/* サブ：横並び3ボタン */}
        <div className="w-full grid grid-cols-3 gap-3">
          <Link
            href="/mypage"
            className="duo3d rounded-2xl py-3 px-1 flex flex-col items-center gap-1.5 glass text-white text-center"
            style={{ ["--d3d" as string]: "rgba(0,0,0,0.3)" }}
          >
            <span className="text-2xl">🧑‍🚀</span>
            <span className="font-display text-xs font-black leading-tight">マイページ</span>
          </Link>

          <Link
            href="/progress"
            className="duo3d rounded-2xl py-3 px-1 flex flex-col items-center gap-1.5 glass text-white text-center"
            style={{ ["--d3d" as string]: "rgba(0,0,0,0.3)" }}
          >
            <span className="text-2xl">📊</span>
            <span className="font-display text-xs font-black leading-tight">学習状況を見る</span>
          </Link>

          <Link
            href="/parent"
            className="duo3d rounded-2xl py-3 px-1 flex flex-col items-center gap-1.5 glass text-white text-center"
            style={{ ["--d3d" as string]: "rgba(0,0,0,0.3)" }}
          >
            <span className="text-2xl">👨‍👩‍👧</span>
            <span className="font-display text-xs font-black leading-tight">保護者向け学習状況</span>
          </Link>
        </div>
      </div>

      {/* 特徴チップ */}
      <div className="relative z-10 mt-12 flex flex-wrap justify-center gap-3 max-w-md">
        {[
          { icon: "⚡", label: "WARPシステム" },
          { icon: "🪐", label: "全92単元" },
          { icon: "🏆", label: "レベル&コンボ" },
        ].map(({ icon, label }) => (
          <span
            key={label}
            className="glass rounded-full px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <span className="text-base">{icon}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
