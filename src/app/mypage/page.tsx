"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DEMO_USER_ID = "demo-user";

interface StatsResponse {
  summary: {
    total: number;
    correct: number;
    accuracy: number;
    streak: number;
    completedUnits: number;
  };
}

export default function MyPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stats?userId=${DEMO_USER_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const s = data?.summary;

  return (
    <div className="space-bg min-h-screen flex flex-col items-center px-5 pb-16">
      <header className="sticky top-0 w-full max-w-md z-20 glass rounded-b-2xl px-4 py-3 flex items-center gap-3 mb-4">
        <Link href="/" className="text-sm font-bold text-white/80 hover:text-white">
          ←
        </Link>
        <h1 className="flex-1 font-display text-lg font-black text-white">🧑‍🚀 マイページ</h1>
        <span className="text-xl rocket">🚀</span>
      </header>

      <div className="relative z-10 w-full max-w-md node-pop">
        {/* プロフィールカード */}
        <div
          className="rounded-3xl px-6 py-7 text-center mb-5"
          style={{ background: "#fffdf8", border: "3px solid rgba(255,255,255,0.6)" }}
        >
          <div className="text-7xl mb-3 float select-none">🧑‍🚀</div>
          <h2 className="font-display text-2xl font-black mb-1" style={{ color: "#3c3c4e" }}>
            たんけんかさん
          </h2>
          <p className="text-sm font-bold" style={{ color: "#7c6ff0" }}>
            WARPで宇宙を冒険中！
          </p>
        </div>

        {loading && (
          <div className="text-center text-white/80 mt-6">
            <span className="rocket inline-block">🚀</span> よみこみ中...
          </div>
        )}

        {s && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat icon="🔥" label="連続学習" value={`${s.streak}日`} color="#ff9600" />
            <Stat icon="🏆" label="クリア単元" value={`${s.completedUnits}`} color="#7c6ff0" />
            <Stat icon="📝" label="といた問題" value={`${s.total}問`} color="#1cb0f6" />
            <Stat icon="🎯" label="正答率" value={`${s.accuracy}%`} color="#58cc02" />
          </div>
        )}

        <Link
          href="/progress"
          className="duo3d block w-full py-4 rounded-2xl font-display font-extrabold text-white text-center mb-3"
          style={{ background: "#1cb0f6", ["--d3d" as string]: "#1083b8" }}
        >
          📊 学習状況をくわしく見る
        </Link>
        <Link
          href="/start"
          className="duo3d block w-full py-4 rounded-2xl font-display font-extrabold text-white text-center"
          style={{ background: "#58cc02", ["--d3d" as string]: "#3f9700" }}
        >
          学習をはじめる →
        </Link>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col gap-0.5"
      style={{ background: "#fffdf8", border: "3px solid rgba(255,255,255,0.6)" }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-bold" style={{ color: "#afa99a" }}>{label}</span>
      <span className="font-display text-2xl font-black" style={{ color }}>{value}</span>
    </div>
  );
}
