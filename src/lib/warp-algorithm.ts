import type {
  AnswerResult,
  SessionSnapshot,
  TransitionResult,
  WarpDestination,
  WarpFrame,
} from "@/types/warp";

const MAX_LAYER = 3;
/** 前提単元を遡れる最大段数（暴走防止） */
const MAX_WARP_DEPTH = 6;

/**
 * 解答結果を受け取り、次のセッション状態を計算する（副作用なし）。
 *
 * WARPの考え方（根本原因の解消）:
 *  - 2連続×になったら、その問題が解けない「根本原因」まで遡る。
 *  - レイヤー2/3でつまずいた → 同じ単元の基礎(レイヤー1)を確認（warpDestination.kind="same"）。
 *  - レイヤー1でつまずいた → 前提単元（前学年含む）へ遡る（warpDestination.kind="prerequisite"）。
 *    遡った先でもまた2連続×なら、さらに前提へ…と連鎖的に根本原因まで降りていく。
 *  - 遡るたびに戻り先を warpStack に積み、2連続○できたら1段ずつ登って戻る。
 *
 * warpDestination は呼び出し元（answer route）が現在地・レイヤー・前提マップから決めて渡す。
 */
export function computeNextState(
  current: SessionSnapshot,
  result: AnswerResult,
  /** 2連続×時の遡り先（根本原因の単元）。遡れない場合は null */
  warpDestination: WarpDestination | null,
  /** 次のマイクロ単元ID（現マイクロ単元の次）。なければ null */
  nextMicroUnitId: string | null
): TransitionResult {
  const next: SessionSnapshot = {
    ...current,
    warpStack: [...(current.warpStack ?? [])],
  };
  let warpTo: WarpDestination | null = null;
  let returnedFromWarp = false;
  let warpAscended = false;
  let layerAdvanced = false;
  let microUnitAdvanced = false;

  const isCorrect =
    result === "CORRECT_NO_HINT" || result === "CORRECT_WITH_HINT";

  if (isCorrect) {
    next.consecutiveCorrect += 1;
    next.consecutiveWrong = 0;
  } else {
    next.consecutiveWrong += 1;
    next.consecutiveCorrect = 0;
  }

  next.layerQuestionCount += 1;

  // ── 2連続× → WARP（根本原因へ遡る） ──────────────────────────
  if (result === "WRONG" && next.consecutiveWrong >= 2) {
    if (warpDestination && next.warpStack.length < MAX_WARP_DEPTH) {
      // 今いる場所を戻り先として積む
      const frame: WarpFrame = {
        microUnitId: current.currentMicroUnitId,
        layer: current.currentLayer,
      };
      next.warpStack.push(frame);

      warpTo = warpDestination;
      next.state = "WARPED";
      next.consecutiveWrong = 0;
      next.consecutiveCorrect = 0;
      next.layerQuestionCount = 0;
      next.currentMicroUnitId = warpDestination.microUnitId;
      next.currentLayer = warpDestination.layer;

      // スタック最上段を従来フィールドにも反映（UI・互換用）
      next.warpReturnMicroUnitId = frame.microUnitId;
      next.warpReturnLayer = frame.layer;
    }
    return {
      next,
      warpTo,
      returnedFromWarp,
      warpAscended,
      layerAdvanced,
      microUnitAdvanced,
    };
  }

  // ── 2連続○ ───────────────────────────────────────────────
  if (next.consecutiveCorrect >= 2) {
    next.consecutiveCorrect = 0;
    next.consecutiveWrong = 0;
    next.layerQuestionCount = 0;

    if (current.state === "WARPED" && next.warpStack.length > 0) {
      // 1段上の単元へ登って戻る
      const frame = next.warpStack.pop()!;
      next.currentMicroUnitId = frame.microUnitId;
      next.currentLayer = frame.layer;

      if (next.warpStack.length === 0) {
        // すべて登りきって元の問題へ復帰
        returnedFromWarp = true;
        next.state = "NORMAL";
        next.warpReturnMicroUnitId = null;
        next.warpReturnLayer = null;
      } else {
        // まだ前提単元の途中。1段上がっただけ
        warpAscended = true;
        const top = next.warpStack[next.warpStack.length - 1];
        next.warpReturnMicroUnitId = top.microUnitId;
        next.warpReturnLayer = top.layer;
      }
    } else if (current.currentLayer < MAX_LAYER) {
      // 次のレイヤーへ
      layerAdvanced = true;
      next.currentLayer += 1;
    } else {
      // レイヤー3完了 → 次のマイクロ単元へ
      if (nextMicroUnitId) {
        microUnitAdvanced = true;
        next.currentMicroUnitId = nextMicroUnitId;
        next.currentLayer = 1;
      }
      // nextMicroUnitId が null の場合はコース完了（呼び出し元で処理）
    }
  }
  // △ or × (1回目) → 変化なし（layerQuestionCount だけ増えている）

  return {
    next,
    warpTo,
    returnedFromWarp,
    warpAscended,
    layerAdvanced,
    microUnitAdvanced,
  };
}
