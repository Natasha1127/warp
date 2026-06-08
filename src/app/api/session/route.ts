import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";

const CreateSessionSchema = z.object({
  subjectId: z.string().optional(),
  grade: z.number().optional(),
  microUnitId: z.string().optional(),
  unitId: z.string().optional(),
});

/** セッション開始：最初のマイクロ単元・レイヤー1からスタート */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  let { subjectId } = parsed.data;

  // gradeが指定された場合は学年から教科を特定（最初の教科）
  if (!subjectId && parsed.data.grade != null) {
    const subject = await prisma.subject.findFirst({
      where: { grade: parsed.data.grade },
      orderBy: { createdAt: "asc" },
    });
    if (!subject) {
      return Response.json({ error: `${parsed.data.grade}年生の教科が見つかりません` }, { status: 404 });
    }
    subjectId = subject.id;
  }

  if (!subjectId) {
    return Response.json({ error: "subjectId or grade required" }, { status: 400 });
  }

  // 開始マイクロ単元を決定。
  //  - microUnitId 指定: そのマイクロ単元から
  //  - unitId 指定: その単元の最初のマイクロ単元から
  //  - 指定なし: 教科の最初のマイクロ単元から
  let startMicroUnit = null;
  if (parsed.data.microUnitId) {
    startMicroUnit = await prisma.microUnit.findUnique({
      where: { id: parsed.data.microUnitId },
    });
  } else if (parsed.data.unitId) {
    startMicroUnit = await prisma.microUnit.findFirst({
      where: { unitId: parsed.data.unitId },
      orderBy: { order: "asc" },
    });
  }
  if (!startMicroUnit) {
    startMicroUnit = await prisma.microUnit.findFirst({
      where: { unit: { subjectId } },
      orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
    });
  }
  if (!startMicroUnit) {
    return Response.json({ error: "No micro units found" }, { status: 404 });
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      subjectId,
      currentMicroUnitId: startMicroUnit.id,
      currentLayer: 1,
    },
    include: { currentMicroUnit: { include: { unit: { include: { subject: true } } } } },
  });

  return Response.json({ session });
}

/** セッション取得 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    include: { currentMicroUnit: { include: { unit: { include: { subject: true } } } } },
  });

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ session });
}
