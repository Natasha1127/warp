"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DEMO_USER_ID = "demo-user";

interface UnitStat {
  unitId: string;
  unitName: string;
  grade: number;
  subjectName: string;
  answered: number;
  correct: number;
  accuracy: number;
}

interface RecentItem {
  id: string;
  body: string;
  layer: number;
  result: "CORRECT_NO_HINT" | "CORRECT_WITH_HINT" | "WRONG";
  unitName: string;
  grade: number;
  answeredAt: string;
}

interface StatsResponse {
  summary: {
    total: number;
    correct: number;
    wrong: number;
    withHint: number;
    accuracy: number;
    studyDays: number;
    streak: number;
    completedUnits: number;
  };
  byUnit: UnitStat[];
  weakAreas: UnitStat[];
  recent: RecentItem[];
}

const LAYER_LABELS: Record<number, string> = { 1: "かんたん", 2: "ふつう", 3: "むずかしい" };

function accuracyColor(acc: number): string {
  if (acc >= 80) return "#58cc02";
  if (acc >= 50) return "#ffc800";
  return "#ff4b4b";
}

export default function ProgressPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/stats?userId=${DEMO_USER_ID}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as StatsResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("学習状況の読み込みに失敗しました。もう一度お試しください。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const empty = data && data.summary.total === 0;

  return (
    <div className="space-bg min-h-screen flex flex-col items-center px-5 pb-16">
      {/* ヘッダー */}
      <header className="sticky top-0 w-full max-w-md z-20 glass rounded-b-2xl px-4 py-3 flex items-center gap-3 mb-4">
        <Link href="/" className="text-sm font-bold text-white/80 hover:text-white">
          ←
        </Link>
        <h1 className="flex-1 font-display text-lg font-black text-white">📊 学習状況</h1>
        <span className="text-xl rocket">🚀</span>
      </header>

      <div className="relative z-10 w-full max-w-md">
        {loading && (
          <div className="text-center text-white/80 mt-12">
            <span className="rocket inline-block">🚀</span> よみこみ中...
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl p-5 text-center text-white mt-6">{error}</div>
        )}

        {empty && (
          <div className="glass rounded-3xl p-8 text-center text-white mt-6 node-pop">
            <div className="text-5xl mb-3 float select-none">🛰️</div>
            <p className="font-display text-lg font-black mb-1">まだ記録がないよ</p>
            <p className="text-sm text-white/70 mb-5">
              問題をといて、きみの成績や苦手をここで確認しよう！
            </p>
            <Link
              href="/start"
              className="duo3d inline-block px-6 py-3 rounded-2xl font-display font-extrabold text-white"
              style={{ background: "#58cc02", ["--d3d" as string]: "#3f9700" }}
            >
              学習をはじめる →
            </Link>
          </div>
        )}

        {data && !empty && (
          <div className="space-y-5 node-pop">
            {/* ── サマリーカード ── */}
            <section className="grid grid-cols-2 gap-3">
              <StatCard
                icon="🎯"
                label="正答率"
                value={`${data.summary.accuracy}%`}
                color={accuracyColor(data.summary.accuracy)}
              />
              <StatCard icon="📝" label="といた問題" value={`${data.summary.total}問`} color="#1cb0f6" />
              <StatCard icon="🔥" label="連続学習" value={`${data.summary.streak}日`} color="#ff9600" />
              <StatCard
                icon="🏆"
                label="クリア単元"
                value={`${data.summary.completedUnits}`}
                color="#7c6ff0"
              />
            </section>

            {/* 正解／不正解の内訳 */}
            <section
              className="rounded-2xl px-4 py-3"
              style={{ background: "#fffdf8", border: "3px solid rgba(255,255,255,0.6)" }}
            >
              <div className="flex items-center justify-between text-sm font-bold mb-2"
                   style={{ color: "#3c3c4e" }}>
                <span>正解の内訳</span>
                <span style={{ color: "#afa99a" }}>{data.summary.correct} / {data.summary.total}</span>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden" style={{ background: "#ece6da" }}>
                {data.summary.total > 0 && (
                  <>
                    <div style={{
                      width: `${((data.summary.correct - data.summary.withHint) / data.summary.total) * 100}%`,
                      background: "#58cc02",
                    }} />
                    <div style={{
                      width: `${(data.summary.withHint / data.summary.total) * 100}%`,
                      background: "#ffc800",
                    }} />
                    <div style={{
                      width: `${(data.summary.wrong / data.summary.total) * 100}%`,
                      background: "#ff4b4b",
                    }} />
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] font-bold" style={{ color: "#7a7568" }}>
                <Legend color="#58cc02" label={`正解 ${data.summary.correct - data.summary.withHint}`} />
                <Legend color="#ffc800" label={`ヒント ${data.summary.withHint}`} />
                <Legend color="#ff4b4b" label={`不正解 ${data.summary.wrong}`} />
              </div>
            </section>

            {/* ── 苦手な単元 ── */}
            <section>
              <h2 className="font-display text-base font-black text-white mb-2 flex items-center gap-1.5">
                💪 苦手な単元
              </h2>
              {data.weakAreas.length === 0 ? (
                <div className="glass rounded-2xl p-4 text-center text-sm text-white/80">
                  まだ苦手は見つかっていないよ。この調子！🌟
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.weakAreas.map((u) => (
                    <UnitRow key={u.unitId} unit={u} highlight />
                  ))}
                </div>
              )}
            </section>

            {/* ── 単元ごとの成績 ── */}
            <section>
              <h2 className="font-display text-base font-black text-white mb-2 flex items-center gap-1.5">
                🪐 単元ごとの成績
              </h2>
              <div className="space-y-2.5">
                {data.byUnit.map((u) => (
                  <UnitRow key={u.unitId} unit={u} />
                ))}
              </div>
            </section>

            {/* ── 最近の解答 ── */}
            <section>
              <h2 className="font-display text-base font-black text-white mb-2 flex items-center gap-1.5">
                🕒 最近の解答
              </h2>
              <div className="space-y-2">
                {data.recent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl px-3.5 py-2.5 flex items-center gap-3"
                    style={{ background: "#fffdf8" }}
                  >
                    <span className="text-xl shrink-0">
                      {r.result === "WRONG" ? "❌" : r.result === "CORRECT_WITH_HINT" ? "🟡" : "✅"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "#3c3c4e" }}>
                        {r.body}
                      </p>
                      <p className="text-[11px]" style={{ color: "#afa99a" }}>
                        {r.grade}年 / {r.unitName} ・ {LAYER_LABELS[r.layer] ?? ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Link
              href="/start"
              className="duo3d block w-full py-4 rounded-2xl font-display font-extrabold text-white text-center"
              style={{ background: "#58cc02", ["--d3d" as string]: "#3f9700" }}
            >
              学習をつづける →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function UnitRow({ unit, highlight = false }: { unit: UnitStat; highlight?: boolean }) {
  const color = accuracyColor(unit.accuracy);
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "#fffdf8",
        border: highlight ? `3px solid ${color}` : "3px solid rgba(255,255,255,0.6)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-black truncate" style={{ color: "#3c3c4e" }}>{unit.unitName}</p>
          <p className="text-[11px]" style={{ color: "#afa99a" }}>
            {unit.grade}年 ・ {unit.answered}問
          </p>
        </div>
        <span className="font-display text-lg font-black shrink-0" style={{ color }}>
          {unit.accuracy}%
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#ece6da" }}>
        <div className="h-full rounded-full transition-all"
             style={{ width: `${unit.accuracy}%`, background: color }} />
      </div>
    </div>
  );
}
