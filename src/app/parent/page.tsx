"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

interface UnitStat {
  unitId: string;
  unitName: string;
  grade: number;
  answered: number;
  accuracy: number;
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
  weakAreas: UnitStat[];
}

function accuracyColor(acc: number): string {
  if (acc >= 80) return "#58cc02";
  if (acc >= 50) return "#ffc800";
  return "#ff4b4b";
}

export default function ParentPage() {
  useAuth();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stats`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setError("学習状況の読み込みに失敗しました。");
      })
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
        <h1 className="flex-1 font-display text-lg font-black text-white">👨‍👩‍👧 保護者向け学習状況</h1>
      </header>

      <div className="relative z-10 w-full max-w-md node-pop">
        {loading && (
          <div className="text-center text-white/80 mt-12">
            <span className="rocket inline-block">🚀</span> 読み込み中...
          </div>
        )}

        {error && <div className="glass rounded-2xl p-5 text-center text-white mt-6">{error}</div>}

        {s && (
          <div className="space-y-5">
            <p className="text-sm text-white/75 leading-relaxed">
              お子さまの学習のようすをまとめています。続けて取り組めているか、苦手な単元はどこかを確認できます。
            </p>

            {/* 概況 */}
            <section
              className="rounded-3xl px-5 py-4"
              style={{ background: "#fffdf8", border: "3px solid rgba(255,255,255,0.6)" }}
            >
              <h2 className="font-display text-base font-black mb-3" style={{ color: "#3c3c4e" }}>
                学習の概況
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <Row label="取り組んだ問題数" value={`${s.total} 問`} />
                <Row label="正答率" value={`${s.accuracy}%`} color={accuracyColor(s.accuracy)} />
                <Row label="連続学習日数" value={`${s.streak} 日`} />
                <Row label="学習した日数" value={`${s.studyDays} 日`} />
                <Row label="ヒント利用" value={`${s.withHint} 回`} />
                <Row label="クリアした単元" value={`${s.completedUnits} 単元`} />
              </div>
            </section>

            {/* 苦手な単元 */}
            <section>
              <h2 className="font-display text-base font-black text-white mb-2">
                サポートしたい単元
              </h2>
              {data!.weakAreas.length === 0 ? (
                <div className="glass rounded-2xl p-4 text-sm text-white/80 text-center">
                  目立った苦手はありません。順調に取り組めています。
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data!.weakAreas.map((u) => {
                    const color = accuracyColor(u.accuracy);
                    return (
                      <div
                        key={u.unitId}
                        className="rounded-2xl px-4 py-3"
                        style={{ background: "#fffdf8", border: `3px solid ${color}` }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <p className="text-sm font-black" style={{ color: "#3c3c4e" }}>{u.unitName}</p>
                            <p className="text-[11px]" style={{ color: "#afa99a" }}>
                              {u.grade}年 ・ {u.answered}問
                            </p>
                          </div>
                          <span className="font-display text-lg font-black" style={{ color }}>
                            {u.accuracy}%
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#ece6da" }}>
                          <div className="h-full rounded-full"
                               style={{ width: `${u.accuracy}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-white/60 mt-2 leading-relaxed">
                ※ 正答率が低い単元は、WARP機能で土台となる前の単元へ自動でさかのぼり、根本からの理解を促します。
              </p>
            </section>

            <Link
              href="/progress"
              className="duo3d block w-full py-4 rounded-2xl font-display font-extrabold text-white text-center"
              style={{ background: "#1cb0f6", ["--d3d" as string]: "#1083b8" }}
            >
              📊 くわしい学習状況を見る
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold" style={{ color: "#afa99a" }}>{label}</span>
      <span className="font-display text-xl font-black" style={{ color: color ?? "#3c3c4e" }}>{value}</span>
    </div>
  );
}
