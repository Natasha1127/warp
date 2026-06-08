export type AnswerResult = "CORRECT_NO_HINT" | "CORRECT_WITH_HINT" | "WRONG";
export type SessionState = "NORMAL" | "WARPED";

/** 多段WARPの戻り先1段分 */
export interface WarpFrame {
  microUnitId: string;
  layer: number;
}

export interface SessionSnapshot {
  currentMicroUnitId: string;
  currentLayer: number;          // 1〜3
  layerQuestionCount: number;    // 現レイヤーで出題した問題数 (0〜2)
  consecutiveCorrect: number;
  consecutiveWrong: number;
  state: SessionState;
  warpReturnMicroUnitId: string | null;
  warpReturnLayer: number | null;
  /** 前提単元へ遡るときの戻り先スタック（最後尾が直近の戻り先） */
  warpStack: WarpFrame[];
}

export interface WarpDestination {
  microUnitId: string;
  layer: number;
  /** WARPの種類: same=同単元の基礎へ / prerequisite=前提単元へ遡る */
  kind: "same" | "prerequisite";
}

export interface TransitionResult {
  next: SessionSnapshot;
  /** WARP先に飛ぶ場合はその情報 */
  warpTo: WarpDestination | null;
  /** WARPから完全に元の問題に戻った場合 true */
  returnedFromWarp: boolean;
  /** WARP中に1段上の単元へ戻った（まだWARP中）場合 true */
  warpAscended: boolean;
  /** レイヤーが上がった場合 true */
  layerAdvanced: boolean;
  /** 次のマイクロ単元に進んだ場合 true */
  microUnitAdvanced: boolean;
}
