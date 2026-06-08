import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { computeNextState } from "@/lib/warp-algorithm";
import type { AnswerResult, SessionSnapshot, WarpDestination, WarpFrame } from "@/types/warp";
import { prerequisiteMicroUnitId } from "@/data/prerequisites";
import { getCurrentUserId } from "@/lib/auth";

const AnswerSchema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  choiceId: z.string(),
  usedHint: z.boolean().default(false),
});

/** マイクロ単元IDから「学年・教科・単元名」を読みやすい文字列で取得 */
async function describeMicroUnit(microUnitId: string): Promise<{
  name: string;
  grade: number | null;
} | null> {
  const mu = await prisma.microUnit.findUnique({
    where: { id: microUnitId },
    include: { unit: { include: { subject: true } } },
  });
  if (!mu) return null;
  return { name: mu.unit.name, grade: mu.unit.subject?.grade ?? null };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = AnswerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sessionId, questionId, choiceId, usedHint } = parsed.data;

  const [session, question] = await Promise.all([
    prisma.studySession.findUnique({ where: { id: sessionId } }),
    prisma.question.findUnique({
      where: { id: questionId },
      include: { choices: true },
    }),
  ]);
  if (!session || !question) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  // 本人のセッションのみ操作可能
  const userId = await getCurrentUserId();
  if (!userId || userId !== session.userId) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const selectedChoice = question.choices.find(
    (c: { id: string; isCorrect: boolean }) => c.id === choiceId
  );
  if (!selectedChoice) {
    return Response.json({ error: "Choice not found" }, { status: 400 });
  }

  const isCorrect = selectedChoice.isCorrect;
  let result: AnswerResult;
  if (isCorrect && usedHint) result = "CORRECT_WITH_HINT";
  else if (isCorrect) result = "CORRECT_NO_HINT";
  else result = "WRONG";

  // 次のマイクロ単元を取得（レイヤー3完了時の前進先）
  const currentMicroUnit = await prisma.microUnit.findUnique({
    where: { id: session.currentMicroUnitId },
    include: { unit: true },
  });
  const nextMicroUnit = currentMicroUnit
    ? (await prisma.microUnit.findFirst({
        where: {
          unitId: currentMicroUnit.unitId,
          order: { gt: currentMicroUnit.order },
        },
        orderBy: { order: "asc" },
      })) ??
      (await prisma.microUnit.findFirst({
        where: {
          unit: {
            subjectId: currentMicroUnit.unit.subjectId,
            order: { gt: currentMicroUnit.unit.order },
          },
        },
        orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
      }))
    : null;

  // ── 根本原因のWARP先を決める ────────────────────────────────
  //   レイヤー2/3でつまずき → 同じ単元の基礎（レイヤー1）を確認
  //   レイヤー1でつまずき   → 前提単元（前学年含む）へ遡る。無ければ遡らない
  let warpDestination: WarpDestination | null = null;
  if (!isCorrect) {
    if (session.currentLayer >= 2) {
      warpDestination = {
        microUnitId: session.currentMicroUnitId,
        layer: 1,
        kind: "same",
      };
    } else {
      const prereq = prerequisiteMicroUnitId(session.currentMicroUnitId);
      if (prereq) {
        warpDestination = { microUnitId: prereq, layer: 1, kind: "prerequisite" };
      }
    }
  }

  // 既存スタックを復元
  const warpStack: WarpFrame[] = Array.isArray(session.warpStack)
    ? (session.warpStack as unknown as WarpFrame[])
    : [];

  const currentSnapshot: SessionSnapshot = {
    currentMicroUnitId: session.currentMicroUnitId,
    currentLayer: session.currentLayer,
    layerQuestionCount: session.layerQuestionCount,
    consecutiveCorrect: session.consecutiveCorrect,
    consecutiveWrong: session.consecutiveWrong,
    state: session.state as "NORMAL" | "WARPED",
    warpReturnMicroUnitId: session.warpReturnMicroUnitId,
    warpReturnLayer: session.warpReturnLayer,
    warpStack,
  };

  const { next, warpTo, returnedFromWarp, warpAscended, layerAdvanced, microUnitAdvanced } =
    computeNextState(currentSnapshot, result, warpDestination, nextMicroUnit?.id ?? null);

  // ── 生徒に見せる根本原因メッセージを作る ──────────────────────
  let warpReason: string | null = session.warpReason ?? null;
  if (warpTo) {
    if (warpTo.kind === "prerequisite") {
      const dest = await describeMicroUnit(warpTo.microUnitId);
      const from = currentMicroUnit?.unit?.name ?? "この単元";
      if (dest) {
        const gradeLabel = dest.grade ? `${dest.grade}年生の` : "";
        warpReason =
          `「${from}」がむずかしいのは、土台となる${gradeLabel}「${dest.name}」の理解が` +
          `あと少しだからかも。そこまで戻って根本から確認しよう！`;
      } else {
        warpReason = `土台の単元にもどって根本から確認しよう！`;
      }
    } else {
      const here = currentMicroUnit?.unit?.name ?? "この単元";
      warpReason = `「${here}」の基礎（かんたん）にもどって、つまずきの原因を確かめよう！`;
    }
  } else if (returnedFromWarp) {
    warpReason = null;
  }

  // DB更新
  const [, updatedSession] = await prisma.$transaction([
    prisma.answerHistory.create({
      data: { userId: session.userId, sessionId, questionId, choiceId, result },
    }),
    prisma.studySession.update({
      where: { id: sessionId },
      data: {
        currentMicroUnitId: next.currentMicroUnitId,
        currentLayer: next.currentLayer,
        layerQuestionCount: next.layerQuestionCount,
        consecutiveCorrect: next.consecutiveCorrect,
        consecutiveWrong: next.consecutiveWrong,
        state: next.state,
        warpReturnMicroUnitId: next.warpReturnMicroUnitId,
        warpReturnLayer: next.warpReturnLayer,
        warpStack: next.warpStack as unknown as object,
        warpReason,
      },
    }),
  ]);

  const correctChoice = question.choices.find(
    (c: { id: string; isCorrect: boolean }) => c.isCorrect
  );

  return Response.json({
    result,
    isCorrect,
    explanation: question.explanation,
    correctChoiceId: correctChoice?.id ?? null,
    transition: {
      returnedFromWarp,
      warpAscended,
      layerAdvanced,
      microUnitAdvanced,
      warpKind: warpTo?.kind ?? null,
      warpReason: warpTo ? warpReason : null,
    },
    session: updatedSession,
  });
}
