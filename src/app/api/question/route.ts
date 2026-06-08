import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    include: {
      answerHistories: { select: { questionId: true } },
    },
  });
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.userId !== userId) {
    return Response.json({ error: "アクセス権がありません" }, { status: 403 });
  }

  const answeredIds = session.answerHistories.map((h: { questionId: string }) => h.questionId);

  const questions = await prisma.question.findMany({
    where: {
      microUnitId: session.currentMicroUnitId,
      layer: session.currentLayer,
      id: { notIn: answeredIds.length > 0 ? answeredIds : undefined },
    },
    include: {
      choices: { orderBy: { order: "asc" } },
    },
  });

  const pool = questions.length > 0
    ? questions
    : await prisma.question.findMany({
        where: {
          microUnitId: session.currentMicroUnitId,
          layer: session.currentLayer,
        },
        include: { choices: { orderBy: { order: "asc" } } },
      });

  if (pool.length === 0) {
    return Response.json({ error: "No questions available" }, { status: 404 });
  }

  const q = pool[Math.floor(Math.random() * pool.length)];
  return Response.json({ question: sanitize(q) });
}

type Choice = { id: string; body: string; order: number; isCorrect: boolean; warpMicroUnitId: string | null; warpLayer: number | null };
type QuestionWithChoices = { id: string; body: string; figure: string | null; layer: number; hint: string | null; microUnitId: string; choices: Choice[] };

function sanitize(q: QuestionWithChoices) {
  return {
    id: q.id,
    body: q.body,
    figure: q.figure,
    layer: q.layer,
    hint: q.hint,
    microUnitId: q.microUnitId,
    choices: q.choices.map((c) => ({ id: c.id, body: c.body, order: c.order })),
  };
}
