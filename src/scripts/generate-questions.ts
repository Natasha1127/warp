/**
 * AI問題生成スクリプト
 * 使い方: npx tsx src/scripts/generate-questions.ts
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY  Claude APIキー
 *   DATABASE_URL       PostgreSQL接続文字列
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

interface GeneratedQuestion {
  body: string;
  choices: {
    body: string;
    isCorrect: boolean;
    order: number;
  }[];
  explanation: string;
  hint: string;
}

async function generateQuestions(
  microUnitName: string,
  unitName: string,
  subjectName: string,
  grade: number,
  layer: number,
  count: number
): Promise<GeneratedQuestion[]> {
  const difficulty = ["", "かんたん（基礎的な理解）", "ふつう（応用的な理解）", "むずかしい（発展的な思考）"][layer];

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: `あなたは小学生〜高校生向けの教育コンテンツ作成の専門家です。
指定された単元・難易度に合わせた4択問題を作成してください。
必ずJSON形式で返答してください。`,
    messages: [
      {
        role: "user",
        content: `以下の条件で${count}問の4択問題を作成してください。

教科: ${subjectName}（${grade}年生）
単元: ${unitName}
マイクロ単元: ${microUnitName}
難易度: ${difficulty}

各問題には以下を含めてください:
- body: 問題文（わかりやすく、学年に適した表現）
- choices: 4つの選択肢（1つが正解）
  - body: 選択肢の文
  - isCorrect: 正解かどうか（boolean）
  - order: 表示順（1〜4）
- explanation: 解説（なぜその答えが正しいかを丁寧に説明）
- hint: ヒント（解くためのとっかかりを与える、答えは言わない）

JSON配列として返してください:
[
  {
    "body": "問題文",
    "choices": [
      {"body": "選択肢A", "isCorrect": false, "order": 1},
      {"body": "選択肢B", "isCorrect": true, "order": 2},
      {"body": "選択肢C", "isCorrect": false, "order": 3},
      {"body": "選択肢D", "isCorrect": false, "order": 4}
    ],
    "explanation": "解説文",
    "hint": "ヒント"
  }
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response");

  return JSON.parse(jsonMatch[0]) as GeneratedQuestion[];
}

async function seedDemoData() {
  console.log("🌱 デモデータを生成中...");

  // デモユーザー作成
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

  // Subject作成
  const subject = await prisma.subject.upsert({
    where: { id: "demo-subject" },
    update: {},
    create: {
      id: "demo-subject",
      name: "算数",
      grade: 4,
    },
  });

  // Unit作成
  const unit = await prisma.unit.upsert({
    where: { id: "demo-unit-1" },
    update: {},
    create: {
      id: "demo-unit-1",
      name: "かけ算",
      order: 1,
      subjectId: subject.id,
    },
  });

  // MicroUnit作成
  const microUnits = [
    { id: "mu-1", name: "2けた×1けた", order: 1 },
    { id: "mu-2", name: "3けた×1けた", order: 2 },
    { id: "mu-3", name: "2けた×2けた", order: 3 },
  ];

  for (const mu of microUnits) {
    await prisma.microUnit.upsert({
      where: { id: mu.id },
      update: {},
      create: { ...mu, unitId: unit.id },
    });
  }

  // 問題生成（AIを使用、または環境変数がない場合はサンプルデータ）
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️  ANTHROPIC_API_KEY が設定されていないため、サンプル問題を使用します");
    await seedSampleQuestions();
    return;
  }

  for (const mu of microUnits) {
    for (const layer of [1, 2, 3]) {
      console.log(`  📝 ${mu.name} / レイヤー${layer} の問題を生成中...`);
      try {
        const questions = await generateQuestions(
          mu.name, unit.name, subject.name, subject.grade, layer, 4
        );
        for (const q of questions) {
          const created = await prisma.question.create({
            data: {
              body: q.body,
              layer,
              explanation: q.explanation,
              hint: q.hint,
              microUnitId: mu.id,
              createdByAI: true,
              choices: {
                create: q.choices,
              },
            },
          });
          console.log(`    ✓ 問題ID: ${created.id}`);
        }
      } catch (e) {
        console.error(`    ✗ エラー:`, e);
      }
    }
  }

  console.log("✅ デモデータの生成が完了しました");
}

async function seedSampleQuestions() {
  const sampleQuestions = [
    {
      microUnitId: "mu-1",
      layer: 1,
      body: "23 × 3 はいくつですか？",
      explanation: "23 × 3 = (20 × 3) + (3 × 3) = 60 + 9 = 69 です。",
      hint: "20×3 と 3×3 を別々に計算してみましょう",
      choices: [
        { body: "59", isCorrect: false, order: 1 },
        { body: "69", isCorrect: true, order: 2 },
        { body: "79", isCorrect: false, order: 3 },
        { body: "62", isCorrect: false, order: 4 },
      ],
    },
    {
      microUnitId: "mu-1",
      layer: 1,
      body: "42 × 2 はいくつですか？",
      explanation: "42 × 2 = (40 × 2) + (2 × 2) = 80 + 4 = 84 です。",
      hint: "40×2 と 2×2 を別々に計算してみましょう",
      choices: [
        { body: "82", isCorrect: false, order: 1 },
        { body: "84", isCorrect: true, order: 2 },
        { body: "86", isCorrect: false, order: 3 },
        { body: "88", isCorrect: false, order: 4 },
      ],
    },
    {
      microUnitId: "mu-1",
      layer: 2,
      body: "35 × 4 はいくつですか？",
      explanation: "35 × 4 = (30 × 4) + (5 × 4) = 120 + 20 = 140 です。",
      hint: "くり上がりに注意して計算しましょう",
      choices: [
        { body: "120", isCorrect: false, order: 1 },
        { body: "130", isCorrect: false, order: 2 },
        { body: "140", isCorrect: true, order: 3 },
        { body: "150", isCorrect: false, order: 4 },
      ],
    },
    {
      microUnitId: "mu-1",
      layer: 2,
      body: "67 × 5 はいくつですか？",
      explanation: "67 × 5 = (60 × 5) + (7 × 5) = 300 + 35 = 335 です。",
      hint: "60×5 と 7×5 を計算してから足しましょう",
      choices: [
        { body: "325", isCorrect: false, order: 1 },
        { body: "335", isCorrect: true, order: 2 },
        { body: "345", isCorrect: false, order: 3 },
        { body: "355", isCorrect: false, order: 4 },
      ],
    },
    {
      microUnitId: "mu-1",
      layer: 3,
      body: "あるお店でりんごを78個仕入れました。1箱に6個ずつ入れると、全部で何個入りますか？",
      explanation: "78 × 6 = (70 × 6) + (8 × 6) = 420 + 48 = 468 です。つまり468個です。",
      hint: "かけ算の文章題です。78×6を筆算で解いてみましょう",
      choices: [
        { body: "448個", isCorrect: false, order: 1 },
        { body: "458個", isCorrect: false, order: 2 },
        { body: "468個", isCorrect: true, order: 3 },
        { body: "478個", isCorrect: false, order: 4 },
      ],
    },
    {
      microUnitId: "mu-1",
      layer: 3,
      body: "1本95円のジュースを9本買うと、合計いくらになりますか？",
      explanation: "95 × 9 = (90 × 9) + (5 × 9) = 810 + 45 = 855円 です。",
      hint: "95を90と5に分けて考えると計算しやすいです",
      choices: [
        { body: "835円", isCorrect: false, order: 1 },
        { body: "845円", isCorrect: false, order: 2 },
        { body: "855円", isCorrect: true, order: 3 },
        { body: "865円", isCorrect: false, order: 4 },
      ],
    },
  ];

  for (const q of sampleQuestions) {
    const { choices, ...questionData } = q;
    const created = await prisma.question.create({
      data: {
        ...questionData,
        createdByAI: false,
        choices: { create: choices },
      },
    });

    // レイヤー2の問題にはWARPリンク設定（mu-1のレイヤー1へ）
    if (q.layer === 2 || q.layer === 3) {
      const wrongChoices = await prisma.choice.findMany({
        where: { questionId: created.id, isCorrect: false },
      });
      if (wrongChoices.length > 0) {
        await prisma.choice.update({
          where: { id: wrongChoices[0].id },
          data: { warpMicroUnitId: "mu-1", warpLayer: 1 },
        });
      }
    }

    console.log(`  ✓ サンプル問題: ${q.body.slice(0, 30)}...`);
  }
}

seedDemoData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
