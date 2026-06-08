import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const SurveySchema = z.object({
  grade: z.number().int().min(1).max(6).optional(),
  studyingMicroUnitId: z.string().min(1).optional(),
  studyingUnitName: z.string().min(1).max(60).optional(),
  goal: z.string().min(1).max(60).optional(),
  favoriteSubject: z.string().min(1).max(60).optional(),
  weakSubject: z.string().min(1).max(60).optional(),
});

/** 新規登録アンケートの回答を保存する（ログイン中ユーザー）*/
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "未ログインです" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SurveySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return Response.json({ error: msg }, { status: 400 });
  }

  const d = parsed.data;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      surveyCompleted: true,
      ...(d.grade !== undefined ? { grade: d.grade } : {}),
      ...(d.studyingMicroUnitId !== undefined ? { studyingMicroUnitId: d.studyingMicroUnitId } : {}),
      ...(d.studyingUnitName !== undefined ? { studyingUnitName: d.studyingUnitName } : {}),
      ...(d.goal !== undefined ? { goal: d.goal } : {}),
      ...(d.favoriteSubject !== undefined ? { favoriteSubject: d.favoriteSubject } : {}),
      ...(d.weakSubject !== undefined ? { weakSubject: d.weakSubject } : {}),
    },
    select: {
      id: true,
      grade: true,
      surveyCompleted: true,
      studyingMicroUnitId: true,
      studyingUnitName: true,
      goal: true,
      favoriteSubject: true,
      weakSubject: true,
    },
  });

  return Response.json({ user });
}
