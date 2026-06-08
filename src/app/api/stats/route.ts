import { prisma } from "@/lib/prisma";
import type { AnswerResult } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth";

/**
 * ログイン中ユーザーの学習状況の集計を返す。
 * GET /api/stats
 *
 * - サマリー（総解答数・正答率・ヒント利用・連続学習日数など）
 * - 単元ごとの成績（学年・単元名・正答率）
 * - 苦手な単元（正答率が低い順）
 * - 最近の解答履歴
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // 解答履歴（問題→マイクロ単元→単元→教科 まで取得）
  const histories = await prisma.answerHistory.findMany({
    where: { userId },
    orderBy: { answeredAt: "desc" },
    include: {
      question: {
        include: {
          microUnit: { include: { unit: { include: { subject: true } } } },
        },
      },
    },
  });

  const isCorrect = (r: AnswerResult) => r !== "WRONG";

  // ── サマリー ──
  const total = histories.length;
  const correct = histories.filter((h) => isCorrect(h.result)).length;
  const withHint = histories.filter((h) => h.result === "CORRECT_WITH_HINT").length;
  const wrong = histories.filter((h) => h.result === "WRONG").length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // 学習した日（重複なし）と連続学習日数
  const dayKeys = Array.from(
    new Set(histories.map((h) => h.answeredAt.toISOString().slice(0, 10)))
  ).sort();
  const studyDays = dayKeys.length;
  const streak = computeStreak(dayKeys);

  // ── 単元ごとの成績 ──
  type UnitAgg = {
    unitId: string;
    unitName: string;
    grade: number;
    subjectName: string;
    answered: number;
    correct: number;
  };
  const unitMap = new Map<string, UnitAgg>();
  for (const h of histories) {
    const unit = h.question.microUnit.unit;
    const subject = unit.subject;
    const key = unit.id;
    let agg = unitMap.get(key);
    if (!agg) {
      agg = {
        unitId: unit.id,
        unitName: unit.name,
        grade: subject.grade,
        subjectName: subject.name,
        answered: 0,
        correct: 0,
      };
      unitMap.set(key, agg);
    }
    agg.answered += 1;
    if (isCorrect(h.result)) agg.correct += 1;
  }
  const byUnit = Array.from(unitMap.values())
    .map((u) => ({
      ...u,
      accuracy: u.answered > 0 ? Math.round((u.correct / u.answered) * 100) : 0,
    }))
    .sort((a, b) => a.grade - b.grade || a.unitName.localeCompare(b.unitName));

  // ── 苦手な単元（3問以上解答 かつ 正答率が低い順、上位5件）──
  const weakAreas = byUnit
    .filter((u) => u.answered >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5)
    .filter((u) => u.accuracy < 100);

  // ── クリアした単元（LearningProgress: COMPLETED）──
  const completed = await prisma.learningProgress.count({
    where: { userId, status: "COMPLETED" },
  });

  // ── 最近の解答（最新10件）──
  const recent = histories.slice(0, 10).map((h) => ({
    id: h.id,
    body: h.question.body,
    layer: h.question.layer,
    result: h.result,
    unitName: h.question.microUnit.unit.name,
    grade: h.question.microUnit.unit.subject.grade,
    answeredAt: h.answeredAt.toISOString(),
  }));

  return Response.json({
    summary: {
      total,
      correct,
      wrong,
      withHint,
      accuracy,
      studyDays,
      streak,
      completedUnits: completed,
    },
    byUnit,
    weakAreas,
    recent,
  });
}

/** 連続学習日数（最終学習日から途切れずに何日続いているか） */
function computeStreak(sortedDayKeys: string[]): number {
  if (sortedDayKeys.length === 0) return 0;
  const days = sortedDayKeys.map((d) => new Date(d + "T00:00:00Z").getTime());
  const DAY = 86_400_000;
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] === DAY) streak += 1;
    else break;
  }
  return streak;
}
