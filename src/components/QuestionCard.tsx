"use client";

import { useState } from "react";

interface Choice {
  id: string;
  body: string;
  order: number;
}

interface Question {
  id: string;
  body: string;
  layer: number;
  hint: string | null;
  choices: Choice[];
  microUnitName?: string;
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

interface Props {
  question: Question;
  onAnswer: (choiceId: string, usedHint: boolean) => Promise<AnswerFeedback>;
  onNext: () => void;
  isWarped?: boolean;
  currentLayer?: number;
  maxLayer?: number;
  consecutiveCorrect?: number;
}

const LAYER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "かんたん", color: "#58cc02" },
  2: { label: "ふつう", color: "#ffc800" },
  3: { label: "むずかしい", color: "#ff4b4b" },
};

export default function QuestionCard({
  question,
  onAnswer,
  onNext,
  isWarped = false,
  currentLayer = 1,
  maxLayer = 3,
  consecutiveCorrect = 0,
}: Props) {
  const [hintVisible, setHintVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const layer = LAYER_LABELS[question.layer] ?? { label: "", color: "#7c6ff0" };
  const answered = feedback !== null;
  const isCorrect = feedback && feedback.result !== "WRONG";

  async function handleChoiceClick(choiceId: string) {
    if (submitting || answered) return;
    setSelectedId(choiceId);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onAnswer(choiceId, hintVisible);
      setFeedback(result);
    } catch (e) {
      // 通信や処理に失敗したらやり直せるようにする（無反応で止めない）
      setSubmitError(e instanceof Error ? e.message : "エラーが発生しました。もう一度お試しください。");
      setSelectedId(null);
    } finally {
      setSubmitting(false);
    }
  }

  // 選択肢のスタイル（Duolingo風）
  function choiceVars(choiceId: string): React.CSSProperties {
    if (!answered) {
      const isSelected = selectedId === choiceId;
      return {
        background: isSelected ? "#ddf4ff" : "#ffffff",
        color: "#3c3c4e",
        ["--dc-border" as string]: isSelected ? "#1cb0f6" : "#e3e3ea",
        opacity: submitting && selectedId !== choiceId ? 0.55 : 1,
      };
    }
    const isThisCorrect = choiceId === feedback!.correctChoiceId;
    const isSelected = choiceId === selectedId;
    if (isThisCorrect) {
      return { background: "#d7ffb8", color: "#3f9700", ["--dc-border" as string]: "#58cc02", fontWeight: 800 };
    }
    if (isSelected) {
      return { background: "#ffdfe0", color: "#ea2b2b", ["--dc-border" as string]: "#ff4b4b", fontWeight: 800 };
    }
    return { background: "#ffffff", color: "#3c3c4e", ["--dc-border" as string]: "#e3e3ea", opacity: 0.5 };
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* WARPバナー */}
      {isWarped && (
        <div
          className="mb-3 rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-bold text-white warp-glow"
          style={{ background: "#7c6ff0" }}
        >
          <span>⚡</span><span>WARP中 — 基礎を確認しよう！</span>
        </div>
      )}

      {/* レッスンカード */}
      <div
        className={`rounded-3xl overflow-hidden ${isCorrect ? "correct-bounce" : ""}`}
        style={{
          background: "#fffdf8",
          border: isWarped ? "3px solid #7c6ff0" : "3px solid rgba(255,255,255,0.6)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        {/* 上部：単元名＋レイヤーチップ＋コンボ */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {question.microUnitName && (
              <span className="text-xs font-bold truncate" style={{ color: "#7c6ff0" }}>
                🪐 {question.microUnitName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {consecutiveCorrect > 0 && (
              <span className="combo-pop text-xs font-black px-2 py-0.5 rounded-full text-white"
                    style={{ background: "#ff9600" }}>
                🔥 {consecutiveCorrect}コンボ
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-white text-xs font-black"
                  style={{ background: layer.color }}>
              {layer.label}
            </span>
          </div>
        </div>

        {/* レイヤー進捗バー */}
        <div className="px-5 pb-3 flex items-center gap-1.5">
          {Array.from({ length: maxLayer }, (_, i) => {
            const lvNum = i + 1;
            const isDone = lvNum < currentLayer;
            const isCurrent = lvNum === currentLayer;
            return (
              <div key={i} className="flex-1 h-2.5 rounded-full transition-all"
                   style={{ background: isDone ? "#58cc02" : isCurrent ? "#ffc800" : "#ece6da" }} />
            );
          })}
        </div>

        {/* 問題本文 */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-[11px] font-bold tracking-wide mb-1.5" style={{ color: "#afa99a" }}>
            こたえをえらんでね
          </p>
          <p className="font-display text-2xl font-black leading-relaxed whitespace-pre-wrap"
             style={{ color: "#3c3c4e" }}>
            {question.body}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="px-5 space-y-3">
          {question.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleChoiceClick(choice.id)}
              disabled={answered || submitting}
              className="duo-choice w-full text-left px-4 py-3.5 rounded-2xl font-bold text-base flex items-center gap-3"
              style={choiceVars(choice.id)}
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      background: "rgba(0,0,0,0.06)",
                      color: "inherit",
                      border: "1.5px solid currentColor",
                    }}>
                {String.fromCharCode(64 + choice.order)}
              </span>
              <span className="flex-1">{choice.body}</span>
              {answered && choice.id === feedback!.correctChoiceId && <span className="text-xl font-black">✓</span>}
              {answered && choice.id === selectedId && choice.id !== feedback!.correctChoiceId && (
                <span className="text-xl font-black">✕</span>
              )}
            </button>
          ))}
        </div>

        {/* ヒント */}
        {!answered && question.hint && (
          <div className="px-5 pt-4">
            {hintVisible ? (
              <div className="rounded-2xl p-3 text-sm leading-relaxed"
                   style={{ background: "#fff8e6", border: "2px solid #ffc800" }}>
                <span className="font-bold" style={{ color: "#c79400" }}>💡 ヒント </span>
                {question.hint}
              </div>
            ) : (
              <button onClick={() => setHintVisible(true)}
                      className="text-sm font-bold" style={{ color: "#1cb0f6" }}>
                💡 ヒントを見る
              </button>
            )}
          </div>
        )}

        {/* 送信エラー（無反応にしない） */}
        {submitError && (
          <div className="px-5 pt-3">
            <div className="rounded-2xl p-3 text-sm font-bold text-center"
                 style={{ background: "#fdecea", color: "#ea2b2b", border: "2px solid #ff4b4b" }}>
              ⚠️ {submitError}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>

      {/* 回答後フィードバック（下からスライド） */}
      {answered && feedback && (
        <div
          className="slide-up mt-3 rounded-3xl px-5 py-4"
          style={{
            background: isCorrect ? "#d7ffb8" : "#ffdfe0",
            border: `3px solid ${isCorrect ? "#58cc02" : "#ff4b4b"}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl font-black shrink-0 text-white"
                 style={{ background: isCorrect ? "#58cc02" : "#ff4b4b" }}>
              {feedback.result === "WRONG" ? "✕" : feedback.result === "CORRECT_WITH_HINT" ? "△" : "✓"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-xl font-black"
                   style={{ color: isCorrect ? "#3f9700" : "#ea2b2b" }}>
                {feedback.result === "CORRECT_NO_HINT" && "せいかい！"}
                {feedback.result === "CORRECT_WITH_HINT" && "せいかい！（ヒントあり）"}
                {feedback.result === "WRONG" && "ざんねん…"}
              </div>
              <p className="text-sm leading-relaxed mt-1" style={{ color: "#3c3c4e" }}>
                {feedback.explanation}
              </p>
            </div>
          </div>

          {/* 遷移メッセージ */}
          {feedback.transition.warpKind && feedback.transition.warpReason && (
            <div className="mt-3 rounded-xl px-3 py-2.5 text-sm font-bold leading-relaxed"
                 style={{ background: "#ede9ff", color: "#5b4fc4", border: "2px solid #7c6ff0" }}>
              <div className="mb-0.5">
                {feedback.transition.warpKind === "prerequisite"
                  ? "⚡ 根本原因へワープ！"
                  : "⚡ 基礎にもどってワープ！"}
              </div>
              <div style={{ fontWeight: 600 }}>{feedback.transition.warpReason}</div>
            </div>
          )}
          {feedback.transition.warpAscended && (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm font-bold"
                 style={{ background: "#ede9ff", color: "#7c6ff0" }}>
              ⬆️ 1つ上の単元にもどります。この調子！
            </div>
          )}
          {feedback.transition.returnedFromWarp && (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm font-bold"
                 style={{ background: "#ede9ff", color: "#7c6ff0" }}>
              ⚡ WARP完了！元の問題に戻ります
            </div>
          )}
          {feedback.transition.layerAdvanced && (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm font-bold"
                 style={{ background: "#e6f7ff", color: "#1083b8" }}>
              🎉 つぎのレベルへ進みます！
            </div>
          )}
          {feedback.transition.microUnitAdvanced && (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm font-bold"
                 style={{ background: "#eaffd6", color: "#3f9700" }}>
              🏆 この星をクリア！つぎの星へワープ
            </div>
          )}

          <button
            onClick={onNext}
            className="duo3d w-full mt-4 py-3.5 rounded-2xl font-display font-extrabold text-base text-white"
            style={{
              background: isCorrect ? "#58cc02" : "#ff4b4b",
              ["--d3d" as string]: isCorrect ? "#3f9700" : "#c43a3a",
            }}
          >
            つづける →
          </button>
        </div>
      )}
    </div>
  );
}
