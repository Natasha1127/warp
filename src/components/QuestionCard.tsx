"use client";

import { useState } from "react";
import QuestionFigure from "@/components/QuestionFigure";

interface Choice {
  id: string;
  body: string;
  order: number;
}

interface Question {
  id: string;
  body: string;
  figure?: string | null;
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

  // 選択肢のスタイル（SF HUD風）
  function choiceVars(choiceId: string): React.CSSProperties {
    if (!answered) {
      const isSelected = selectedId === choiceId;
      return {
        color: "#e9fbff",
        ["--hc-border" as string]: isSelected ? "#22e0e5" : "rgba(34,224,229,0.4)",
        ["--hc-glow" as string]: isSelected ? "16px" : "0px",
        opacity: submitting && selectedId !== choiceId ? 0.45 : 1,
      };
    }
    const isThisCorrect = choiceId === feedback!.correctChoiceId;
    const isSelected = choiceId === selectedId;
    if (isThisCorrect) {
      return { color: "#bdffd0", ["--hc-border" as string]: "#3ef08a", ["--hc-glow" as string]: "18px", fontWeight: 800 };
    }
    if (isSelected) {
      return { color: "#ffc0d0", ["--hc-border" as string]: "#ff4b7d", ["--hc-glow" as string]: "18px", fontWeight: 800 };
    }
    return { color: "#7b93b5", ["--hc-border" as string]: "rgba(123,147,181,0.3)", ["--hc-glow" as string]: "0px", opacity: 0.45 };
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* WARPバナー */}
      {isWarped && (
        <div
          className="mb-3 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black warp-glow neon-cyan"
          style={{ background: "rgba(124,111,240,0.18)", border: "1.5px solid rgba(34,224,229,0.55)" }}
        >
          <span>⚡</span><span className="tracking-wider">WARP中 — 基礎を確認しよう！</span>
        </div>
      )}

      {/* HUDパネル */}
      <div className={`hud-panel hud-corners hud-glow-anim overflow-hidden ${isCorrect ? "correct-bounce" : ""}`}>
        {/* 上部バー：単元名＋難易度＋コンボ */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {question.microUnitName && (
              <span className="text-xs font-black truncate neon-cyan tracking-wider">
                🪐 {question.microUnitName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {consecutiveCorrect > 0 && (
              <span className="combo-pop text-[11px] font-black px-2 py-0.5 rounded-md"
                    style={{ color: "#ffd76a", background: "rgba(247,201,72,0.12)", border: "1px solid rgba(247,201,72,0.6)" }}>
                🔥 {consecutiveCorrect} COMBO
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider"
                  style={{ color: layer.color, background: "rgba(255,255,255,0.04)", border: `1px solid ${layer.color}` }}>
              {layer.label}
            </span>
          </div>
        </div>

        {/* レイヤー進捗バー（セグメント） */}
        <div className="px-5 pb-3 flex items-center gap-1.5">
          {Array.from({ length: maxLayer }, (_, i) => {
            const lvNum = i + 1;
            const isDone = lvNum < currentLayer;
            const isCurrent = lvNum === currentLayer;
            const c = isDone ? "#3ef08a" : isCurrent ? "#f7c948" : "rgba(255,255,255,0.12)";
            return (
              <div key={i} className="flex-1 h-2 rounded-full transition-all"
                   style={{ background: c, boxShadow: isDone || isCurrent ? `0 0 8px ${c}` : "none" }} />
            );
          })}
        </div>

        {/* 区切り線 */}
        <div className="mx-5 mb-3" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(34,224,229,0.5), transparent)" }} />

        {/* 問題本文 */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-black tracking-[0.2em] mb-2 neon-cyan opacity-80">
            SELECT ANSWER
          </p>
          <p className="font-display text-2xl font-black leading-relaxed whitespace-pre-wrap"
             style={{ color: "#f3f9ff", textShadow: "0 0 14px rgba(120,180,255,0.35)" }}>
            {question.body}
          </p>
          {question.figure && (
            <div className="mt-3">
              <QuestionFigure figure={question.figure} />
            </div>
          )}
        </div>

        {/* 選択肢 */}
        <div className="px-5 space-y-3">
          {question.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleChoiceClick(choice.id)}
              disabled={answered || submitting}
              className="hud-choice w-full text-left px-4 py-3.5 rounded-xl font-bold text-base flex items-center gap-3"
              style={choiceVars(choice.id)}
            >
              <span className="w-7 h-7 flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      color: "currentColor",
                      border: "1.5px solid currentColor",
                      clipPath: "polygon(15% 0, 85% 0, 100% 50%, 85% 100%, 15% 100%, 0 50%)",
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
              <div className="rounded-xl p-3 text-sm leading-relaxed"
                   style={{ background: "rgba(247,201,72,0.08)", border: "1.5px solid rgba(247,201,72,0.55)", color: "#ffe9a8" }}>
                <span className="font-black neon-gold">💡 HINT </span>
                {question.hint}
              </div>
            ) : (
              <button onClick={() => setHintVisible(true)}
                      className="text-sm font-black neon-gold tracking-wider">
                💡 ヒントを見る
              </button>
            )}
          </div>
        )}

        {/* 送信エラー（無反応にしない） */}
        {submitError && (
          <div className="px-5 pt-3">
            <div className="rounded-xl p-3 text-sm font-bold text-center"
                 style={{ background: "rgba(255,75,125,0.1)", color: "#ff8fae", border: "1.5px solid #ff4b7d" }}>
              ⚠️ {submitError}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>

      {/* 回答後フィードバック（下からスライド） */}
      {answered && feedback && (
        <div className="slide-up mt-3 hud-panel hud-corners px-5 py-5"
             style={{ borderColor: isCorrect ? "rgba(62,240,138,0.6)" : "rgba(255,75,125,0.6)" }}>
          {/* 大きな結果見出し（WARP SUCCESSFUL 風） */}
          <div className="text-center mb-3">
            <div className="font-display text-2xl font-black tracking-widest neon-gold">
              {feedback.result === "WRONG" ? "WARP FAILED" : "WARP SUCCESSFUL"}
            </div>
            <div className="text-sm font-black tracking-wider mt-0.5"
                 style={{ color: isCorrect ? "#3ef08a" : "#ff8fae" }}>
              {feedback.result === "CORRECT_NO_HINT" && "せいかい！"}
              {feedback.result === "CORRECT_WITH_HINT" && "せいかい！（ヒントあり）"}
              {feedback.result === "WRONG" && "ざんねん…"}
            </div>
          </div>

          {/* 解説パネル */}
          <div className="rounded-xl px-4 py-3 mb-3"
               style={{ background: "rgba(34,224,229,0.06)", border: "1px solid rgba(34,224,229,0.3)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "#dceefb" }}>
              {feedback.explanation}
            </p>
          </div>

          {/* 遷移メッセージ */}
          {feedback.transition.warpKind && feedback.transition.warpReason && (
            <div className="mb-2 rounded-xl px-3 py-2.5 text-sm font-bold leading-relaxed"
                 style={{ background: "rgba(124,111,240,0.14)", color: "#c7bdff", border: "1.5px solid #7c6ff0" }}>
              <div className="mb-0.5 tracking-wider">
                {feedback.transition.warpKind === "prerequisite"
                  ? "⚡ 根本原因へワープ！"
                  : "⚡ 基礎にもどってワープ！"}
              </div>
              <div style={{ fontWeight: 600 }}>{feedback.transition.warpReason}</div>
            </div>
          )}
          {feedback.transition.warpAscended && (
            <div className="mb-2 rounded-xl px-3 py-2 text-sm font-bold tracking-wide"
                 style={{ background: "rgba(124,111,240,0.14)", color: "#c7bdff", border: "1px solid rgba(124,111,240,0.5)" }}>
              ⬆️ 1つ上の単元にもどります。この調子！
            </div>
          )}
          {feedback.transition.returnedFromWarp && (
            <div className="mb-2 rounded-xl px-3 py-2 text-sm font-bold tracking-wide"
                 style={{ background: "rgba(124,111,240,0.14)", color: "#c7bdff", border: "1px solid rgba(124,111,240,0.5)" }}>
              ⚡ WARP完了！元の問題に戻ります
            </div>
          )}
          {feedback.transition.layerAdvanced && (
            <div className="mb-2 rounded-xl px-3 py-2 text-sm font-bold tracking-wide"
                 style={{ background: "rgba(34,224,229,0.1)", color: "#22e0e5", border: "1px solid rgba(34,224,229,0.5)" }}>
              🎉 NEW LEVEL — つぎのレベルへ進みます！
            </div>
          )}
          {feedback.transition.microUnitAdvanced && (
            <div className="mb-2 rounded-xl px-3 py-2 text-sm font-bold tracking-wide"
                 style={{ background: "rgba(62,240,138,0.1)", color: "#3ef08a", border: "1px solid rgba(62,240,138,0.5)" }}>
              🏆 SECTOR CLEAR — この星をクリア！つぎの星へワープ
            </div>
          )}

          {/* ヘックスのジャンプボタン */}
          <button
            onClick={onNext}
            className="hex-btn w-full mt-3 py-4 font-display font-black text-base tracking-widest text-white"
            style={{
              background: isCorrect
                ? "linear-gradient(180deg, #2bd47a, #16a85c)"
                : "linear-gradient(180deg, #ff5a7a, #e0344f)",
              boxShadow: isCorrect
                ? "0 0 22px rgba(62,240,138,0.5)"
                : "0 0 22px rgba(255,75,125,0.5)",
            }}
          >
            INITIATE JUMP →
          </button>
        </div>
      )}
    </div>
  );
}
