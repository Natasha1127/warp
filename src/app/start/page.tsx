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

const GOALS = [
  "算数を得意にしたい",
  "テストでいい点をとりたい",
  "苦手をなくしたい",
  "毎日コツコツ続けたい",
  "受験にむけてがんばる",
];

const SUBJECTS = ["国語", "算数", "理科", "社会", "英語", "体育", "音楽", "図工"];

type Step = "grade" | "unit" | "goal" | "subject";
const STEPS: Step[] = ["grade", "unit", "goal", "subject"];

export default function StartSurvey() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("grade");
  const [grade, setGrade] = useState<number | null>(null);
  const [data, setData] = useState<UnitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // アンケート回答
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [favoriteSubject, setFavoriteSubject] = useState<string | null>(null);
  const [weakSubject, setWeakSubject] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 登録時に入力済みの学年があればプリフィル
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.user?.grade) setGrade(j.user.grade);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    setUnit(null);
    setStep("unit");
  }

  function handlePickUnit(u: UnitInfo) {
    setUnit(u);
    setStep("goal");
  }

  function handlePickGoal(g: string) {
    setGoal(g);
    setStep("subject");
  }

  async function handleFinish() {
    if (grade == null || !unit) return;
    setSaving(true);
    setError("");
    try {
      await fetch("/api/user/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          studyingMicroUnitId: unit.firstMicroUnitId ?? undefined,
          studyingUnitName: unit.name,
          goal: goal ?? undefined,
          favoriteSubject: favoriteSubject ?? undefined,
          weakSubject: weakSubject ?? undefined,
        }),
      });
    } catch {
      // 保存に失敗しても学習は始められるようにする
    } finally {
      setSaving(false);
    }
    // 学習スタート
    const params = new URLSearchParams({ grade: String(grade) });
    if (unit.firstMicroUnitId) params.set("microUnitId", unit.firstMicroUnitId);
    else params.set("unitId", unit.id);
    router.push(`/study?${params.toString()}`);
  }

  function goBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  const stepIndex = STEPS.indexOf(step);

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
            onClick={goBack}
            className="text-sm font-bold text-white/80 hover:text-white"
            aria-label="もどる"
          >
            ←
          </button>
        )}
        <div className="flex-1 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="flex-1 h-2.5 rounded-full transition-all"
              style={{
                background:
                  i < stepIndex ? "#58cc02" : i === stepIndex ? "#ffc800" : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>
        <span className="text-xl rocket">🚀</span>
      </header>

      {/* ── ステップ1：学年 ── */}
      {step === "grade" && (
        <div className="relative z-10 w-full max-w-md node-pop">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3 float select-none">🧑‍🚀</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">いま何年生かな？</h1>
            <p className="text-sm text-white/70">きみにぴったりの問題を用意するよ</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {GRADES.map(({ grade: g, color, shadow, emoji }) => (
              <button
                key={g}
                onClick={() => handlePickGrade(g)}
                className="duo3d rounded-2xl py-5 flex flex-col items-center gap-1 text-white"
                style={{
                  background: color,
                  ["--d3d" as string]: shadow,
                  outline: grade === g ? "3px solid #fff" : "none",
                }}
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
        <div className="relative z-10 w-full max-w-md node-pop">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3 select-none">📖</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">いま どこを勉強してる？</h1>
            <p className="text-sm text-white/70">
              学校で勉強中の単元をえらんでね。<br />ここから学習がスタートするよ
            </p>
          </div>

          {loading && (
            <div className="text-center text-white/80 mt-10">
              <span className="rocket inline-block">🚀</span> よみこみ中...
            </div>
          )}

          {error && <div className="glass rounded-2xl p-5 text-center text-white mt-6">{error}</div>}

          {data && !loading && (
            <div className="space-y-2.5">
              {data.units.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => handlePickUnit(u)}
                  className="duo-choice w-full text-left px-4 py-3.5 rounded-2xl font-bold flex items-center gap-3"
                  style={{ background: "#ffffff", color: "#3c3c4e", ["--dc-border" as string]: "#e3e3ea" }}
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

      {/* ── ステップ3：目標・やる気 ── */}
      {step === "goal" && (
        <div className="relative z-10 w-full max-w-md node-pop">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3 select-none">🎯</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">どんな目標がある？</h1>
            <p className="text-sm text-white/70">きみのやる気を教えてね</p>
          </div>

          <div className="space-y-2.5">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => handlePickGoal(g)}
                className="duo-choice w-full text-left px-4 py-3.5 rounded-2xl font-bold flex items-center gap-3"
                style={{
                  background: "#ffffff",
                  color: "#3c3c4e",
                  ["--dc-border" as string]: goal === g ? "#58cc02" : "#e3e3ea",
                }}
              >
                <span className="flex-1 leading-tight">{g}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ステップ4：好きな科目・苦手な科目 ── */}
      {step === "subject" && (
        <div className="relative z-10 w-full max-w-md node-pop">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3 select-none">📚</div>
            <h1 className="font-display text-2xl font-black text-white mb-1">好きな科目・苦手な科目は？</h1>
            <p className="text-sm text-white/70">えらばなくてもOK（あとで変えられるよ）</p>
          </div>

          <SubjectPicker
            label="好きな科目"
            emoji="💖"
            value={favoriteSubject}
            onChange={setFavoriteSubject}
          />
          <div className="h-4" />
          <SubjectPicker
            label="苦手な科目"
            emoji="💦"
            value={weakSubject}
            onChange={setWeakSubject}
          />

          {error && (
            <div className="glass rounded-2xl p-3 text-center text-white text-sm mt-4">{error}</div>
          )}

          <button
            onClick={handleFinish}
            disabled={saving}
            className="duo3d w-full mt-6 py-4 rounded-2xl font-display font-extrabold text-base text-white"
            style={{ background: saving ? "#9bd86a" : "#58cc02", ["--d3d" as string]: "#3f9700" }}
          >
            {saving ? "ほぞん中..." : "学習をはじめる →"}
          </button>
        </div>
      )}
    </div>
  );
}

function SubjectPicker({
  label,
  emoji,
  value,
  onChange,
}: {
  label: string;
  emoji: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="text-sm font-black text-white mb-2">
        {emoji} {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              onClick={() => onChange(active ? null : s)}
              className="px-3.5 py-2 rounded-xl text-sm font-black transition-all"
              style={
                active
                  ? { background: "#7c6ff0", color: "#fff" }
                  : { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
