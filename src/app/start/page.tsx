"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const GRADES = [
  { grade: 1, color: "#58cc02", shadow: "#3f9700", emoji: "🌱" },
  { grade: 2, color: "#1cb0f6", shadow: "#1083b8", emoji: "🚀" },
  { grade: 3, color: "#ff9600", shadow: "#c47400", emoji: "⭐" },
  { grade: 4, color: "#7c6ff0", shadow: "#5044b3", emoji: "🪐" },
  { grade: 5, color: "#ff4b8b", shadow: "#c43368", emoji: "🌍" },
  { grade: 6, color: "#3aa6a0", shadow: "#247873", emoji: "🌟" },
];

type Step = "grade" | "unit";

export default function StartOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("grade");
  const [grade, setGrade] = useState<number | null>(null);
  const [data, setData] = useState<UnitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 学年が決まったら、その学年の単元一覧を読み込む
  useEffect(() => {
    if (grade == null) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/units?grade=${grade}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as UnitsResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("単元の読み込みに失敗しました。もう一度お試しください。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [grade]);

  function handlePickGrade(g: number) {
    setGrade(g);
    setStep("unit");
  }

  function handlePickUnit(u: UnitInfo) {
    // ④ いま学校で勉強中の単元から学習スタート
    const params = new URLSearchParams({ grade: String(grade) });
    if (u.firstMicroUnitId) params.set("microUnitId", u.firstMicroUnitId);
    else params.set("unitId", u.id);
    router.push(`/study?${params.toString()}`);
  }

  return (
    <div className="space-bg min-h-screen flex flex-col items-center px-5 pb-16">
      {/* ヘッダー：進捗ステップ */}
      <header className="sticky top-0 w-full max-w-md z-20 glass rounded-b-2xl px-4 py-3 flex items-center gap-3 mb-4">
        {step === "grade" ? (
          <Link href="/" className="text-sm font-bold text-white/80 hover:text-white">
            ←
          </Link>
        ) : (
          <button
            onClick={() => setStep("grade")}
            className="text-sm font-bold text-white/80 hover:text-white"
            aria-label="もどる"
          >
            ←
          </button>
        )}
        <div className="flex-1 flex items-center gap-1.5">
          {(["grade", "unit"] as Step[]).map((s) => {
            const active = step === s;
            const done = step === "unit" && s === "grade";
            return (
              <div
                key={s}
                className="flex-1 h-2.5 rounded-full transition-all"
                style={{ background: done ? "#58cc02" : active ? "#ffc800" : "rgba(255,255,255,0.18)" }}
              />
            );
          })}
        </div>
        <span className="text-xl rocket">🚀</span>
      </header>

      {/* ── ステップ1：学年 ── */}
      {step === "grade" && (
        <div className="relative z-10 w-full max-w-md node-pop">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3 float select-none">🧑‍🚀</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">
              いま何年生かな？
            </h1>
            <p className="text-sm text-white/70">
              きみにぴったりの問題を用意するよ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {GRADES.map(({ grade: g, color, shadow, emoji }) => (
              <button
                key={g}
                onClick={() => handlePickGrade(g)}
                className="duo3d rounded-2xl py-5 flex flex-col items-center gap-1 text-white"
                style={{ background: color, ["--d3d" as string]: shadow }}
              >
                <span className="text-3xl">{emoji}</span>
                <span className="font-display text-lg font-black">{g}年生</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ステップ2：単元 ── */}
      {step === "unit" && (
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3 select-none">📖</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">
              いま どこを勉強してる？
            </h1>
            <p className="text-sm text-white/70">
              学校で勉強中の単元をえらんでね。<br />ここから学習がスタートするよ
            </p>
          </div>

          {loading && (
            <div className="text-center text-white/80 mt-10">
              <span className="rocket inline-block">🚀</span> よみこみ中...
            </div>
          )}

          {error && (
            <div className="glass rounded-2xl p-5 text-center text-white mt-6">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-2.5">
              {data.units.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => handlePickUnit(u)}
                  className="duo-choice w-full text-left px-4 py-3.5 rounded-2xl font-bold flex items-center gap-3"
                  style={{
                    background: "#ffffff",
                    color: "#3c3c4e",
                    ["--dc-border" as string]: "#e3e3ea",
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 text-white"
                    style={{ background: "#7c6ff0" }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 leading-tight">{u.name}</span>
                  <span className="text-[11px] text-[#afa99a] shrink-0">⭐{u.questionCount}問</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
