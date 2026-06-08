"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface UnitInfo {
  id: string;
  name: string;
  order: number;
  firstMicroUnitId: string | null;
  microUnitCount: number;
  questionCount: number;
}

interface UnitsResponse {
  subject: { id: string; name: string; grade: number };
  units: UnitInfo[];
}

const NODE_COLORS = [
  { c: "#58cc02", s: "#3f9700" },
  { c: "#1cb0f6", s: "#1083b8" },
  { c: "#ff9600", s: "#c47400" },
  { c: "#7c6ff0", s: "#5044b3" },
  { c: "#ff4b8b", s: "#c43368" },
  { c: "#3aa6a0", s: "#247873" },
];
const NODE_EMOJI = ["🪐", "🌕", "⭐", "🌍", "🌟", "☄️", "🌙", "✨", "🛰️"];

// くねくね飛行ルートの横オフセット（zig-zag）
const OFFSETS = [0, 52, 78, 52, 0, -52, -78, -52];

function UnitsPage() {
  const searchParams = useSearchParams();
  const grade = searchParams.get("grade") ?? "4";

  const [data, setData] = useState<UnitsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/units?grade=${grade}`);
      if (!res.ok) {
        setError("単元の読み込みに失敗しました。");
        return;
      }
      setData(await res.json());
    }
    load();
  }, [grade]);

  return (
    <div className="space-bg min-h-screen flex flex-col items-center pb-24 px-4">
      {/* 固定ヘッダー */}
      <header className="sticky top-0 w-full max-w-md z-20 glass rounded-b-2xl px-4 py-3 flex items-center gap-3 mb-2">
        <Link href="/grades" className="text-sm font-bold text-white/80 hover:text-white">
          ←
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-black text-white leading-none">
            {grade}年生 たんけんルート
          </h1>
          {data && (
            <p className="text-[11px] text-white/60 mt-0.5">
              {data.subject.name}・{data.units.length}つの星
            </p>
          )}
        </div>
        <span className="text-xl rocket">🚀</span>
      </header>

      {error && (
        <div className="glass rounded-2xl p-6 text-center text-white relative z-10 mt-8">
          {error}
        </div>
      )}
      {!data && !error && (
        <div className="text-white/80 relative z-10 mt-12">
          <span className="rocket inline-block">🚀</span> よみこみ中...
        </div>
      )}

      {/* レッスンパス */}
      {data && (
        <div className="relative w-full max-w-md pt-8" style={{ minHeight: 120 }}>
          {/* 飛行ルートの点線 */}
          <div className="flight-trail" />

          {/* スタート地点のロケット */}
          <div className="relative z-10 flex justify-center mb-6">
            <div className="glass rounded-full px-4 py-1.5 text-xs font-bold text-white flex items-center gap-1">
              <span className="rocket">🚀</span> しゅっぱつ！
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {data.units.map((u, i) => {
              const { c, s } = NODE_COLORS[i % NODE_COLORS.length];
              const emoji = NODE_EMOJI[i % NODE_EMOJI.length];
              const offset = OFFSETS[i % OFFSETS.length];
              const href = u.firstMicroUnitId
                ? `/study?grade=${grade}&microUnitId=${u.firstMicroUnitId}`
                : `/study?grade=${grade}&unitId=${u.id}`;
              return (
                <div
                  key={u.id}
                  className="flex flex-col items-center mb-7 node-pop"
                  style={{ transform: `translateX(${offset}px)`, animationDelay: `${i * 0.04}s` }}
                >
                  <Link
                    href={href}
                    className="duo3d w-[78px] h-[78px] rounded-full flex items-center justify-center text-4xl select-none"
                    style={{
                      background: `radial-gradient(circle at 32% 28%, ${c}, ${c}bb 72%)`,
                      ["--d3d" as string]: s,
                      border: "3px solid rgba(255,255,255,0.35)",
                    }}
                    title={u.name}
                  >
                    {emoji}
                  </Link>
                  {/* ラベル吹き出し */}
                  <div className="glass mt-2 rounded-xl px-3 py-1 max-w-[160px] text-center">
                    <div className="font-display text-xs font-bold text-white leading-tight">
                      {u.name}
                    </div>
                    <div className="text-[10px] text-white/60">⭐ {u.questionCount}問</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ゴール */}
          <div className="relative z-10 flex justify-center mt-1">
            <div className="glass rounded-full px-4 py-1.5 text-xs font-bold text-gold flex items-center gap-1"
                 style={{ color: "#f4b942" }}>
              🏁 ゴール
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnitsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="space-bg min-h-screen flex items-center justify-center">
        <div className="text-white/80">よみこみ中...</div>
      </div>
    }>
      <UnitsPage />
    </Suspense>
  );
}
