import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 学年（または教科）の単元一覧を返す。
 * GET /api/units?grade=4  または  /api/units?subjectId=math-g4
 * 各単元の最初のマイクロ単元IDも返す（学習開始用）。
 */
export async function GET(req: NextRequest) {
  const gradeParam = req.nextUrl.searchParams.get("grade");
  const subjectIdParam = req.nextUrl.searchParams.get("subjectId");

  let subjectId = subjectIdParam ?? undefined;
  if (!subjectId && gradeParam != null) {
    const subject = await prisma.subject.findFirst({
      where: { grade: Number(gradeParam) },
      orderBy: { createdAt: "asc" },
    });
    if (!subject) {
      return Response.json({ error: `${gradeParam}年生の教科が見つかりません` }, { status: 404 });
    }
    subjectId = subject.id;
  }

  if (!subjectId) {
    return Response.json({ error: "grade or subjectId required" }, { status: 400 });
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          microUnits: {
            orderBy: { order: "asc" },
            include: { _count: { select: { questions: true } } },
          },
        },
      },
    },
  });

  if (!subject) {
    return Response.json({ error: "Subject not found" }, { status: 404 });
  }

  const units = subject.units.map((u) => {
    const questionCount = u.microUnits.reduce(
      (sum, mu) => sum + mu._count.questions,
      0
    );
    return {
      id: u.id,
      name: u.name,
      order: u.order,
      firstMicroUnitId: u.microUnits[0]?.id ?? null,
      microUnitCount: u.microUnits.length,
      questionCount,
    };
  });

  return Response.json({
    subject: { id: subject.id, name: subject.name, grade: subject.grade },
    units,
  });
}
