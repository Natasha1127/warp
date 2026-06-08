/**
 * 問題データ投入スクリプト
 * 使い方: npm run db:seed
 *
 * src/data/questions.ts の SUBJECTS を読み込み、
 * Subject → Unit → MicroUnit → Question → Choice を投入する。
 * WARP先（不正解2回目）は各マイクロ単元の1つ前のレイヤー/単元へ自動設定。
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUBJECTS } from "../data/questions";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 問題データを投入します...");

  // デモユーザー
  await prisma.user.upsert({
    where: { id: "demo-user" },
    update: {},
    create: {
      id: "demo-user",
      email: "demo@warp.app",
      name: "デモユーザー",
      passwordHash: "demo",
      role: "STUDENT",
      grade: 4,
    },
  });

  // 既存データをクリア（冪等性のため、依存順に削除）
  await prisma.answerHistory.deleteMany({});
  await prisma.studySession.deleteMany({});
  await prisma.learningProgress.deleteMany({});
  await prisma.choice.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.microUnit.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.subject.deleteMany({});

  let totalQuestions = 0;

  for (const subject of SUBJECTS) {
    await prisma.subject.create({
      data: { id: subject.id, name: subject.name, grade: subject.grade },
    });
    console.log(`\n📚 ${subject.name}（${subject.grade}年生）`);

    // 単元を順に処理。各マイクロ単元のidを順序つきで集める（WARP先決定用）
    const orderedMicroUnitIds: string[] = [];

    for (const unit of subject.units) {
      await prisma.unit.create({
        data: { id: unit.id, name: unit.name, order: unit.order, subjectId: subject.id },
      });
      console.log(`  📖 ${unit.name}`);

      for (const mu of unit.microUnits) {
        await prisma.microUnit.create({
          data: { id: mu.id, name: mu.name, order: mu.order, unitId: unit.id },
        });
        orderedMicroUnitIds.push(mu.id);
        const prevMicroUnitId =
          orderedMicroUnitIds.length >= 2
            ? orderedMicroUnitIds[orderedMicroUnitIds.length - 2]
            : null;

        for (const layerBlock of mu.layers) {
          for (const q of layerBlock.questions) {
            // WARP先決定:
            //   レイヤー2,3 → 同マイクロ単元のレイヤー1
            //   レイヤー1   → 1つ前のマイクロ単元のレイヤー1（無ければ自分のレイヤー1）
            const warpMicroUnitId =
              layerBlock.layer >= 2 ? mu.id : prevMicroUnitId ?? mu.id;
            const warpLayer = 1;

            const created = await prisma.question.create({
              data: {
                body: q.body,
                figure: q.figure ?? null,
                layer: layerBlock.layer,
                explanation: q.explanation,
                hint: q.hint,
                microUnitId: mu.id,
                createdByAI: false,
              },
            });

            // 選択肢作成。最初の不正解選択肢にWARP先を設定
            let warpAssigned = false;
            for (const c of q.choices) {
              const assignWarp = !c.isCorrect && !warpAssigned;
              if (assignWarp) warpAssigned = true;
              await prisma.choice.create({
                data: {
                  body: c.body,
                  isCorrect: c.isCorrect,
                  order: c.order,
                  questionId: created.id,
                  warpMicroUnitId: assignWarp ? warpMicroUnitId : null,
                  warpLayer: assignWarp ? warpLayer : null,
                },
              });
            }
            totalQuestions++;
          }
        }
      }
    }
  }

  console.log(`\n✅ 完了！ 合計 ${totalQuestions} 問を投入しました`);
}

main()
  .catch((e) => {
    console.error("❌ エラー:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
