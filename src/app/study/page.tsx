"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import QuestionCard from "@/components/QuestionCard";

const DEMO_USER_ID = "demo-user";

interface Question {
  id: string;
  body: string;
  layer: number;
  hint: string | null;
  choices: { id: string; body: string; order: number }[];
  microUnitName?: string;
}

interface SessionInfo {
  id: string;
  state: string;
  currentLayer: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  currentMicroUnit?: { name: string; unit?: { name: string; subject?: { name: string } } };
}

interface AnswerFeedback {
  result: "CORRECT_NO_HINT" | "CORRECT_WITH_HINT" | "WRONG";
  explanation: string;
  correctChoiceId: string;
  transition: {
    returnedFromWarp: boolean;
    warpAscended: boolean;
    layerAdvanced: boolean;
    microUnitAdvanced: boolean;
    warpKind: "same" | "prerequisite" | null;
    warpReason: string | null;
  };
}

type Phase = "loading" | "question" | "error";

function StudyPage() {
  const searchParams = useSearchParams();
  const grade = searchParams.get("grade") ?? "4";
  const unitId = searchParams.get("unitId") ?? undefined;
  const microUnitId = searchParams.get("microUnitId") ?? undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [questionKey, setQuestionKey] = useState(0);
  // 単元クリアのお祝いポップアップ
  const [celebrating, setCelebrating] = useState(false);
  const [nextUnitName, setNextUnitName] = useState<string | null>(null);
  const pendingCelebrateRef = useRef(false);

  useEffect(() => {
    async function startSession() {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEMO_USER_ID, grade: Number(grade), unitId, microUnitId }),
      });
      if (!res.ok) {
        setErrorMsg("セッションの開始に失敗しました。DBが設定されているか確認してください。");
        setPhase("error");
        return;
      }
      const { session: s } = await res.json();
      setSessionId(s.id);
      setSession(s);
    }
    startSession();
  }, [grade, unitId, microUnitId]);

  const fetchQuestion = useCallback(async (sid: string) => {
    setPhase("loading");
    const res = await fetch(`/api/question?sessionId=${sid}`);
    if (!res.ok) {
      setErrorMsg("問題の取得に失敗しました。DBに問題データが入っているか確認してください。");
      setPhase("error");
      return;
    }
    const { question: q } = await res.json();
    setQuestion(q);
    setQuestionKey((k) => k + 1);
    setPhase("question");
  }, []);

  useEffect(() => {
    if (sessionId) fetchQuestion(sessionId);
  }, [sessionId, fetchQuestion]);

  async function handleAnswer(choiceId: string, usedHint: boolean): Promise<AnswerFeedback> {
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, questionId: question!.id, choiceId, usedHint }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.result) {
      throw new Error("解答の処理に失敗しました。もう一度お試しください。");
    }
    setSession(data.session);
    // 次の単元へ進んだら、つづける時にお祝いポップアップを出す
    if (data.transition?.microUnitAdvanced) {
      pendingCelebrateRef.current = true;
    }
    return {
      result: data.result,
      explanation: data.explanation,
      correctChoiceId: data.correctChoiceId,
      transition: data.transition,
    };
  }

  async function handleNext() {
    if (!sessionId) return;
    if (pendingCelebrateRef.current) {
      pendingCelebrateRef.current = false;
      // 新しい単元名を取得してお祝い表示
      try {
        const res = await fetch(`/api/session?sessionId=${sessionId}`);
        if (res.ok) {
          const { session: s } = await res.json();
          setSession(s);
          setNextUnitName(s.currentMicroUnit?.unit?.name ?? s.currentMicroUnit?.name ?? null);
        }
      } catch {
        // 名前が取れなくてもお祝いは出す
      }
      setCelebrating(true);
      return;
    }
    fetchQuestion(sessionId);
  }

  function handleCelebrateContinue() {
    setCelebrating(false);
    setNextUnitName(null);
    if (sessionId) fetchQuestion(sessionId);
  }

  const isWarped = session?.state === "WARPED";
  const subjectName = session?.currentMicroUnit?.unit?.subject?.name ?? "算数";
  const unitName = session?.currentMicroUnit?.unit?.name ?? "";
  const microUnitName = session?.currentMicroUnit?.name ?? "";

  return (
    <div className="space-bg min-h-screen flex flex-col">
      {/* Duolingo風レッスン上部バー */}
      <header className="px-4 py-3 flex items-center gap-3 relative z-10">
        <Link
          href={`/units?grade=${grade}`}
          className="text-2xl font-black text-white/70 hover:text-white leading-none"
          aria-label="とじる"
        >
          ✕
        </Link>

        {/* 進捗バー（2連続○で次へ） */}
        <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.18)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, ((session?.consecutiveCorrect ?? 0) / 2) * 100)}%`,
              background: "linear-gradient(90deg,#58cc02,#a6e84d)",
            }}
          />
        </div>

        {/* ハート（WARPまでの残り） */}
        {isWarped ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-black text-white warp-glow shrink-0"
                style={{ background: "var(--warp)" }}>
            ⚡ WARP中
          </span>
        ) : (
          <div className="flex items-center gap-0.5 shrink-0 text-lg">
            {[0, 1].map((i) => (
              <span key={i} className={i < (session?.consecutiveWrong ?? 0) ? "heart-break" : ""}>
                {i < (session?.consecutiveWrong ?? 0) ? "🤍" : "❤️"}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 単元パンくず */}
      {unitName && (
        <div className="px-5 pb-1 text-[11px] text-white/55 text-center relative z-10">
          {subjectName} / {unitName} / {microUnitName}
        </div>
      )}

      {/* コンテンツ */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        {phase === "loading" && (
          <div className="text-base font-medium text-white/80">
            <span className="rocket inline-block">🚀</span> 読み込み中...
          </div>
        )}

        {phase === "error" && (
          <div
            className="rounded-2xl p-6 max-w-md w-full text-center"
            style={{ background: "#fdecea", border: "1px solid var(--ng)" }}
          >
            <p className="font-bold text-base mb-2" style={{ color: "var(--ng)" }}>エラーが発生しました</p>
            <p className="text-sm" style={{ color: "var(--ink)" }}>{errorMsg}</p>
            <p className="text-xs mt-3" style={{ color: "var(--ink)", opacity: 0.6 }}>
              まず <code className="font-mono bg-white px-1 rounded">npm run db:migrate</code> と{" "}
              <code className="font-mono bg-white px-1 rounded">npm run db:seed</code> を実行してください
            </p>
          </div>
        )}

        {phase === "question" && question && (
          <QuestionCard
            key={questionKey}
            question={{ ...question, microUnitName }}
            onAnswer={handleAnswer}
            onNext={handleNext}
            isWarped={isWarped}
            currentLayer={session?.currentLayer ?? 1}
            maxLayer={3}
            consecutiveCorrect={session?.consecutiveCorrect ?? 0}
          />
        )}
      </main>

      {/* 単元クリアのお祝いポップアップ */}
      {celebrating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(20,16,45,0.72)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="celebrate-pop relative w-full max-w-sm rounded-3xl px-6 pt-8 pb-6 text-center overflow-hidden"
            style={{
              background: "#fffdf8",
              border: "3px solid #ffc800",
              boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* キラキラ装飾 */}
            <div className="pointer-events-none absolute inset-0 select-none">
              <span className="absolute left-5 top-4 text-2xl spark" style={{ animationDelay: "0s" }}>✨</span>
              <span className="absolute right-6 top-6 text-xl spark" style={{ animationDelay: "0.2s" }}>⭐</span>
              <span className="absolute left-8 bottom-8 text-xl spark" style={{ animationDelay: "0.35s" }}>🌟</span>
              <span className="absolute right-7 bottom-10 text-2xl spark" style={{ animationDelay: "0.15s" }}>✨</span>
            </div>

            <div className="text-7xl mb-3 float select-none relative z-10">🎉</div>
            <h2 className="font-display text-3xl font-black mb-1 relative z-10" style={{ color: "#ff9600" }}>
              おめでとう！
            </h2>
            <p className="font-display text-lg font-black mb-2 relative z-10" style={{ color: "#3c3c4e" }}>
              この単元をクリア！
            </p>
            <p className="text-sm font-bold mb-1 relative z-10" style={{ color: "#7c6ff0" }}>
              つぎの単元に進むよ！
            </p>
            {nextUnitName && (
              <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 mt-2 mb-1 relative z-10"
                   style={{ background: "#ede9ff", color: "#5b4fc4" }}>
                <span>🪐</span>
                <span className="font-display text-sm font-black">{nextUnitName}</span>
              </div>
            )}

            <button
              onClick={handleCelebrateContinue}
              className="duo3d w-full mt-5 py-3.5 rounded-2xl font-display font-extrabold text-base text-white relative z-10"
              style={{ background: "#58cc02", ["--d3d" as string]: "#3f9700" }}
            >
              つぎの単元へ →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div style={{ color: "var(--accent2)" }}>読み込み中...</div>
      </div>
    }>
      <StudyPage />
    </Suspense>
  );
}
