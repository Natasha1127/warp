/**
 * 小学校カラーテスト準拠 問題データ（全学年・全単元）
 *
 * 計算系の単元はプログラムで生成（答えが正確・大量に用意可能）、
 * 概念系の単元は手書き4択で構成。
 *
 * 構造: Subject → Unit → MicroUnit → Layer → Question(4択)
 */

export interface ChoiceData {
  body: string;
  isCorrect: boolean;
  order: number;
}

export interface QuestionData {
  body: string;
  explanation: string;
  hint: string;
  /** 図・グラフのレンダリング指定。例: "dots|3" / "bars|りんご:3,みかん:5" / "clock|3:00" / "seq|★,☆,●,◆" */
  figure?: string;
  choices: ChoiceData[];
}

export interface LayerData {
  layer: number; // 1=かんたん 2=ふつう 3=むずかしい
  questions: QuestionData[];
}

export interface MicroUnitData {
  id: string;
  name: string;
  order: number;
  layers: LayerData[];
}

export interface UnitData {
  id: string;
  name: string;
  order: number;
  microUnits: MicroUnitData[];
}

export interface SubjectData {
  id: string;
  name: string;
  grade: number;
  units: UnitData[];
}

// ─── ヘルパー ────────────────────────────────────────────────────

/** 決定論的な疑似乱数（seedベース）。投入のたびに同じ並びになる */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _seedCounter = 1;
function nextRand() {
  const r = mulberry32(_seedCounter * 2654435761);
  _seedCounter++;
  return r();
}

function rint(min: number, max: number): number {
  return min + Math.floor(nextRand() * (max - min + 1));
}

/** 整数のmax公約数・最小公倍数 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}
/** 約分した分数文字列 */
function fracStr(n: number, d: number): string {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  const nn = n / g;
  const dd = d / g;
  return dd === 1 ? `${nn}` : `${nn}/${dd}`;
}

/**
 * 正解値と誤答候補から4択を作る。正解の位置はランダム。
 * 誤答は重複・負数(数値の場合)を除外し、足りなければ補完。
 */
function makeChoices(
  correct: number | string,
  distractors: (number | string)[],
  suffix = ""
): ChoiceData[] {
  const correctStr = `${correct}${suffix}`;
  const seen = new Set<string>([correctStr]);
  const valid: string[] = [];
  for (const d of distractors) {
    if (typeof d === "number" && d < 0) continue;
    const s = `${d}${suffix}`;
    if (!seen.has(s)) {
      seen.add(s);
      valid.push(s);
    }
  }
  let pad = 1;
  while (valid.length < 3 && typeof correct === "number") {
    for (const delta of [pad, -pad]) {
      const cand = correct + delta;
      const s = `${cand}${suffix}`;
      if (cand >= 0 && !seen.has(s)) {
        seen.add(s);
        valid.push(s);
      }
      if (valid.length >= 3) break;
    }
    pad++;
    if (pad > 80) break;
  }
  while (valid.length < 3) valid.push(`${correctStr}_${valid.length}`);

  const picks = valid.slice(0, 3);
  const correctPos = Math.floor(nextRand() * 4);
  const bodies: string[] = [];
  let di = 0;
  for (let i = 0; i < 4; i++) {
    if (i === correctPos) bodies.push(correctStr);
    else bodies.push(picks[di++] ?? `${correctStr}_`);
  }
  return bodies.map((body, i) => ({
    body,
    isCorrect: i === correctPos,
    order: i + 1,
  }));
}

/** これまでに生成した問題文。重複を防ぐためグローバルに記録する */
const _usedBodies = new Set<string>();

/**
 * 計算問題を生成する。問題文が重複しないよう、既出の body が出たら
 * 上限回数まで作り直す。組み合わせを使い切った場合のみ重複を許容する。
 */
function gen(count: number, factory: (i: number) => QuestionData): QuestionData[] {
  const out: QuestionData[] = [];
  for (let i = 0; i < count; i++) {
    let q = factory(i);
    let tries = 0;
    while (_usedBodies.has(q.body) && tries < 80) {
      q = factory(i);
      tries++;
    }
    _usedBodies.add(q.body);
    out.push(q);
  }
  return out;
}

/** 概念問題の短縮コンストラクタ */
function C(
  body: string,
  correct: string,
  distractors: string[],
  explanation: string,
  hint = "",
  figure = ""
): QuestionData {
  _usedBodies.add(body);
  return {
    body,
    explanation,
    hint,
    ...(figure ? { figure } : {}),
    choices: makeChoices(correct, distractors),
  };
}

/** 単元（1マイクロ単元）の組み立て。l1/l2/l3 は QuestionData[] */
function simpleUnit(
  id: string,
  name: string,
  order: number,
  l1: QuestionData[],
  l2: QuestionData[],
  l3: QuestionData[]
): UnitData {
  return {
    id,
    name,
    order,
    microUnits: [
      {
        id: `${id}-mu1`,
        name,
        order: 1,
        layers: [
          { layer: 1, questions: l1 },
          { layer: 2, questions: l2 },
          { layer: 3, questions: l3 },
        ],
      },
    ],
  };
}

// ─── 計算問題ファクトリ ───────────────────────────────────────────

function addQ(maxA: number, maxB: number, minA = 1, minB = 1): QuestionData {
  const a = rint(minA, maxA);
  const b = rint(minB, maxB);
  const ans = a + b;
  return {
    body: `${a} + ${b} = ？`,
    explanation: `${a} に ${b} をたすと ${ans} になります。`,
    hint: `${a} から ${b} こ かぞえてみよう。`,
    choices: makeChoices(ans, [ans + 1, ans - 1, ans + 10, ans - 10]),
  };
}

function subQ(maxA: number, maxB: number): QuestionData {
  const a = rint(maxB + 1, maxA);
  const b = rint(1, Math.min(maxB, a - 1));
  const ans = a - b;
  return {
    body: `${a} - ${b} = ？`,
    explanation: `${a} から ${b} をひくと ${ans} になります。`,
    hint: `${a} から ${b} こ もどってかぞえてみよう。`,
    choices: makeChoices(ans, [ans + 1, ans - 1, a + b, ans + 10]),
  };
}

/** 3つの数の計算 a + b - c */
function threeNumQ(): QuestionData {
  const a = rint(3, 8);
  const b = rint(1, 6);
  const c = rint(1, a + b - 1);
  const ans = a + b - c;
  return {
    body: `${a} + ${b} - ${c} = ？`,
    explanation: `まず ${a} + ${b} = ${a + b}、つぎに ${a + b} - ${c} = ${ans} です。`,
    hint: "前から じゅんばんに 計算しよう。",
    choices: makeChoices(ans, [ans + 1, ans - 1, a + b + c]),
  };
}

function multTableQ(minA: number, maxA: number): QuestionData {
  const a = rint(minA, maxA);
  const b = rint(1, 9);
  const ans = a * b;
  return {
    body: `${a} × ${b} = ？`,
    explanation: `${a} の だん。${a} × ${b} = ${ans} です。`,
    hint: `${a} を ${b} 回たすと いくつかな？`,
    choices: makeChoices(ans, [ans + a, ans - a, ans + b, a * (b + 1)]),
  };
}

function multQ(aMin: number, aMax: number, bMin: number, bMax: number): QuestionData {
  const a = rint(aMin, aMax);
  const b = rint(bMin, bMax);
  const ans = a * b;
  return {
    body: `${a} × ${b} = ？`,
    explanation: `${a} × ${b} = ${ans}。位ごとに計算してくり上がりをたします。`,
    hint: `${a} を分けて かけ算してみよう。`,
    choices: makeChoices(ans, [ans + b, ans - b, ans + 10, a * (b + 1)]),
  };
}

function divQ(bMin: number, bMax: number, qMin: number, qMax: number): QuestionData {
  const b = rint(bMin, bMax);
  const q = rint(qMin, qMax);
  const a = b * q;
  return {
    body: `${a} ÷ ${b} = ？`,
    explanation: `${b} × ${q} = ${a} なので、${a} ÷ ${b} = ${q} です。`,
    hint: `${b} に何をかけたら ${a} になるかな？`,
    choices: makeChoices(q, [q + 1, q - 1, q + 2]),
  };
}

function divRemQ(bMin: number, bMax: number): QuestionData {
  const b = rint(bMin, bMax);
  const q = rint(2, 9);
  const r = rint(1, b - 1);
  const a = b * q + r;
  return {
    body: `${a} ÷ ${b} = ？`,
    explanation: `${b} × ${q} = ${b * q}、のこりが ${r} なので「${q} あまり ${r}」です。`,
    hint: `${b} のだんで ${a} をこえない一番大きい数をさがそう。`,
    choices: makeChoices(`${q}あまり${r}`, [
      `${q}あまり${(r + 1) % b}`,
      `${q + 1}あまり${r}`,
      `${q - 1}あまり${r}`,
    ]),
  };
}

function decimalAddQ(): QuestionData {
  const a = rint(1, 9) + rint(0, 9) / 10;
  const c = rint(1, 9) + rint(0, 9) / 10;
  const ans = Math.round((a + c) * 10) / 10;
  return {
    body: `${a.toFixed(1)} + ${c.toFixed(1)} = ？`,
    explanation: `小数点をそろえて計算すると ${ans.toFixed(1)} です。`,
    hint: "小数点の位置をそろえて、ふつうのたし算をしよう。",
    choices: makeChoices(ans.toFixed(1), [
      (ans + 0.1).toFixed(1),
      (ans - 0.1).toFixed(1),
      (ans + 1).toFixed(1),
    ]),
  };
}

function decimalSubQ(): QuestionData {
  let a = rint(3, 9) + rint(0, 9) / 10;
  let c = rint(1, 2) + rint(0, 9) / 10;
  if (c > a) [a, c] = [c, a];
  const ans = Math.round((a - c) * 10) / 10;
  return {
    body: `${a.toFixed(1)} - ${c.toFixed(1)} = ？`,
    explanation: `小数点をそろえて計算すると ${ans.toFixed(1)} です。`,
    hint: "小数点をそろえてから ひき算をしよう。",
    choices: makeChoices(ans.toFixed(1), [
      (ans + 0.1).toFixed(1),
      (ans - 0.1).toFixed(1),
      (ans + 1).toFixed(1),
    ]),
  };
}

function decimalMultIntQ(): QuestionData {
  const a = rint(1, 9) + rint(1, 9) / 10;
  const b = rint(2, 9);
  const ans = Math.round(a * b * 10) / 10;
  return {
    body: `${a.toFixed(1)} × ${b} = ？`,
    explanation: `${a.toFixed(1)} を ${b} 回たすと ${ans.toFixed(1)} です。`,
    hint: "整数のかけ算をしてから、小数点を1つ左にうつそう。",
    choices: makeChoices(ans.toFixed(1), [
      (ans + 0.1).toFixed(1),
      (ans * 10).toFixed(1),
      (ans + 1).toFixed(1),
    ]),
  };
}

function decimalDivIntQ(): QuestionData {
  const b = rint(2, 6);
  const q = rint(1, 9) + rint(1, 9) / 10;
  const a = Math.round(q * b * 10) / 10;
  const ans = Math.round((a / b) * 10) / 10;
  return {
    body: `${a.toFixed(1)} ÷ ${b} = ？`,
    explanation: `${a.toFixed(1)} ÷ ${b} = ${ans.toFixed(1)} です。`,
    hint: "わり算をして、商の小数点は わられる数にそろえよう。",
    choices: makeChoices(ans.toFixed(1), [
      (ans + 0.1).toFixed(1),
      (ans - 0.1).toFixed(1),
      (ans + 1).toFixed(1),
    ]),
  };
}

/** 小数 × 小数（1桁×1桁→小数第2位） */
function decimalMultDecimalQ(): QuestionData {
  const ai = rint(11, 39);
  const bi = rint(11, 29);
  const a = ai / 10;
  const b = bi / 10;
  const ans = Math.round(ai * bi) / 100;
  const wrongTen = Math.round(ans * 10 * 100) / 100;
  return {
    body: `${a.toFixed(1)} × ${b.toFixed(1)} = ？`,
    explanation: `整数として ${ai} × ${bi} = ${ai * bi}、小数点を2つ動かして ${ans} です。`,
    hint: "整数でかけ算し、小数点以下のけた数の合計だけ小数点を動かそう。",
    choices: makeChoices(`${ans}`, [`${Math.round((ans + 0.1) * 100) / 100}`, `${wrongTen}`, `${Math.round((ans - 0.1) * 100) / 100}`]),
  };
}

/** 小数 ÷ 小数（わり切れる、商は整数か1桁小数） */
function decimalDivDecimalQ(): QuestionData {
  const b = rint(2, 9) / 10;
  const q = rint(2, 9);
  const a = Math.round(b * q * 10) / 10;
  return {
    body: `${a.toFixed(1)} ÷ ${b.toFixed(1)} = ？`,
    explanation: `わる数とわられる数を10倍して ${a * 10} ÷ ${b * 10} = ${q} です。`,
    hint: "わる数が整数になるよう、両方を10倍してから計算しよう。",
    choices: makeChoices(q, [q + 1, q - 1, q + 2]),
  };
}

function rectAreaQ(): QuestionData {
  const w = rint(2, 12);
  const h = rint(2, 12);
  const ans = w * h;
  return {
    body: `たて ${h}cm、よこ ${w}cm の長方形の面積は？`,
    explanation: `長方形の面積 = たて × よこ = ${h} × ${w} = ${ans}（cm²）です。`,
    hint: "面積は「たて × よこ」で もとめられるよ。",
    choices: makeChoices(ans, [w + h, (w + h) * 2, ans + w], "cm²"),
  };
}

function squareAreaQ(): QuestionData {
  const s = rint(2, 15);
  const ans = s * s;
  return {
    body: `1辺が ${s}cm の正方形の面積は？`,
    explanation: `正方形の面積 = 1辺 × 1辺 = ${s} × ${s} = ${ans}（cm²）です。`,
    hint: "正方形は たてとよこが同じ長さだよ。",
    choices: makeChoices(ans, [s * 4, s + s, ans + s], "cm²"),
  };
}

/** 平行四辺形の面積 = 底辺 × 高さ */
function paralleloAreaQ(): QuestionData {
  const b = rint(3, 12);
  const h = rint(2, 10);
  const ans = b * h;
  return {
    body: `底辺 ${b}cm、高さ ${h}cm の平行四辺形の面積は？`,
    explanation: `平行四辺形の面積 = 底辺 × 高さ = ${b} × ${h} = ${ans}cm² です。`,
    hint: "平行四辺形の面積は「底辺 × 高さ」。ななめの辺は使わないよ。",
    choices: makeChoices(ans, [(b * h) / 2, b + h, ans + b], "cm²"),
  };
}

/** 三角形の面積 = 底辺 × 高さ ÷ 2 */
function triangleAreaQ(): QuestionData {
  const b = rint(2, 6) * 2;
  const h = rint(2, 10);
  const ans = (b * h) / 2;
  return {
    body: `底辺 ${b}cm、高さ ${h}cm の三角形の面積は？`,
    explanation: `三角形の面積 = 底辺 × 高さ ÷ 2 = ${b} × ${h} ÷ 2 = ${ans}cm² です。`,
    hint: "三角形の面積は「底辺 × 高さ ÷ 2」。",
    choices: makeChoices(ans, [b * h, b + h, ans + b], "cm²"),
  };
}

/** 直方体の体積 = たて×よこ×高さ */
function boxVolumeQ(): QuestionData {
  const a = rint(2, 8);
  const b = rint(2, 8);
  const c = rint(2, 8);
  const ans = a * b * c;
  return {
    body: `たて ${a}cm、よこ ${b}cm、高さ ${c}cm の直方体の体積は？`,
    explanation: `体積 = たて × よこ × 高さ = ${a} × ${b} × ${c} = ${ans}cm³ です。`,
    hint: "直方体の体積は「たて × よこ × 高さ」。",
    choices: makeChoices(ans, [a + b + c, a * b, ans + a], "cm³"),
  };
}

/** 円周 = 直径 × 3.14 */
function circumferenceQ(): QuestionData {
  const d = rint(2, 20);
  const ans = Math.round(d * 3.14 * 100) / 100;
  return {
    body: `直径 ${d}cm の円のまわりの長さ（円周）は？（円周率3.14）`,
    explanation: `円周 = 直径 × 3.14 = ${d} × 3.14 = ${ans}cm です。`,
    hint: "円周 = 直径 × 円周率(3.14)。",
    choices: makeChoices(`${ans}`, [`${Math.round(d * 3.14 * 2 * 100) / 100}`, `${d * 3}`, `${Math.round((d / 2) * 3.14 * 100) / 100}`], "cm"),
  };
}

/** 円の面積 = 半径 × 半径 × 3.14 */
function circleAreaQ(): QuestionData {
  const r = rint(2, 15);
  const ans = Math.round(r * r * 3.14 * 100) / 100;
  return {
    body: `半径 ${r}cm の円の面積は？（円周率3.14）`,
    explanation: `円の面積 = 半径 × 半径 × 3.14 = ${r} × ${r} × 3.14 = ${ans}cm² です。`,
    hint: "円の面積 = 半径 × 半径 × 円周率(3.14)。",
    choices: makeChoices(`${ans}`, [`${Math.round(r * 2 * 3.14 * 100) / 100}`, `${r * r}`, `${Math.round(r * 3.14 * 100) / 100}`], "cm²"),
  };
}

/** 平均 */
function averageQ(): QuestionData {
  const n = rint(3, 4);
  const avg = rint(4, 12);
  const nums: number[] = [];
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const v = avg + rint(-3, 3);
    nums.push(v);
    sum += v;
  }
  const last = avg * n - sum;
  nums.push(last);
  return {
    body: `${nums.join("、")} の平均は？`,
    explanation: `合計 ${avg * n} ÷ こ数 ${n} = ${avg} です。`,
    hint: "平均 = 合計 ÷ 個数。",
    choices: makeChoices(avg, [avg + 1, avg - 1, avg * n]),
  };
}

/** 単位量あたり（1あたりの数） */
function unitRateQ(): QuestionData {
  const per = rint(3, 12);
  const units = rint(3, 8);
  const total = per * units;
  return {
    body: `${units}m² に ${total}人いるとき、1m² あたり何人？`,
    explanation: `${total} ÷ ${units} = ${per}人 です。`,
    hint: "1あたりの数 = 全体 ÷ いくつ分。",
    choices: makeChoices(per, [per + 1, per - 1, total], "人"),
  };
}

/** がい数（四捨五入） */
function roundQ(): QuestionData {
  const unit = [100, 1000][rint(0, 1)];
  const n = rint(unit === 100 ? 150 : 1500, unit === 100 ? 9500 : 95000);
  const ans = Math.round(n / unit) * unit;
  const place = unit === 100 ? "百" : "千";
  return {
    body: `${n} を四捨五入して、${place}の位までのがい数にすると？`,
    explanation: `1つ下の位で四捨五入すると ${ans} になります。`,
    hint: `${place}の位の1つ下の位を見て、0〜4なら切りすて、5〜9なら切り上げ。`,
    choices: makeChoices(ans, [ans + unit, ans - unit, n]),
  };
}

/** 計算のきまり（分配・順序） a×(b+c) */
function calcRuleQ(): QuestionData {
  const a = rint(2, 9);
  const b = rint(2, 9);
  const c = rint(2, 9);
  const ans = a * (b + c);
  return {
    body: `${a} × (${b} + ${c}) = ？`,
    explanation: `( )の中を先に計算して ${a} × ${b + c} = ${ans} です。`,
    hint: "( )の中を先に計算しよう。",
    choices: makeChoices(ans, [a * b + c, a + b * c, a * b * c]),
  };
}

/** 倍の計算 */
function timesQ(): QuestionData {
  const base = rint(2, 12);
  const k = rint(2, 6);
  const ans = base * k;
  return {
    body: `${base}cm の ${k}倍は何cm？`,
    explanation: `${base} × ${k} = ${ans}cm です。`,
    hint: "○倍 = もとの数 × ○。",
    choices: makeChoices(ans, [base + k, ans + base, ans - base], "cm"),
  };
}

/** 一番大きい数（大小比較） */
function biggestQ(digits: number): QuestionData {
  const max = Math.pow(10, digits);
  const set = new Set<number>();
  while (set.size < 4) set.add(rint(Math.pow(10, digits - 1), max - 1));
  const arr = [...set];
  const ans = Math.max(...arr);
  const others = arr.filter((x) => x !== ans).map((x) => `${x}`);
  return {
    body: `${arr.join("、")} のうち いちばん大きい数はどれ？`,
    explanation: `${arr.join("、")} の中で いちばん大きいのは ${ans} です。`,
    hint: "上の位（左）からくらべよう。けた数が同じなら左の数字が大きい方が大きい。",
    choices: makeChoices(`${ans}`, others),
  };
}

/** ○倍すると（10倍・100倍） */
function scaleNumQ(): QuestionData {
  const base = rint(2, 9) * rint(1, 9);
  const f = [10, 100][rint(0, 1)];
  const ans = base * f;
  return {
    body: `${base} を ${f}倍するといくつ？`,
    explanation: `${f}倍すると位が${f === 10 ? "1つ" : "2つ"}上がって ${ans} です。`,
    hint: `${f}倍は 右に0を${f === 10 ? "1こ" : "2こ"}つけるよ。`,
    choices: makeChoices(ans, [base * (f === 10 ? 100 : 10), base + f, ans + base]),
  };
}

/** 同分母分数のたし算 */
function fracAddSameQ(): QuestionData {
  const d = rint(4, 9);
  const a = rint(1, d - 2);
  const b = rint(1, d - 1 - a);
  return {
    body: `${a}/${d} + ${b}/${d} = ？`,
    explanation: `分母はそのまま、分子をたして ${a + b}/${d} です。`,
    hint: "分母が同じなら、分子だけたそう。",
    choices: makeChoices(`${a + b}/${d}`, [`${a + b}/${d * 2}`, `${a + b + 1}/${d}`, `${a * b}/${d}`]),
  };
}

/** 同分母分数のひき算 */
function fracSubSameQ(): QuestionData {
  const d = rint(4, 9);
  const a = rint(2, d - 1);
  const b = rint(1, a - 1);
  return {
    body: `${a}/${d} - ${b}/${d} = ？`,
    explanation: `分母はそのまま、分子をひいて ${a - b}/${d} です。`,
    hint: "分母が同じなら、分子だけひこう。",
    choices: makeChoices(`${a - b}/${d}`, [`${a - b}/${d * 2}`, `${a - b + 1}/${d}`, `${a + b}/${d}`]),
  };
}

/** 異分母分数のたし算（通分） */
function fracAddDiffQ(): QuestionData {
  const d1 = rint(2, 6);
  let d2 = rint(2, 8);
  while (d2 === d1) d2 = rint(2, 8);
  const a = rint(1, d1 - 1);
  const b = rint(1, d2 - 1);
  const L = lcm(d1, d2);
  const num = (a * L) / d1 + (b * L) / d2;
  return {
    body: `${a}/${d1} + ${b}/${d2} = ？`,
    explanation: `通分すると ${(a * L) / d1}/${L} + ${(b * L) / d2}/${L} = ${fracStr(num, L)} です。`,
    hint: "分母をそろえて(通分して)から計算しよう。",
    choices: makeChoices(fracStr(num, L), [`${a + b}/${d1 + d2}`, fracStr(num + 1, L), `${a + b}/${L}`]),
  };
}

/** 分数 × 分数 */
function fracMultQ(): QuestionData {
  const a = rint(1, 4);
  const b = rint(2, 6);
  const c = rint(1, 4);
  const d = rint(2, 6);
  const ans = fracStr(a * c, b * d);
  return {
    body: `${a}/${b} × ${c}/${d} = ？`,
    explanation: `分子どうし・分母どうしをかけて ${a * c}/${b * d} = ${ans} です。`,
    hint: "分数のかけ算は 分子×分子 / 分母×分母。",
    choices: makeChoices(ans, [fracStr(a + c, b + d), fracStr(a * c, b + d), `${a * c}/${b * d}_`]),
  };
}

/** 分数 ÷ 分数 */
function fracDivQ(): QuestionData {
  const a = rint(1, 4);
  const b = rint(2, 6);
  const c = rint(1, 4);
  const d = rint(2, 6);
  const ans = fracStr(a * d, b * c);
  return {
    body: `${a}/${b} ÷ ${c}/${d} = ？`,
    explanation: `わる数の逆数をかけて ${a}/${b} × ${d}/${c} = ${a * d}/${b * c} = ${ans} です。`,
    hint: "分数のわり算は、わる数をひっくり返してかけよう。",
    choices: makeChoices(ans, [fracStr(a * c, b * d), fracStr(a * d, b * c) + "_", `${a}/${b}`]),
  };
}

/** 最大公約数 */
function gcdQ(): QuestionData {
  const g = rint(2, 6);
  const a = g * rint(2, 5);
  const b = g * rint(2, 5);
  const ans = gcd(a, b);
  return {
    body: `${a} と ${b} の最大公約数は？`,
    explanation: `${a}と${b}の両方をわり切れる いちばん大きい数は ${ans} です。`,
    hint: "両方の約数を書き出して、共通で最大のものを探そう。",
    choices: makeChoices(ans, [ans + 1, ans * 2, gcd(a, b) - 1 || 1]),
  };
}

/** 百分率（小数→%） */
function percentFromDecQ(): QuestionData {
  const dec = rint(1, 9) / 10;
  const ans = dec * 100;
  return {
    body: `小数の ${dec} を百分率（％）で表すと？`,
    explanation: `${dec} × 100 = ${ans}％ です。`,
    hint: "100倍すると百分率になるよ。",
    choices: makeChoices(ans, [ans / 10, ans * 10, ans + 10], "％"),
  };
}

/** 割合：もとにする量の□% */
function percentOfQ(): QuestionData {
  const base = rint(2, 10) * 10;
  const pct = rint(1, 9) * 10;
  const ans = (base * pct) / 100;
  return {
    body: `${base}人の ${pct}％ は何人？`,
    explanation: `${base} × ${pct / 100} = ${ans}人 です。`,
    hint: "百分率を小数になおしてかけよう。",
    choices: makeChoices(ans, [ans + base / 10, ans * 2, base - ans], "人"),
  };
}

/** 比の値 */
function ratioValueQ(): QuestionData {
  const a = rint(2, 8);
  const b = rint(2, 8);
  return {
    body: `${a} : ${b} の比の値は？`,
    explanation: `比の値は ${a} ÷ ${b} = ${fracStr(a, b)} です。`,
    hint: "比の値 = 前の数 ÷ 後ろの数。",
    choices: makeChoices(fracStr(a, b), [fracStr(b, a), `${a + b}`, `${a * b}`]),
  };
}

/** 等しい比 a:b = ?:bk */
function equalRatioQ(): QuestionData {
  const a = rint(2, 6);
  const b = rint(2, 6);
  const k = rint(2, 5);
  const ans = a * k;
  return {
    body: `${a} : ${b} = □ : ${b * k}　□に入る数は？`,
    explanation: `${b}を${k}倍したので、${a}も${k}倍して ${ans} です。`,
    hint: "後ろの数が何倍になったか考え、前の数も同じだけかけよう。",
    choices: makeChoices(ans, [a + k, ans + a, a * b]),
  };
}

/** 比例 */
function proportionQ(): QuestionData {
  const k = rint(2, 6);
  const x1 = rint(2, 4);
  const x2 = rint(5, 9);
  const y1 = k * x1;
  const ans = k * x2;
  return {
    body: `yはxに比例し、x=${x1}のときy=${y1}です。x=${x2}のときyは？`,
    explanation: `比例定数は ${y1}÷${x1}=${k}。y=${k}×${x2}=${ans} です。`,
    hint: "y = きまった数 × x。まずきまった数を求めよう。",
    choices: makeChoices(ans, [ans + k, y1 + x2, ans - k]),
  };
}

/** 文字と式（代入） */
function substituteQ(): QuestionData {
  const a = rint(2, 6);
  const b = rint(1, 9);
  const x = rint(2, 7);
  const ans = a * x + b;
  return {
    body: `x = ${x} のとき、${a}×x + ${b} の値は？`,
    explanation: `${a}×${x}+${b} = ${a * x}+${b} = ${ans} です。`,
    hint: "xのところに数をあてはめて計算しよう。",
    choices: makeChoices(ans, [a + x + b, a * x, ans + a]),
  };
}

export const SUBJECTS: SubjectData[] = [
  // ════ 1年生 ════
  {
    id: "math-g1",
    name: "算数",
    grade: 1,
    units: [
      simpleUnit("g1-u1", "なかまづくりとかず", 1,
        [
          C("○は いくつ あるかな？", "3", ["2", "4", "5"], "○が3こ あります。3です。", "ひとつずつ かぞえよう。", "dots|3"),
          C("5は 2と いくつ？", "3", ["2", "4", "1"], "2と3で5です。", "5を 2つに わけてみよう。"),
          C("6は 4と いくつ？", "2", ["3", "1", "4"], "4と2で6です。", "6を 4と□に わけよう。"),
        ],
        [
          C("8は 5と いくつ？", "3", ["2", "4", "5"], "5と3で8です。", "5から かぞえたそう。"),
          C("9は いくつと いくつ？（6と□）", "3", ["2", "4", "5"], "6と3で9です。", "6から 9まで かぞえよう。"),
          C("10は 7と いくつ？", "3", ["2", "4", "5"], "7と3で10です。", "7から 10まで かぞえよう。"),
        ],
        [
          C("10は 4と いくつ？", "6", ["5", "7", "4"], "4と6で10です。", "10の あわせを おもいだそう。"),
          C("0は どんな数？", "なにもない数", ["1より大きい数", "10と同じ", "5の半分"], "0は「なにもない」ことをあらわす数です。", ""),
          C("10は 1と いくつ？", "9", ["8", "10", "0"], "1と9で10です。", "1から 10まで かぞえよう。"),
        ]
      ),
      simpleUnit("g1-u2", "なんばんめ", 2,
        [
          C("前から3番目の人は、前から数えて何人目？", "3", ["2", "4", "1"], "「3番目」は前から3人目です。", ""),
          C("左から2番目はどれ？", "☆", ["★", "●", "◆"], "左から数えて2つ目は☆です。", "左のはしから かぞえよう。", "seq|★,☆,●,◆"),
          C("前から4番目の前には何人いる？", "3", ["4", "2", "5"], "4番目の前には3人います。", ""),
        ],
        [
          C("右から1番目はどれ？", "◆", ["●", "☆", "★"], "右のはしは◆です。", "右から かぞえよう。", "seq|★,☆,●,◆"),
          C("前から5番目は、後ろから数えると？（全部で5人）", "1番目", ["2番目", "5番目", "3番目"], "5人の一番後ろなので後ろから1番目。", ""),
          C("上から3番目の下には2つあります。全部でいくつ？", "5", ["4", "6", "3"], "3+2=5です。", ""),
        ],
        [
          C("10人ならんでいて、前から7番目の人の後ろは何人？", "3", ["4", "2", "7"], "10-7=3人です。", ""),
          C("左から4番目で右から3番目。全部で何人？", "6", ["7", "5", "8"], "4+3-1=6人です。", "じぶんを 二重に数えないよう -1。"),
          C("8人で前から5番目は、後ろから何番目？", "4", ["3", "5", "6"], "8-5+1=4番目です。", ""),
        ]
      ),
      simpleUnit("g1-u14", "あわせていくつ・ふえるといくつ", 3,
        gen(3, () => addQ(5, 4)),
        gen(3, () => addQ(9, 5, 4, 1)),
        gen(3, () => addQ(9, 9, 5, 5))
      ),
      simpleUnit("g1-u15", "のこりはいくつ・ちがいはいくつ", 4,
        gen(3, () => subQ(10, 4)),
        gen(3, () => subQ(10, 7)),
        gen(3, () => subQ(10, 9))
      ),
      simpleUnit("g1-u5", "どちらがながい", 5,
        [
          C("長さをくらべるとき、はしをどうする？", "そろえる", ["ばらばらにする", "まげる", "きにしない"], "はしをそろえてくらべます。", ""),
          C("えんぴつ3本分とつくえ。どちらが長い？〔つくえ=えんぴつ5本分〕", "つくえ", ["えんぴつ3本", "同じ", "わからない"], "5本分の方が長いです。", ""),
          C("マスいくつ分かで長さをくらべるのは？", "間接くらべ", ["色くらべ", "重さくらべ", "数えない"], "いくつ分かで数にして比べます。", ""),
        ],
        [
          C("テープ7マス分と4マス分。ちがいは何マス？", "3", ["2", "4", "11"], "7-4=3マスです。", ""),
          C("6マスと6マスのテープ。長さは？", "同じ", ["6マスが長い", "わからない", "2倍"], "同じマス数なので同じ長さ。", ""),
          C("9マスと5マス。長い方は何マス分長い？", "4", ["3", "5", "14"], "9-5=4マスです。", ""),
        ],
        [
          C("ア=8マス、イ=5マス、ウ=10マス。長い順の最初は？", "ウ", ["ア", "イ", "同じ"], "10が一番長いのでウ。", ""),
          C("12マスと7マスのちがいは？", "5", ["4", "6", "19"], "12-7=5マスです。", ""),
          C("3マスのテープ4本をつなぐと何マス？", "12", ["7", "9", "10"], "3×4=12マスです。", ""),
        ]
      ),
      simpleUnit("g1-u6", "わかりやすくせいりしよう", 6,
        [
          C("くだものを数えた絵グラフ。一番多いのは高さがどう？", "一番高い", ["一番低い", "まんなか", "関係ない"], "多いほど高くなります。", "", "bars|りんご:2,みかん:4,ぶどう:3"),
          C("りんごとみかん、多いのはどっち？", "みかん", ["りんご", "同じ", "なし"], "みかん5こ、りんご3こ。5>3でみかん。", "", "bars|りんご:3,みかん:5"),
          C("グラフでぼうが短いのは数が？", "少ない", ["多い", "同じ", "ゼロ"], "短い=少ないです。", ""),
        ],
        [
          C("一番少ないくだものはどれ？", "ばなな", ["りんご", "みかん", "同じ"], "りんご4・みかん6・ばなな2。2が一番少ない。", "", "bars|りんご:4,みかん:6,ばなな:2"),
          C("赤5・青3。ちがいは？", "2", ["1", "3", "8"], "5-3=2です。", ""),
          C("3種類で 4+2+5。全部で何こ？", "11", ["10", "12", "9"], "4+2+5=11です。", ""),
        ],
        [
          C("多い順で2番目のどうぶつはどれ？", "うさぎ", ["ねこ", "いぬ", "同じ"], "ねこ7・いぬ4・うさぎ5。7>5>4で2番目はうさぎ。", "", "bars|ねこ:7,いぬ:4,うさぎ:5"),
          C("一番多い8と一番少ない3のちがいは？", "5", ["4", "6", "11"], "8-3=5です。", ""),
          C("3+5+2+4 の合計は？", "14", ["13", "15", "12"], "合計14です。", ""),
        ]
      ),
      simpleUnit("g1-u7", "10よりおおきいかず", 7,
        [
          C("10と5で いくつ？", "15", ["14", "16", "20"], "10と5で15です。", ""),
          C("18は 10と いくつ？", "8", ["7", "9", "18"], "10と8で18。", ""),
          C("13の 十のくらいの数字は？", "1", ["3", "13", "0"], "十のくらいは1です。", ""),
        ],
        [
          C("12 + 5 = ？", "17", ["16", "18", "22"], "12に5で17。", ""),
          C("16 - 4 = ？", "12", ["11", "13", "20"], "16から4で12。", ""),
          C("20は 10が いくつ分？", "2", ["1", "3", "20"], "10が2つで20。", ""),
        ],
        [
          C("14 + 3 = ？", "17", ["16", "18", "11"], "14に3で17。", ""),
          C("19 - 6 = ？", "13", ["12", "14", "25"], "19から6で13。", ""),
          C("30 は 10が いくつ分？", "3", ["2", "4", "30"], "10が3つで30。", ""),
        ]
      ),
      simpleUnit("g1-u8", "なんじなんじはん", 8,
        [
          C("とけいは 何時かな？", "3時", ["3時半", "12時", "4時"], "長い針が12ちょうどで3時です。", "", "clock|3:00"),
          C("「○時半」のとき長いはりはどこ？", "6", ["12", "3", "9"], "半は長い針が6です。", ""),
          C("みじかいはりが指す数は何を表す？", "何時", ["何分", "何秒", "何日"], "短い針は「時」を表します。", ""),
        ],
        [
          C("とけいは 何時何分かな？", "7時半", ["8時半", "6時", "7時"], "短針が7と8の間、長針が6で7時半です。", "", "clock|7:30"),
          C("9時の1時間後は？", "10時", ["8時", "9時半", "11時"], "1時間後は10時。", ""),
          C("3時半の30分後は？", "4時", ["3時", "4時半", "5時"], "30分後で4時。", ""),
        ],
        [
          C("長いはりが1まわりすると何分たつ？", "60分", ["30分", "12分", "10分"], "1周で60分=1時間。", ""),
          C("8時から10時までは何時間？", "2時間", ["1時間", "3時間", "10時間"], "10-8=2時間。", ""),
          C("5時半の1時間半後は？", "7時", ["6時", "7時半", "6時半"], "1時間半後で7時。", ""),
        ]
      ),
      simpleUnit("g1-u9", "３つのかずのけいさん", 9,
        gen(3, () => threeNumQ()),
        gen(3, () => threeNumQ()),
        gen(3, () => threeNumQ())
      ),
      simpleUnit("g1-u10", "どちらがおおい", 10,
        [
          C("かさをくらべるとき同じ入れ物で何をくらべる？", "何ばい分", ["色", "重さ", "形"], "同じコップ何杯分かでくらべます。", ""),
          C("コップ5はい分と3ばい分。多いのは？", "5はい分", ["3はい分", "同じ", "なし"], "5>3で多い。", ""),
          C("大きい入れ物ほど かさは？", "多い", ["少ない", "同じ", "ゼロ"], "ふつう大きいほど多く入ります。", ""),
        ],
        [
          C("7はい分と4はい分のちがいは？", "3", ["2", "4", "11"], "7-4=3はい分。", ""),
          C("コップ3ばいと2はいで 合わせて何ばい？", "5", ["4", "6", "1"], "3+2=5はい。", ""),
          C("6はい分の半分は？", "3", ["2", "4", "12"], "6÷2=3はい。", ""),
        ],
        [
          C("ア8・イ5・ウ6。多い順の最初は？", "ア", ["イ", "ウ", "同じ"], "8が一番多い。", ""),
          C("10ぱいと6ぱいのちがいは？", "4", ["3", "5", "16"], "10-6=4。", ""),
          C("2はいずつ4回入れると何ばい？", "8", ["6", "7", "10"], "2×4=8はい。", ""),
        ]
      ),
      simpleUnit("g1-u3", "たしざん", 11,
        gen(3, () => addQ(5, 4)),
        gen(3, () => addQ(9, 5, 6, 4)),
        gen(3, () => addQ(9, 9, 8, 6))
      ),
      simpleUnit("g1-u11", "かたちあそび", 12,
        [
          C("つつのような形でよく転がるのは？", "ボールの形", ["はこの形", "さいころの形", "三角"], "球はよく転がります。", ""),
          C("さいころのような形の面はいくつ？", "6", ["4", "8", "2"], "立方体の面は6つ。", ""),
          C("つみ木をつむのに向くのは？", "はこの形", ["ボールの形", "とがった形", "まるい形"], "平らな面のある箱は積めます。", ""),
        ],
        [
          C("丸い面と平らな面があるのは？", "つつの形", ["ボールの形", "さいころ", "三角の形"], "円柱は丸い面と平らな面。", ""),
          C("はこの形の角（ちょう点）はいくつ？", "8", ["6", "4", "12"], "直方体の頂点は8つ。", ""),
          C("ぜんぶ平らな面でできているのは？", "はこの形", ["ボールの形", "つつの形", "たまご形"], "箱は平らな面だけ。", ""),
        ],
        [
          C("はこの形の辺（へん）はいくつ？", "12", ["8", "6", "4"], "直方体の辺は12本。", ""),
          C("転がるけれど積めない形は？", "ボールの形", ["はこの形", "さいころ", "つみ木"], "球は積めません。", ""),
          C("三角の面が2つ、四角の面が3つの形は？", "三角柱", ["四角柱", "球", "円柱"], "三角柱の特徴です。", ""),
        ]
      ),
      simpleUnit("g1-u4", "ひきざん", 13,
        gen(3, () => subQ(10, 4)),
        gen(3, () => subQ(14, 9)),
        gen(3, () => subQ(18, 9))
      ),
      simpleUnit("g1-u12", "おおきいかず", 14,
        gen(3, () => addQ(60, 30, 20, 10)),
        gen(3, () => biggestQ(2)),
        gen(3, () => subQ(90, 40))
      ),
      simpleUnit("g1-u16", "どちらがひろい", 15,
        [
          C("2枚をかさねず、ますいくつ分かを数えて広さをくらべる方法は？", "任意単位による測定", ["直接くらべ", "重さくらべ", "長さくらべ"], "マス何個分かを数にして比べます（任意単位）。", ""),
          C("8マス分と5マス分の広さ。広いのはどちら？", "8マス分", ["5マス分", "同じ", "わからない"], "8>5なので8マス分が広い。", ""),
          C("直接くらべで広さをくらべるとき、どうする？", "重ねる", ["ならべる", "おる", "計算する"], "2枚を重ねてはみ出た方が広い。", ""),
        ],
        [
          C("Aは12マス分、Bは9マス分。ちがいは何マス分？", "3", ["2", "4", "21"], "12-9=3マス分です。", ""),
          C("Cは6マス分、Dは6マス分。広さは？", "同じ", ["Cが広い", "Dが広い", "わからない"], "同じマス数なので同じ広さ。", ""),
          C("4マス分のタイルを3まい並べると何マス分？", "12", ["7", "9", "10"], "4×3=12マス分です。", ""),
        ],
        [
          C("ア=15マス分、イ=10マス分、ウ=12マス分。広い順の2番目は？", "ウ", ["ア", "イ", "同じ"], "15>12>10でウが2番目。", ""),
          C("20マス分の半分は何マス分？", "10", ["5", "40", "15"], "20÷2=10マス分。", ""),
          C("1マス分の正方形タイルが16まい。全体の広さは？", "16マス分", ["8マス分", "32マス分", "4マス分"], "16まいで16マス分。", ""),
        ]
      ),
      simpleUnit("g1-u17", "なんじなんぷん", 16,
        [
          C("長いはりが1をさしているとき何分？", "5分", ["1分", "10分", "15分"], "長い針の1は5分です。", ""),
          C("長いはりが6をさしているとき何分？", "30分", ["6分", "60分", "36分"], "長い針の6は30分です。", ""),
          C("短いはりが2と3の間、長いはりが12のとき？", "2時ちょうど", ["3時ちょうど", "2時半", "12時"], "長い針が12ちょうどで「何時ちょうど」。", ""),
        ],
        [
          C("長いはりが3をさしているとき何分？", "15分", ["3分", "30分", "45分"], "長い針の3は15分です。", ""),
          C("短いはりが5と6の間、長いはりが6のとき？", "5時30分", ["6時30分", "5時15分", "5時45分"], "5時を過ぎて長針6なので5時30分。", ""),
          C("3時15分のとき長いはりはどこ？", "3", ["12", "9", "6"], "15分は長い針の3。", ""),
        ],
        [
          C("長いはりが9をさしているとき何分？", "45分", ["9分", "90分", "40分"], "長い針の9は45分です。", ""),
          C("4時45分の15分後は？", "5時", ["4時60分", "5時15分", "4時30分"], "45+15=60分で5時。", ""),
          C("2時20分の40分後は？", "3時", ["2時60分", "3時20分", "2時40分"], "20+40=60分で3時。", ""),
        ]
      ),
      simpleUnit("g1-u18", "たしざんとひきざん", 17,
        [
          C("えんぴつが7本、2本もらうと何本？", "9本", ["8本", "10本", "5本"], "7+2=9本です。", ""),
          C("みかんが5こ、3こたべると何このこる？", "2こ", ["1こ", "3こ", "8こ"], "5-3=2こです。", ""),
          C("子どもが10人いて4人かえりました。のこりは？", "6人", ["5人", "7人", "14人"], "10-4=6人です。", ""),
        ],
        [
          C("8こいちごがあります。5こたべると、のこりはいくつ？", "3こ", ["2こ", "4こ", "13こ"], "8-5=3こです。", ""),
          C("前に6人、後ろに4人。合わせて何人？", "10人", ["9人", "11人", "2人"], "6+4=10人です。", ""),
          C("9まいの色紙のうち3まいつかいました。のこりは？", "6まい", ["5まい", "7まい", "12まい"], "9-3=6まい。", ""),
        ],
        [
          C("7人のグループに3人加わりました。全員何人？", "10人", ["9人", "11人", "4人"], "7+3=10人です。", ""),
          C("12このりんごを5こくばりました。のこりは？", "7こ", ["6こ", "8こ", "17こ"], "12-5=7こです。", ""),
          C("本を6冊持っていて、また4冊借りた。全部で何冊？", "10冊", ["9冊", "11冊", "2冊"], "6+4=10冊です。", ""),
        ]
      ),
      simpleUnit("g1-u13", "かたちづくり", 18,
        [
          C("三角の色いた2まいで作れるのは？", "四角", ["丸", "星", "立体"], "三角2枚で四角ができます。", ""),
          C("色いた4まいで大きな三角を作れる？", "作れる", ["作れない", "丸になる", "立体になる"], "並べ方で大きな三角に。", ""),
          C("数えぼうで三角を1つ作るには何本？", "3", ["2", "4", "1"], "三角は3本。", ""),
        ],
        [
          C("四角を1つ作るには数えぼう何本？", "4", ["3", "5", "2"], "四角は4本。", ""),
          C("三角2つを横に並べると辺は何本見える？（共有1）", "5", ["6", "4", "3"], "3+3-1=5本。", ""),
          C("色いた6まいで作る形の三角は何まい分？", "6", ["3", "4", "5"], "6枚なので6まい分。", ""),
        ],
        [
          C("正方形を対角線で切ると何ができる？", "三角形2つ", ["四角2つ", "丸", "三角3つ"], "対角線で直角三角形2つ。", ""),
          C("数えぼうで三角を2つ（1辺共有）作るには？", "5本", ["6本", "4本", "3本"], "3+3-1=5本。", ""),
          C("色いた8まいの大きな四角は、半分にすると何まい？", "4", ["3", "5", "8"], "8÷2=4まい。", ""),
        ]
      ),
    ],
  },

  // ════ 2年生 ════
  {
    id: "math-g2",
    name: "算数",
    grade: 2,
    units: [
      simpleUnit("g2-u1", "ひょうとグラフ", 1,
        [
          C("○を積み上げたグラフで多いものは？", "高い", ["低い", "まんなか", "関係ない"], "多いほど高くなります。", ""),
          C("赤と青、多いのはどっち？", "赤", ["青", "同じ", "なし"], "赤6・青4。6>4で赤。", "", "bars|赤:6,青:4"),
          C("表で数を表すとき書くのは？", "数字", ["絵だけ", "色だけ", "なにも"], "表には数字を書きます。", ""),
        ],
        [
          C("一番多いどうぶつはどれ？", "猫", ["犬", "鳥", "同じ"], "犬5・猫8・鳥3。8が最大。", "", "bars|犬:5,猫:8,鳥:3"),
          C("一番多い8と少ない3のちがいは？", "5", ["4", "6", "11"], "8-3=5。", ""),
          C("5+8+3 の合計は？", "16", ["15", "17", "14"], "合計16。", ""),
        ],
        [
          C("4種類 6+3+5+2 の合計は？", "16", ["15", "17", "14"], "合計16。", ""),
          C("多い順 7,5,3,1。3番目は？", "3", ["5", "7", "1"], "3番目は3。", ""),
          C("グラフで前回より2増えて今8。前回は？", "6", ["10", "7", "5"], "8-2=6。", ""),
        ]
      ),
      simpleUnit("g2-u2", "たし算のひっ算", 2,
        gen(3, () => addQ(40, 30, 11, 11)),
        gen(3, () => addQ(60, 50, 25, 25)),
        gen(3, () => addQ(89, 89, 45, 45))
      ),
      simpleUnit("g2-u3", "ひき算のひっ算", 3,
        gen(3, () => subQ(50, 20)),
        gen(3, () => subQ(80, 40)),
        gen(3, () => subQ(99, 60))
      ),
      simpleUnit("g2-u18", "どんな計算になるのかな", 4,
        [
          C("りんごが8こあります。5こたべました。のこりはいくつ？（何算？）", "ひき算", ["たし算", "かけ算", "わり算"], "のこりを求めるときはひき算です。", "「のこりは」や「ちがいは」はひき算のサイン。"),
          C("3こいちごがあって、4こもらいました。全部でいくつ？（何算？）", "たし算", ["ひき算", "かけ算", "わり算"], "あわせていくつかはたし算です。", "「あわせて」や「全部で」はたし算のサイン。"),
          C("赤いテープ6cm、青いテープ9cm。青は赤より何cm長い？（何算？）", "ひき算", ["たし算", "かけ算", "わり算"], "ちがいを求めるときはひき算です。", "「どちらが何cm長い/多い」はひき算。"),
        ],
        [
          C("子ども7人に鉛筆2本ずつ配ります。鉛筆は全部で何本？（何算？）", "かけ算", ["たし算", "ひき算", "わり算"], "同じ数ずつのまとまりはかけ算です。", "「1つ分の数×いくつ分」はかけ算。"),
          C("12このお菓子を4人で同じ数ずつ分けます。1人何こ？（何算？）", "わり算", ["たし算", "ひき算", "かけ算"], "同じ数ずつ分けるときはわり算です。", "「同じ数ずつ分ける」はわり算のサイン。"),
          C("花が5本さいていて、3本増えました。全部で何本？（式は？）", "5+3", ["5-3", "5×3", "5÷3"], "増えた(ふえた)はたし算です。", "「ふえた」「もらった」はたし算のサイン。"),
        ],
        [
          C("10このあめのうち何こかたべたら3このこりました。たべた数は？（式は？）", "10-□=3", ["10+□=3", "□×10=3", "□÷10=3"], "のこりが分かっているのでひき算の式です。", "「□こたべた」をもとめるひき算。"),
          C("1本50円のジュースを3本買います。代金は？（何算？）", "かけ算", ["たし算", "ひき算", "わり算"], "同じ値段×本数はかけ算です。", "1つ分の値段×個数=代金。"),
          C("みかん13こを同じ数ずつ袋に入れたら4ふくろできて1こあまりました。1ふくろに何こ？（式は？）", "13÷4", ["4×13", "13-4", "13+4"], "等分するときはわり算です。", "「同じ数ずつ分ける」→わり算。"),
        ]
      ),
      simpleUnit("g2-u4", "長さのたんい", 5,
        [
          C("1cm は 何mm？", "10mm", ["1mm", "100mm", "5mm"], "1cm=10mmです。", ""),
          C("ものさしでまっすぐな線を何という？", "直線", ["曲線", "点", "面"], "まっすぐな線は直線。", ""),
          C("3cm は 何mm？", "30mm", ["3mm", "300mm", "13mm"], "3×10=30mm。", ""),
        ],
        [
          C("5cm + 3cm = ？", "8cm", ["8mm", "2cm", "53cm"], "5+3=8cm。", ""),
          C("10cm - 4cm = ？", "6cm", ["6mm", "14cm", "60cm"], "10-4=6cm。", ""),
          C("2cm5mm は 何mm？", "25mm", ["205mm", "7mm", "250mm"], "2cm=20mm +5mm=25mm。", ""),
        ],
        [
          C("8cm3mm + 1cm4mm = ？", "9cm7mm", ["9cm1mm", "7cm7mm", "10cm"], "cm同士・mm同士をたす。", ""),
          C("1m は 何cm？", "100cm", ["10cm", "1000cm", "50cm"], "1m=100cm。", ""),
          C("12cm - 7cm5mm = ？", "4cm5mm", ["5cm5mm", "4cm", "19cm5mm"], "12cm-7cm5mm=4cm5mm。", ""),
        ]
      ),
      simpleUnit("g2-u5", "３けたの数", 6,
        gen(3, () => scaleNumQ()),
        gen(3, () => biggestQ(3)),
        gen(3, () => addQ(500, 400, 100, 100))
      ),
      simpleUnit("g2-u6", "水のかさのはかり方とあらわし方", 7,
        [
          C("1L は 何dL？", "10dL", ["1dL", "100dL", "1000dL"], "1L=10dLです。", ""),
          C("1L は 何mL？", "1000mL", ["100mL", "10mL", "1mL"], "1L=1000mL。", ""),
          C("水の量をはかる単位はどれ？", "L", ["cm", "g", "度"], "かさはL,dL,mL。", ""),
        ],
        [
          C("3L + 2L = ？", "5L", ["6L", "1L", "32L"], "3+2=5L。", ""),
          C("2L5dL は 何dL？", "25dL", ["7dL", "205dL", "250dL"], "2L=20dL+5=25dL。", ""),
          C("8dL - 3dL = ？", "5dL", ["11dL", "5L", "4dL"], "8-3=5dL。", ""),
        ],
        [
          C("1L5dL + 2L8dL = ？", "4L3dL", ["3L3dL", "4L", "3L13dL"], "dLの繰り上がりに注意し4L3dL。", ""),
          C("1Lは何dLで2Lより何dL少ない？", "10dL", ["20dL", "5dL", "1dL"], "1L=10dL。", ""),
          C("10dL - 4dL は 何L何dL？", "6dL", ["1L", "0L6dL相当", "14dL"], "10-4=6dL。", ""),
        ]
      ),
      simpleUnit("g2-u7", "時こくと時間", 8,
        [
          C("1時間は何分？", "60分", ["100分", "30分", "10分"], "1時間=60分。", ""),
          C("午前と午後の境目は？", "正午", ["朝", "夕方", "夜中"], "昼の12時が正午。", ""),
          C("1日は何時間？", "24時間", ["12時間", "60時間", "10時間"], "1日=24時間。", ""),
        ],
        [
          C("9時から11時までは何時間？", "2時間", ["1時間", "3時間", "20時間"], "11-9=2時間。", ""),
          C("3時20分の40分後は？", "4時", ["3時40分", "4時20分", "3時"], "20+40=60分で4時。", ""),
          C("半日は何時間？", "12時間", ["24時間", "6時間", "30時間"], "24÷2=12時間。", ""),
        ],
        [
          C("午前10時から午後1時までは何時間？", "3時間", ["2時間", "4時間", "11時間"], "正午まで2時間+1時間=3時間。", ""),
          C("100分は何時間何分？", "1時間40分", ["1時間20分", "2時間", "1時間"], "100=60+40。", ""),
          C("8時45分の30分後は？", "9時15分", ["9時", "8時75分", "9時30分"], "45+30=75=1時間15分。", ""),
        ]
      ),
      simpleUnit("g2-u8", "計算のくふう", 9,
        gen(3, () => threeNumQ()),
        gen(3, () => calcRuleQ()),
        gen(3, () => calcRuleQ())
      ),
      simpleUnit("g2-u9", "たし算とひき算のひっ算", 10,
        gen(3, () => addQ(80, 70, 30, 30)),
        gen(3, () => subQ(150, 70)),
        gen(3, () => subQ(300, 120))
      ),
      simpleUnit("g2-u10", "三角形と四角形", 11,
        [
          C("3本の直線でかこまれた形は？", "三角形", ["四角形", "円", "五角形"], "3辺で三角形。", ""),
          C("4本の直線でかこまれた形は？", "四角形", ["三角形", "円", "三角"], "4辺で四角形。", ""),
          C("かどがみんな直角の四角形は？", "長方形", ["三角形", "円", "ひし形"], "長方形は4つの角が直角。", ""),
        ],
        [
          C("4つの辺が全部同じで角が直角なのは？", "正方形", ["長方形", "三角形", "台形"], "正方形の特徴。", ""),
          C("三角形の角はいくつ？", "3", ["4", "2", "5"], "三角形の角は3つ。", ""),
          C("直角を作る2本の直線の関係は？", "直角に交わる", ["平行", "ねじれ", "重なる"], "直角に交わります。", ""),
        ],
        [
          C("直角の角を1つもつ三角形は？", "直角三角形", ["正三角形", "二等辺三角形", "鋭角三角形"], "直角三角形。", ""),
          C("長方形の向かい合う辺の長さは？", "等しい", ["ちがう", "直角", "ゼロ"], "向かい合う辺は等しい。", ""),
          C("正方形は長方形といえる？", "いえる", ["いえない", "三角形", "円"], "角が直角なので長方形の仲間。", ""),
        ]
      ),
      simpleUnit("g2-u11", "かけ算（九九）", 12,
        gen(3, () => multTableQ(2, 5)),
        gen(3, () => multTableQ(6, 8)),
        gen(3, () => multTableQ(7, 9))
      ),
      simpleUnit("g2-u12", "４けたの数", 13,
        gen(3, () => scaleNumQ()),
        gen(3, () => biggestQ(4)),
        gen(3, () => addQ(5000, 4000, 1000, 1000))
      ),
      simpleUnit("g2-u13", "長いものの長さのたんい", 14,
        [
          C("1m は 何cm？", "100cm", ["10cm", "1000cm", "50cm"], "1m=100cm。", ""),
          C("つくえの長さをはかるのに合う単位は？", "m", ["mm", "L", "g"], "長いものはmが便利。", ""),
          C("2m は 何cm？", "200cm", ["20cm", "2000cm", "120cm"], "2×100=200cm。", ""),
        ],
        [
          C("1m50cm は 何cm？", "150cm", ["1050cm", "60cm", "15cm"], "100+50=150cm。", ""),
          C("3m - 1m = ？", "2m", ["4m", "2cm", "200m"], "3-1=2m。", ""),
          C("120cm は 何m何cm？", "1m20cm", ["12m", "1m2cm", "2m20cm"], "100cm=1m+20cm。", ""),
        ],
        [
          C("1m20cm + 80cm = ？", "2m", ["1m100cm表記不可", "2m20cm", "1m28cm"], "120+80=200cm=2m。", ""),
          C("2m5cm は 何cm？", "205cm", ["250cm", "25cm", "2005cm"], "200+5=205cm。", ""),
          C("3m - 40cm = ？", "2m60cm", ["2m40cm", "3m40cm", "260m"], "300-40=260cm。", ""),
        ]
      ),
      simpleUnit("g2-u14", "たし算とひき算（テープ図）", 15,
        gen(3, () => addQ(50, 40, 10, 10)),
        gen(3, () => subQ(80, 30)),
        gen(3, () => threeNumQ())
      ),
      simpleUnit("g2-u15", "分数", 16,
        [
          C("半分にした1つ分を分数で書くと？", "1/2", ["2/1", "1/4", "2/2"], "半分は1/2。", ""),
          C("4等分した1つ分は？", "1/4", ["1/2", "4/1", "1/3"], "4等分の1つは1/4。", ""),
          C("1/2 が2つで いくつ？", "1", ["1/2", "2/2でない", "1/4"], "1/2+1/2=1。", ""),
        ],
        [
          C("3等分した1つ分は？", "1/3", ["1/2", "3/1", "1/4"], "1/3です。", ""),
          C("1を4等分したうち3つ分は？", "3/4", ["1/4", "4/3", "1/3"], "3/4です。", ""),
          C("1/4 が4つで いくつ？", "1", ["1/4", "4/4でない表記", "1/2"], "1/4×4=1。", ""),
        ],
        [
          C("大きいのはどっち？ 1/2 と 1/4", "1/2", ["1/4", "同じ", "くらべられない"], "分母が小さい1/2が大きい。", ""),
          C("1/3 と 1/2 大きいのは？", "1/2", ["1/3", "同じ", "0"], "1/2が大きい。", ""),
          C("1を2等分し、さらに半分。元の何分の一？", "1/4", ["1/2", "1/3", "1/8"], "半分の半分は1/4。", ""),
        ]
      ),
      simpleUnit("g2-u16", "はこの形", 17,
        [
          C("はこの形の面はいくつ？", "6", ["4", "8", "12"], "直方体の面は6つ。", ""),
          C("さいころの面の形は？", "正方形", ["三角形", "円", "長方形だけ"], "立方体の面は正方形。", ""),
          C("はこの形のちょう点はいくつ？", "8", ["6", "4", "12"], "頂点は8つ。", ""),
        ],
        [
          C("はこの形の辺は何本？", "12", ["8", "6", "4"], "辺は12本。", ""),
          C("向かい合う面の数は何組？", "3", ["2", "6", "4"], "3組あります。", ""),
          C("ひごとねん土玉で作るとき玉は何こ？", "8", ["12", "6", "4"], "頂点の数=8こ。", ""),
        ],
        [
          C("はこを作るのに必要なひご(辺)は何本？", "12", ["8", "6", "10"], "辺=12本。", ""),
          C("同じ長さの辺は何本ずつ何組？", "4本ずつ3組", ["2本ずつ", "6本ずつ", "全部同じ"], "直方体は4本ずつ3組。", ""),
          C("さいころの向かい合う目の和が7。1の向かいは？", "6", ["2", "5", "7"], "1+6=7。", ""),
        ]
      ),
    ],
  },

  // ════ 3年生 ════
  {
    id: "math-g3",
    name: "算数",
    grade: 3,
    units: [
      simpleUnit("g3-u1", "かけ算", 1,
        gen(3, () => multTableQ(2, 5)),
        gen(3, () => multTableQ(6, 9)),
        gen(3, () => multQ(10, 12, 2, 9))
      ),
      simpleUnit("g3-u2", "時こくと時間のもとめ方", 2,
        [
          C("1分は何秒？", "60秒", ["100秒", "30秒", "10秒"], "1分=60秒。", ""),
          C("9時から9時40分までは何分？", "40分", ["60分", "30分", "9分"], "差は40分。", ""),
          C("1時間=何分？", "60分", ["100分", "30分", "24分"], "1時間=60分。", ""),
        ],
        [
          C("10時20分の50分後は？", "11時10分", ["10時70分", "11時", "10時50分"], "20+50=70=1時間10分。", ""),
          C("80秒は何分何秒？", "1分20秒", ["8分", "1分8秒", "80分"], "80=60+20。", ""),
          C("午前11時40分の30分後は？", "午後0時10分", ["11時70分", "12時40分", "11時10分"], "正午をまたいで0時10分。", ""),
        ],
        [
          C("2時間=何分？", "120分", ["100分", "60分", "200分"], "60×2=120分。", ""),
          C("150秒は何分何秒？", "2分30秒", ["1分50秒", "15分", "2分"], "150=120+30。", ""),
          C("8時50分の1時間30分後は？", "10時20分", ["9時20分", "10時", "10時80分"], "+1時間=9時50分、+30分=10時20分。", ""),
        ]
      ),
      simpleUnit("g3-u3", "わり算", 3,
        gen(3, () => divQ(2, 3, 2, 5)),
        gen(3, () => divQ(3, 6, 3, 7)),
        gen(3, () => divQ(6, 9, 4, 9))
      ),
      simpleUnit("g3-u4", "たし算とひき算の筆算", 4,
        gen(3, () => addQ(500, 400, 100, 100)),
        gen(3, () => subQ(800, 300)),
        gen(3, () => subQ(1000, 400))
      ),
      simpleUnit("g3-u5", "長いものの長さのはかり方", 5,
        [
          C("1km は 何m？", "1000m", ["100m", "10m", "10000m"], "1km=1000m。", ""),
          C("長いきょりに合う単位は？", "km", ["mm", "cm", "g"], "道のりはkm。", ""),
          C("2km は 何m？", "2000m", ["200m", "20m", "2m"], "2×1000=2000m。", ""),
        ],
        [
          C("1km500m は 何m？", "1500m", ["1050m", "150m", "15000m"], "1000+500=1500m。", ""),
          C("3km - 1km = ？", "2km", ["4km", "2m", "2000km"], "3-1=2km。", ""),
          C("2km800m + 300m = ？", "3km100m", ["3km", "2km500m", "2km1100m"], "800+300=1100=1km100m。", ""),
        ],
        [
          C("1700m は 何km何m？", "1km700m", ["17km", "1km7m", "170km"], "1000m=1km+700m。", ""),
          C("5km - 1km200m = ？", "3km800m", ["4km800m", "3km200m", "4km200m"], "5000-1200=3800m。", ""),
          C("道のり2km道路の半分は？", "1km", ["500m", "4km", "1000km"], "2÷2=1km。", ""),
        ]
      ),
      simpleUnit("g3-u18", "暗算", 6,
        [
          C("37 + 25 を暗算すると？", "62", ["61", "63", "52"], "30+20=50、7+5=12、50+12=62です。", "十の位と一の位に分けて計算しよう。"),
          C("54 - 28 を暗算すると？", "26", ["25", "27", "36"], "54-20=34、34-8=26です。", "まず十の位をひいてから一の位をひこう。"),
          C("46 + 37 を暗算すると？", "83", ["82", "84", "73"], "40+30=70、6+7=13、70+13=83です。", ""),
        ],
        [
          C("72 - 35 を暗算すると？", "37", ["36", "38", "47"], "72-30=42、42-5=37です。", ""),
          C("63 + 28 を暗算すると？", "91", ["90", "92", "81"], "60+20=80、3+8=11、80+11=91です。", ""),
          C("85 - 47 を暗算すると？", "38", ["37", "39", "48"], "85-40=45、45-7=38です。", ""),
        ],
        [
          C("56 + 68 を暗算すると？", "124", ["123", "125", "114"], "50+60=110、6+8=14、110+14=124です。", ""),
          C("134 - 56 を暗算すると？", "78", ["77", "79", "88"], "134-50=84、84-6=78です。", ""),
          C("75 + 49 を暗算すると？", "124", ["123", "125", "115"], "75+50=125、125-1=124です。", "49は50-1として計算するのが便利。"),
        ]
      ),
      simpleUnit("g3-u6", "あまりのあるわり算", 7,
        gen(3, () => divRemQ(2, 4)),
        gen(3, () => divRemQ(4, 6)),
        gen(3, () => divRemQ(6, 9))
      ),
      simpleUnit("g3-u7", "大きい数のしくみ", 8,
        gen(3, () => scaleNumQ()),
        gen(3, () => biggestQ(5)),
        [
          C("一万を10こ集めるといくつ？", "十万", ["百万", "千", "一億"], "一万×10=十万。", ""),
          C("100万を10倍すると？", "1000万", ["10万", "1億", "100億"], "10倍で1000万。", ""),
          C("1億は1000万の何倍？", "10倍", ["100倍", "2倍", "1000倍"], "1000万×10=1億。", ""),
        ]
      ),
      simpleUnit("g3-u8", "かけ算の筆算", 9,
        gen(3, () => multQ(11, 30, 2, 4)),
        gen(3, () => multQ(20, 60, 3, 6)),
        gen(3, () => multQ(101, 400, 3, 9))
      ),
      simpleUnit("g3-u19", "大きい数の割り算", 10,
        [
          C("60 ÷ 3 = ？", "20", ["18", "22", "30"], "6÷3=2なので60÷3=20です。", "10のまとまりで考えよう。"),
          C("80 ÷ 4 = ？", "20", ["16", "24", "40"], "8÷4=2なので80÷4=20です。", ""),
          C("90 ÷ 3 = ？", "30", ["27", "33", "18"], "9÷3=3なので90÷3=30です。", ""),
        ],
        [
          C("120 ÷ 4 = ？", "30", ["28", "32", "40"], "12÷4=3なので120÷4=30です。", ""),
          C("150 ÷ 5 = ？", "30", ["25", "35", "20"], "15÷5=3なので150÷5=30です。", ""),
          C("240 ÷ 6 = ？", "40", ["36", "44", "50"], "24÷6=4なので240÷6=40です。", ""),
        ],
        [
          C("280 ÷ 7 = ？", "40", ["38", "42", "56"], "28÷7=4なので280÷7=40です。", ""),
          C("360 ÷ 9 = ？", "40", ["36", "44", "45"], "36÷9=4なので360÷9=40です。", ""),
          C("420 ÷ 6 = ？", "70", ["60", "80", "42"], "42÷6=7なので420÷6=70です。", ""),
        ]
      ),
      simpleUnit("g3-u9", "円と球", 11,
        [
          C("円の中心から円のまわりまでの長さは？", "半径", ["直径", "円周", "面積"], "中心からふちまでが半径。", ""),
          C("円を横切る中心を通る直線は？", "直径", ["半径", "弦", "接線"], "中心を通る直線は直径。", ""),
          C("直径は半径の何倍？", "2倍", ["半分", "3倍", "同じ"], "直径=半径×2。", ""),
        ],
        [
          C("半径4cmの円の直径は？", "8cm", ["4cm", "2cm", "16cm"], "4×2=8cm。", ""),
          C("直径10cmの円の半径は？", "5cm", ["10cm", "20cm", "2cm"], "10÷2=5cm。", ""),
          C("コンパスで円をかくとき固定するのは？", "中心", ["半径の先", "円周", "直径"], "中心を固定します。", ""),
        ],
        [
          C("半径6cmの円の直径は？", "12cm", ["6cm", "3cm", "18cm"], "6×2=12cm。", ""),
          C("ボールを真ん中で切った切り口の形は？", "円", ["三角", "四角", "だ円"], "球の切り口は円。", ""),
          C("直径14cmの球の半径は？", "7cm", ["14cm", "28cm", "3cm"], "14÷2=7cm。", ""),
        ]
      ),
      simpleUnit("g3-u10", "小数", 12,
        gen(3, () => decimalAddQ()),
        gen(3, () => decimalSubQ()),
        [
          C("0.1が10こで いくつ？", "1", ["0.1", "10", "0.01"], "0.1×10=1。", ""),
          C("0.7 + 0.5 = ？", "1.2", ["0.12", "1.1", "0.2"], "0.7+0.5=1.2。", ""),
          C("1.5 - 0.8 = ？", "0.7", ["0.8", "1.3", "0.3"], "1.5-0.8=0.7。", ""),
        ]
      ),
      simpleUnit("g3-u11", "重さのたんいとはかり方", 13,
        [
          C("1kg は 何g？", "1000g", ["100g", "10g", "10000g"], "1kg=1000g。", ""),
          C("重さの単位はどれ？", "g", ["cm", "L", "度"], "重さはg,kg。", ""),
          C("2kg は 何g？", "2000g", ["200g", "20g", "2g"], "2×1000=2000g。", ""),
        ],
        [
          C("1kg500g は 何g？", "1500g", ["1050g", "150g", "15000g"], "1000+500=1500g。", ""),
          C("800g + 400g = ？", "1kg200g", ["1200kg", "12kg", "1kg2g"], "800+400=1200g=1kg200g。", ""),
          C("3kg - 1kg = ？", "2kg", ["4kg", "2g", "2000kg"], "3-1=2kg。", ""),
        ],
        [
          C("1t は 何kg？", "1000kg", ["100kg", "10kg", "10000kg"], "1t=1000kg。", ""),
          C("2kg300g - 800g = ？", "1kg500g", ["1kg100g", "2kg500g", "1500kg"], "2300-800=1500g。", ""),
          C("500gの品物4つの重さは？", "2kg", ["1kg", "4kg", "500g"], "500×4=2000g=2kg。", ""),
        ]
      ),
      simpleUnit("g3-u12", "分数", 14,
        gen(3, () => fracAddSameQ()),
        gen(3, () => fracSubSameQ()),
        [
          C("3/5 + 1/5 = ？", "4/5", ["4/10", "2/5", "4/25"], "分子をたして4/5。", ""),
          C("1 - 2/5 = ？", "3/5", ["2/5", "3/10", "1/5"], "5/5-2/5=3/5。", ""),
          C("分母が10の0.3は分数で？", "3/10", ["1/3", "3/100", "10/3"], "0.3=3/10。", ""),
        ]
      ),
      simpleUnit("g3-u13", "□の式", 15,
        [
          C("□ + 3 = 8 のとき □は？", "5", ["11", "4", "6"], "8-3=5。", ""),
          C("□ - 2 = 5 のとき □は？", "7", ["3", "10", "6"], "5+2=7。", ""),
          C("4 + □ = 9 のとき □は？", "5", ["13", "4", "6"], "9-4=5。", ""),
        ],
        [
          C("□ × 3 = 12 のとき □は？", "4", ["36", "9", "15"], "12÷3=4。", ""),
          C("□ ÷ 2 = 6 のとき □は？", "12", ["3", "8", "4"], "6×2=12。", ""),
          C("15 - □ = 7 のとき □は？", "8", ["22", "9", "7"], "15-7=8。", ""),
        ],
        [
          C("□ × 4 = 28 のとき □は？", "7", ["32", "24", "112"], "28÷4=7。", ""),
          C("48 ÷ □ = 6 のとき □は？", "8", ["7", "42", "288"], "48÷6=8。", ""),
          C("□ + 25 = 60 のとき □は？", "35", ["85", "45", "25"], "60-25=35。", ""),
        ]
      ),
      simpleUnit("g3-u14", "かけ算の筆算（２）", 16,
        gen(3, () => multQ(11, 30, 11, 30)),
        gen(3, () => multQ(20, 60, 12, 40)),
        gen(3, () => multQ(100, 400, 11, 30))
      ),
      simpleUnit("g3-u15", "倍の計算", 17,
        gen(3, () => timesQ()),
        gen(3, () => timesQ()),
        [
          C("12cmは3cmの何倍？", "4倍", ["3倍", "9倍", "36倍"], "12÷3=4倍。", ""),
          C("ある数の5倍が40。ある数は？", "8", ["45", "200", "35"], "40÷5=8。", ""),
          C("6mの4倍は？", "24m", ["10m", "2m", "64m"], "6×4=24m。", ""),
        ]
      ),
      simpleUnit("g3-u16", "三角形", 18,
        [
          C("3つの辺が全部同じ三角形は？", "正三角形", ["直角三角形", "二等辺三角形", "台形"], "正三角形。", ""),
          C("2つの辺が同じ三角形は？", "二等辺三角形", ["正三角形", "直角三角形", "ふつうの三角形"], "二等辺三角形。", ""),
          C("三角形の角はいくつ？", "3", ["4", "2", "6"], "角は3つ。", ""),
        ],
        [
          C("正三角形の1つの角は？", "60度", ["90度", "45度", "30度"], "180÷3=60度。", ""),
          C("二等辺三角形で等しいのは？", "2つの角", ["全部の辺", "1つの角", "なし"], "底角が等しい。", ""),
          C("三角形の3つの角の和は？", "180度", ["360度", "90度", "270度"], "内角の和180度。", ""),
        ],
        [
          C("正三角形の3つの角の和は？", "180度", ["240度", "360度", "60度"], "60×3=180度。", ""),
          C("二等辺三角形で頂角40度。底角1つは？", "70度", ["40度", "100度", "140度"], "(180-40)÷2=70度。", ""),
          C("辺の長さ3,3,3cmの三角形の名前は？", "正三角形", ["二等辺", "直角", "台形"], "全部同じで正三角形。", ""),
        ]
      ),
      simpleUnit("g3-u17", "ぼうグラフと表", 19,
        [
          C("ぼうグラフでぼうが長いほど数は？", "多い", ["少ない", "同じ", "ゼロ"], "長い=多い。", ""),
          C("グラフのたてじくが表すのは？", "数や量", ["名前だけ", "色", "日付だけ"], "数量を表します。", ""),
          C("1めもりが2のグラフ。ぼう3めもりは？", "6", ["3", "5", "9"], "2×3=6。", ""),
        ],
        [
          C("1めもり5でぼうが4めもり。数は？", "20", ["9", "15", "45"], "5×4=20。", ""),
          C("赤8青5。差を読み取ると？", "3", ["2", "4", "13"], "8-5=3。", ""),
          C("3つの合計 6+4+8 は？", "18", ["17", "19", "16"], "合計18。", ""),
        ],
        [
          C("1めもり10でぼうが7めもり半。数は？", "75", ["70", "80", "17"], "10×7.5=75。", ""),
          C("二次元表で行と列が交わるますは何を表す？", "両方に合う数", ["合計だけ", "名前", "色"], "両条件に合う数。", ""),
          C("合計32で3つが10,12なら残りは？", "10", ["8", "12", "22"], "32-22=10。", ""),
        ]
      ),
    ],
  },

  // ════ 4年生 ════
  {
    id: "math-g4",
    name: "算数",
    grade: 4,
    units: [
      simpleUnit("g4-u1", "大きい数のしくみ", 1,
        [
          C("「一億」を数字で書くと？", "100000000", ["10000000", "1000000000", "10000000000"], "0が8こで一億。", ""),
          C("10000000 の読み方は？", "千万", ["百万", "一億", "十万"], "0が7こで千万。", ""),
          C("100万を10倍すると？", "1000万", ["10万", "1億", "100億"], "10倍で1000万。", ""),
        ],
        gen(3, () => scaleNumQ()),
        [
          C("1兆は1000億の何倍？", "10倍", ["100倍", "2倍", "1000倍"], "1000億×10=1兆。", ""),
          C("一億の100倍は？", "百億", ["十億", "一兆", "千万"], "1億×100=100億。", ""),
          C("3500万を10倍すると？", "3億5000万", ["350万", "35億", "3億"], "10倍で位が1つ上がる。", ""),
        ]
      ),
      simpleUnit("g4-u2", "折れ線グラフと表", 2,
        [
          C("折れ線グラフが表すのに合うのは？", "変わり方", ["割合", "形", "面積"], "変化を表すのに向く。", ""),
          C("線が右上がりのとき数は？", "ふえている", ["へっている", "変わらない", "ゼロ"], "右上がり=増加。", ""),
          C("線が水平のとき数は？", "変わらない", ["ふえる", "へる", "倍になる"], "水平=変化なし。", ""),
        ],
        [
          C("線が急なほど変化は？", "大きい", ["小さい", "ない", "ゼロ"], "急=変化が大きい。", ""),
          C("10度から15度に上がった。変化は？", "5度上がった", ["5度下がった", "変化なし", "15度"], "15-10=5度上昇。", ""),
          C("折れ線で一番高い点は何を表す？", "最大の値", ["最小", "平均", "合計"], "一番大きい値。", ""),
        ],
        [
          C("右下がりの線は何を表す？", "へっている", ["ふえている", "一定", "倍増"], "右下がり=減少。", ""),
          C("月曜20、火曜12。下がり方は？", "8下がった", ["8上がった", "32", "変化なし"], "20-12=8減。", ""),
          C("2本の折れ線が交わる点の意味は？", "値が等しくなった", ["最大", "合計", "差が最大"], "そこで等しい。", ""),
        ]
      ),
      simpleUnit("g4-u3", "わり算の筆算", 3,
        gen(3, () => divQ(2, 4, 5, 12)),
        gen(3, () => divRemQ(3, 6)),
        gen(3, () => divQ(4, 7, 40, 120))
      ),
      simpleUnit("g4-u4", "角の大きさ", 4,
        [
          C("直角は何度？", "90度", ["45度", "180度", "60度"], "直角=90度。", ""),
          C("1回転は何度？", "360度", ["180度", "90度", "270度"], "1回転=360度。", ""),
          C("半回転（一直線）は何度？", "180度", ["90度", "360度", "120度"], "半回転=180度。", ""),
        ],
        [
          C("三角形の3つの角の和は？", "180度", ["360度", "90度", "270度"], "内角の和180度。", ""),
          C("三角形で60度と70度。残りは？", "50度", ["60度", "70度", "40度"], "180-130=50度。", ""),
          C("分度器の中心を合わせるのは？", "角の頂点", ["辺のはし", "紙のかど", "辺の中"], "頂点に合わせる。", ""),
        ],
        [
          C("四角形の4つの角の和は？", "360度", ["180度", "270度", "90度"], "四角形は360度。", ""),
          C("一直線で1つが120度。残りは？", "60度", ["120度", "180度", "90度"], "180-120=60度。", ""),
          C("向かい合う角（対頂角）の大きさは？", "等しい", ["ちがう", "90度", "180度"], "対頂角は等しい。", ""),
        ]
      ),
      simpleUnit("g4-u5", "小数のしくみ", 5,
        gen(3, () => decimalAddQ()),
        gen(3, () => decimalSubQ()),
        [
          C("0.01が10こで いくつ？", "0.1", ["0.001", "1", "0.11"], "0.01×10=0.1。", ""),
          C("3.14の小数第2位の数字は？", "4", ["1", "3", "0"], "第2位は4。", ""),
          C("2.5 + 1.7 = ？", "4.2", ["3.2", "4.12", "42"], "2.5+1.7=4.2。", ""),
        ]
      ),
      simpleUnit("g4-u6", "わり算の筆算（２）", 6,
        gen(3, () => divQ(10, 30, 2, 9)),
        gen(3, () => divQ(11, 25, 3, 9)),
        gen(3, () => divRemQ(12, 30))
      ),
      simpleUnit("g4-u7", "倍の見方", 7,
        gen(3, () => timesQ()),
        [
          C("24は6の何倍？", "4倍", ["3倍", "18倍", "144倍"], "24÷6=4。", ""),
          C("ある数の3倍が21。ある数は？", "7", ["24", "63", "18"], "21÷3=7。", ""),
          C("8mの5倍は？", "40m", ["13m", "3m", "85m"], "8×5=40m。", ""),
        ],
        [
          C("もとの2倍が18、3倍はいくつ？", "27", ["20", "36", "9"], "もと9、9×3=27。", ""),
          C("赤6m青はその4倍。青は？", "24m", ["10m", "2m", "64m"], "6×4=24m。", ""),
          C("36は9の何倍？", "4倍", ["3倍", "27倍", "45倍"], "36÷9=4。", ""),
        ]
      ),
      simpleUnit("g4-u8", "がい数の表し方", 8,
        gen(3, () => roundQ()),
        gen(3, () => roundQ()),
        [
          C("4500を千の位までのがい数にすると？", "5000", ["4000", "4500", "5500"], "百の位5で切り上げ。", ""),
          C("23800を千の位までのがい数に。", "24000", ["23000", "23800", "24800"], "百の位8で切り上げ。", ""),
          C("約4000と約3000の和は？", "7000", ["1000", "12000", "7400"], "がい数の和7000。", ""),
        ]
      ),
      simpleUnit("g4-u9", "計算のきまり", 9,
        gen(3, () => calcRuleQ()),
        gen(3, () => calcRuleQ()),
        [
          C("8 × 7 + 8 × 3 をまとめると？", "8×(7+3)=80", ["8×7×3", "8+10", "56+3"], "分配法則で8×10=80。", ""),
          C("100 - (20 + 30) = ？", "50", ["110", "150", "90"], "()先で100-50=50。", ""),
          C("25 × 4 × 7 を計算すると？", "700", ["350", "175", "100"], "25×4=100,×7=700。", ""),
        ]
      ),
      simpleUnit("g4-u10", "垂直、平行と四角形", 10,
        [
          C("2直線が直角に交わる関係は？", "垂直", ["平行", "対称", "合同"], "直角に交わる=垂直。", ""),
          C("どこまでも交わらない2直線は？", "平行", ["垂直", "交差", "対角"], "交わらない=平行。", ""),
          C("向かい合う2組の辺が平行な四角形は？", "平行四辺形", ["台形", "正方形だけ", "三角形"], "平行四辺形。", ""),
        ],
        [
          C("1組だけ辺が平行な四角形は？", "台形", ["平行四辺形", "正方形", "ひし形"], "台形。", ""),
          C("4つの辺が全部同じ四角形は？", "ひし形", ["長方形", "台形", "ふつうの四角"], "ひし形。", ""),
          C("平行四辺形の向かい合う角は？", "等しい", ["直角", "ちがう", "ゼロ"], "向かい合う角は等しい。", ""),
        ],
        [
          C("平行線に1本が垂直なら、もう1本とは？", "垂直", ["平行", "45度", "交わらない"], "両方に垂直。", ""),
          C("ひし形の対角線の交わり方は？", "垂直に交わる", ["平行", "交わらない", "45度"], "対角線は垂直。", ""),
          C("平行四辺形でとなり合う角の和は？", "180度", ["90度", "360度", "120度"], "となりの和180度。", ""),
        ]
      ),
      simpleUnit("g4-u11", "分数", 11,
        gen(3, () => fracAddSameQ()),
        gen(3, () => fracSubSameQ()),
        [
          C("帯分数 1と2/5 を仮分数に。", "7/5", ["3/5", "12/5", "2/5"], "1=5/5,+2/5=7/5。", ""),
          C("仮分数 9/4 を帯分数に。", "2と1/4", ["1と1/4", "2と1/2", "9/4"], "9÷4=2あまり1。", ""),
          C("2/7 + 4/7 = ？", "6/7", ["6/14", "8/7", "6/49"], "分子をたして6/7。", ""),
        ]
      ),
      simpleUnit("g4-u12", "変わり方調べ", 12,
        [
          C("○+△=10で○が3なら△は？", "7", ["13", "30", "3"], "10-3=7。", ""),
          C("○が1ふえると△が1へる関係。和は？", "一定", ["ふえる", "へる", "倍"], "和は一定。", ""),
          C("○×2=△で○が4なら△は？", "8", ["6", "2", "16"], "4×2=8。", ""),
        ],
        [
          C("1辺□cmの正三角形のまわり△。□=5なら△は？", "15", ["10", "8", "25"], "5×3=15cm。", ""),
          C("○+△=20で△が12なら○は？", "8", ["32", "240", "12"], "20-12=8。", ""),
          C("1だんぼう3本。5だんは何本？", "15", ["12", "8", "18"], "3×5=15本。", ""),
        ],
        [
          C("○×4=△で△が28なら○は？", "7", ["32", "112", "24"], "28÷4=7。", ""),
          C("正方形の1辺□、まわり△=24なら□は？", "6", ["4", "12", "96"], "24÷4=6。", ""),
          C("○+△が常に15。○が9なら△は？", "6", ["24", "135", "9"], "15-9=6。", ""),
        ]
      ),
      simpleUnit("g4-u13", "面積のはかり方と表し方", 13,
        gen(3, () => squareAreaQ()),
        gen(3, () => rectAreaQ()),
        [
          C("1m² は 何cm²？", "10000cm²", ["100cm²", "1000cm²", "10cm²"], "100×100=10000cm²。", ""),
          C("1辺10mの正方形の面積は？", "100m²", ["40m²", "20m²", "1000m²"], "10×10=100m²。", ""),
          C("たて20m横30mの長方形の面積は？", "600m²", ["50m²", "100m²", "500m²"], "20×30=600m²。", ""),
        ]
      ),
      simpleUnit("g4-u14", "小数のかけ算とわり算", 14,
        gen(3, () => decimalMultIntQ()),
        gen(3, () => decimalDivIntQ()),
        [
          C("0.6 × 5 = ？", "3", ["30", "0.3", "3.5"], "0.6×5=3.0。", ""),
          C("4.8 ÷ 6 = ？", "0.8", ["8", "0.08", "1.2"], "4.8÷6=0.8。", ""),
          C("2.5 × 4 = ？", "10", ["1", "100", "9"], "2.5×4=10。", ""),
        ]
      ),
      simpleUnit("g4-u15", "直方体と立方体", 15,
        [
          C("直方体の面はいくつ？", "6", ["4", "8", "12"], "面は6つ。", ""),
          C("立方体の面の形は？", "正方形", ["長方形", "三角形", "円"], "立方体は正方形6面。", ""),
          C("直方体の辺は何本？", "12", ["8", "6", "4"], "辺は12本。", ""),
        ],
        [
          C("直方体の頂点はいくつ？", "8", ["6", "12", "4"], "頂点8つ。", ""),
          C("1つの面に垂直な面はいくつ？", "4", ["2", "6", "1"], "となりの4面が垂直。", ""),
          C("1つの面に平行な面はいくつ？", "1", ["2", "4", "0"], "向かい合う1面。", ""),
        ],
        [
          C("展開図を組み立てると何になる？", "立体", ["平面", "直線", "点"], "立体になります。", ""),
          C("立方体の辺は全部同じ長さ？", "同じ", ["ちがう", "半分", "2倍"], "12辺すべて等しい。", ""),
          C("直方体で長さの等しい辺は何本ずつ？", "4本ずつ3組", ["2本ずつ", "6本ずつ", "全部同じ"], "4本ずつ3組。", ""),
        ]
      ),
    ],
  },

  // ════ 5年生 ════
  {
    id: "math-g5",
    name: "算数",
    grade: 5,
    units: [
      simpleUnit("g5-u1", "整数と小数", 1,
        gen(3, () => scaleNumQ()),
        [
          C("2.5を10倍すると？", "25", ["0.25", "250", "12.5"], "10倍で小数点が右へ1つ。", ""),
          C("38を1/10にすると？", "3.8", ["380", "0.38", "3.08"], "1/10で小数点が左へ1つ。", ""),
          C("0.06を100倍すると？", "6", ["0.6", "60", "600"], "100倍で右へ2つ。", ""),
        ],
        [
          C("4.7を1/100にすると？", "0.047", ["0.47", "470", "0.0047"], "左へ2つ。", ""),
          C("1.23×1000は？", "1230", ["12300", "123", "12.3"], "右へ3つ。", ""),
          C("5は0.01が何こ分？", "500", ["50", "5", "5000"], "5÷0.01=500。", ""),
        ]
      ),
      simpleUnit("g5-u2", "直方体や立方体の体積", 2,
        gen(3, () => boxVolumeQ()),
        gen(3, () => boxVolumeQ()),
        [
          C("1辺5cmの立方体の体積は？", "125cm³", ["25cm³", "15cm³", "75cm³"], "5×5×5=125。", ""),
          C("1L は 何cm³？", "1000cm³", ["100cm³", "10cm³", "10000cm³"], "1L=1000cm³。", ""),
          C("1m³ は 何cm³？", "1000000cm³", ["10000cm³", "1000cm³", "100cm³"], "100×100×100。", ""),
        ]
      ),
      simpleUnit("g5-u3", "比例", 3,
        gen(3, () => proportionQ()),
        gen(3, () => proportionQ()),
        [
          C("xが2倍になるとyも？（比例）", "2倍", ["半分", "変わらない", "4倍"], "比例は同じ倍率。", ""),
          C("y=4×xでx=6のとき？", "24", ["10", "1.5", "46"], "4×6=24。", ""),
          C("比例でx=3,y=12。きまった数は？", "4", ["9", "36", "15"], "12÷3=4。", ""),
        ]
      ),
      simpleUnit("g5-u4", "小数のかけ算", 4,
        gen(3, () => decimalMultIntQ()),
        gen(3, () => decimalMultDecimalQ()),
        gen(3, () => decimalMultDecimalQ())
      ),
      simpleUnit("g5-u5", "小数のわり算", 5,
        gen(3, () => decimalDivIntQ()),
        gen(3, () => decimalDivDecimalQ()),
        gen(3, () => decimalDivDecimalQ())
      ),
      simpleUnit("g5-u6", "小数の倍", 6,
        [
          C("3mは2mの何倍？", "1.5倍", ["2倍", "0.5倍", "6倍"], "3÷2=1.5。", ""),
          C("6Lは4Lの何倍？", "1.5倍", ["2倍", "1.2倍", "24倍"], "6÷4=1.5。", ""),
          C("もとが5mで2倍は？", "10m", ["7m", "2.5m", "3m"], "5×2=10。", ""),
        ],
        [
          C("8kgは5kgの何倍？", "1.6倍", ["1.5倍", "3倍", "0.6倍"], "8÷5=1.6。", ""),
          C("もとの1.5倍が12。もとは？", "8", ["18", "10.5", "6"], "12÷1.5=8。", ""),
          C("4mの0.5倍は？", "2m", ["8m", "4.5m", "0.5m"], "4×0.5=2。", ""),
        ],
        [
          C("9mは6mの何倍？", "1.5倍", ["3倍", "1.3倍", "0.6倍"], "9÷6=1.5。", ""),
          C("もとの2.5倍が10。もとは？", "4", ["25", "7.5", "12.5"], "10÷2.5=4。", ""),
          C("12は8の何倍？", "1.5倍", ["1.2倍", "4倍", "0.6倍"], "12÷8=1.5。", ""),
        ]
      ),
      simpleUnit("g5-u7", "合同な図形", 7,
        [
          C("形も大きさも同じ図形を何という？", "合同", ["相似", "対称", "平行"], "ぴったり重なるのが合同。", ""),
          C("合同な図形で重なる角を何という？", "対応する角", ["対頂角", "内角", "外角"], "対応する角。", ""),
          C("合同な図形の対応する辺の長さは？", "等しい", ["ちがう", "2倍", "半分"], "等しい。", ""),
        ],
        [
          C("合同な三角形の対応する角は？", "等しい", ["ちがう", "直角", "ゼロ"], "対応する角は等しい。", ""),
          C("三角形の合同を決めるのに必要な情報は？", "3つの辺", ["1つの辺", "1つの角", "面積だけ"], "三辺がわかれば決まる。", ""),
          C("合同な図形はうら返すと重なることもある？", "ある", ["ない", "回せない", "のびる"], "裏返しても合同。", ""),
        ],
        [
          C("対応する辺が5cmなら相手の辺も？", "5cm", ["10cm", "2.5cm", "わからない"], "等しいので5cm。", ""),
          C("合同な四角形の周りの長さは？", "等しい", ["ちがう", "2倍", "半分"], "対応辺が等しいので周も等しい。", ""),
          C("三角形の合同条件でないのは？", "面積が等しい", ["三辺", "二辺とその間の角", "一辺と両端の角"], "面積だけでは決まらない。", ""),
        ]
      ),
      simpleUnit("g5-u8", "図形の角", 8,
        [
          C("三角形の3つの角の和は？", "180度", ["360度", "90度", "270度"], "180度。", ""),
          C("四角形の4つの角の和は？", "360度", ["180度", "270度", "540度"], "360度。", ""),
          C("三角形で50度と60度。残りは？", "70度", ["80度", "60度", "110度"], "180-110=70。", ""),
        ],
        [
          C("五角形の角の和は？", "540度", ["360度", "180度", "720度"], "180×(5-2)=540。", ""),
          C("四角形で90,90,100度。残りは？", "80度", ["90度", "70度", "100度"], "360-280=80。", ""),
          C("正方形の1つの角は？", "90度", ["60度", "120度", "45度"], "直角90度。", ""),
        ],
        [
          C("六角形の角の和は？", "720度", ["540度", "360度", "900度"], "180×4=720。", ""),
          C("正五角形の1つの角は？", "108度", ["120度", "90度", "100度"], "540÷5=108。", ""),
          C("三角形の外角は、となりにない2角の和に等しい？", "等しい", ["ちがう", "半分", "2倍"], "外角定理。", ""),
        ]
      ),
      simpleUnit("g5-u9", "偶数と奇数、倍数と約数", 9,
        [
          C("6は偶数？奇数？", "偶数", ["奇数", "どちらでもない", "両方"], "2でわり切れる。", ""),
          C("3の倍数を小さい順に。3番目は？", "9", ["6", "12", "3"], "3,6,9で9。", ""),
          C("12の約数でないのは？", "5", ["1", "2", "4"], "12は5でわり切れない。", ""),
        ],
        gen(3, () => gcdQ()),
        [
          C("4と6の最小公倍数は？", "12", ["24", "10", "2"], "12。", ""),
          C("8と12の最大公約数は？", "4", ["2", "24", "1"], "4。", ""),
          C("15と20の最小公倍数は？", "60", ["5", "300", "35"], "60。", ""),
        ]
      ),
      simpleUnit("g5-u10", "分数と小数、整数の関係", 10,
        [
          C("1/2を小数にすると？", "0.5", ["0.2", "1.2", "0.12"], "1÷2=0.5。", ""),
          C("3÷4を分数で表すと？", "3/4", ["4/3", "3/40", "12"], "わり算は分数に。", ""),
          C("0.7を分数にすると？", "7/10", ["1/7", "7/100", "10/7"], "0.7=7/10。", ""),
        ],
        [
          C("1/4を小数にすると？", "0.25", ["0.4", "0.14", "0.5"], "1÷4=0.25。", ""),
          C("0.25を分数にすると？", "1/4", ["25/10", "1/25", "4/1"], "0.25=1/4。", ""),
          C("2/5を小数にすると？", "0.4", ["0.25", "0.2", "2.5"], "2÷5=0.4。", ""),
        ],
        [
          C("3/8を小数にすると？", "0.375", ["0.38", "0.3", "0.83"], "3÷8=0.375。", ""),
          C("0.6を約分した分数は？", "3/5", ["6/10のまま", "1/6", "5/3"], "6/10=3/5。", ""),
          C("7/4を小数にすると？", "1.75", ["1.4", "0.57", "1.34"], "7÷4=1.75。", ""),
        ]
      ),
      simpleUnit("g5-u11", "分数のたし算とひき算", 11,
        gen(3, () => fracAddDiffQ()),
        gen(3, () => fracAddDiffQ()),
        [
          C("5/6 - 1/3 = ？", "1/2", ["4/3", "1/3", "4/6"], "通分して5/6-2/6=3/6=1/2。", ""),
          C("3/4 - 1/2 = ？", "1/4", ["2/2", "1/2", "5/4"], "3/4-2/4=1/4。", ""),
          C("3/4 - 1/6 = ？", "7/12", ["2/2", "1/2", "4/10"], "9/12-2/12=7/12。", ""),
        ]
      ),
      simpleUnit("g5-u12", "平均", 12,
        gen(3, () => averageQ()),
        gen(3, () => averageQ()),
        [
          C("10,20,30の平均は？", "20", ["30", "60", "15"], "60÷3=20。", ""),
          C("平均8、3つで合計は？", "24", ["8", "11", "16"], "8×3=24。", ""),
          C("4人の平均が15点。合計は？", "60", ["19", "15", "45"], "15×4=60。", ""),
        ]
      ),
      simpleUnit("g5-u13", "単位量あたりの大きさ", 13,
        gen(3, () => unitRateQ()),
        gen(3, () => unitRateQ()),
        [
          C("3Lで150km走る車。1Lで何km？", "50km", ["45km", "153km", "450km"], "150÷3=50。", ""),
          C("5冊で400円のノート。1冊は？", "80円", ["75円", "405円", "2000円"], "400÷5=80。", ""),
          C("6m²に18人。1m²あたりは？", "3人", ["2人", "24人", "108人"], "18÷6=3。", ""),
        ]
      ),
      simpleUnit("g5-u14", "四角形と三角形の面積", 14,
        gen(3, () => paralleloAreaQ()),
        gen(3, () => triangleAreaQ()),
        [
          C("上底4下底6高さ5の台形の面積は？", "25cm²", ["50cm²", "30cm²", "15cm²"], "(4+6)×5÷2=25。", ""),
          C("対角線8と6のひし形の面積は？", "24cm²", ["48cm²", "14cm²", "28cm²"], "8×6÷2=24。", ""),
          C("底辺10高さ4の三角形の面積は？", "20cm²", ["40cm²", "14cm²", "24cm²"], "10×4÷2=20。", ""),
        ]
      ),
      simpleUnit("g5-u15", "割合", 15,
        gen(3, () => percentFromDecQ()),
        gen(3, () => percentOfQ()),
        [
          C("ある数の20%が30。もとの数は？", "150", ["6", "60", "300"], "30÷0.2=150。", ""),
          C("定価2000円の30%引きは何円引き？", "600円", ["1400円", "660円", "300円"], "2000×0.3=600。", ""),
          C("80人の25%は何人？", "20人", ["25人", "16人", "40人"], "80×0.25=20。", ""),
        ]
      ),
      simpleUnit("g5-u16", "帯グラフと円グラフ", 16,
        [
          C("全体を100%として割合を表すグラフは？", "帯グラフ", ["折れ線", "ぼうグラフ", "絵グラフ"], "帯・円グラフ。", ""),
          C("円グラフ全体は何%？", "100%", ["50%", "360%", "10%"], "全体100%。", ""),
          C("円グラフ全体の角度は？", "360度", ["180度", "100度", "90度"], "1周360度。", ""),
        ],
        [
          C("25%は円グラフで何度分？", "90度", ["25度", "180度", "360度"], "360×0.25=90。", ""),
          C("帯グラフで半分をしめるのは何%？", "50%", ["25%", "100%", "60%"], "半分=50%。", ""),
          C("50%は円グラフで何度？", "180度", ["90度", "50度", "360度"], "360×0.5=180。", ""),
        ],
        [
          C("全体200人で40%は何人？", "80人", ["40人", "160人", "8人"], "200×0.4=80。", ""),
          C("円グラフで72度は何%？", "20%", ["72%", "36%", "10%"], "72÷360=0.2。", ""),
          C("A30%B45%なら残りCは？", "25%", ["15%", "75%", "35%"], "100-75=25。", ""),
        ]
      ),
      simpleUnit("g5-u19", "変わり方調べ", 17,
        [
          C("○が1から2に増えたとき△も2から4に増えた。この関係は？", "比例", ["反比例", "逆数", "一定"], "○が2倍になると△も2倍になるのは比例です。", ""),
          C("○+△=10 で○が3のとき△は？", "7", ["13", "30", "3"], "10-3=7です。", ""),
          C("○が1増えると△が2増える。△=2×○のとき○=4なら△は？", "8", ["6", "10", "2"], "2×4=8です。", ""),
        ],
        [
          C("1辺□cmの正三角形のまわりは△cm。□=5なら△は？", "15", ["10", "20", "25"], "5×3=15cm。", "まわり=辺の数×1辺の長さ。"),
          C("○×4=△で△が24なら○は？", "6", ["20", "96", "28"], "24÷4=6。", ""),
          C("○が2のとき△が6、○が3のとき△は？（比例）", "9", ["8", "10", "12"], "比例定数3、3×3=9。", ""),
        ],
        [
          C("○+△=15で○=9なら△は？", "6", ["24", "135", "9"], "15-9=6。", ""),
          C("表で○: 1,2,3 △: 4,8,12。○が5のとき△は？", "20", ["16", "24", "25"], "△=○×4なので5×4=20。", ""),
          C("○が1増えると△が3ずつ増える。○=1のとき△=3。○=6のとき△は？", "18", ["15", "21", "9"], "3×6=18。", ""),
        ]
      ),
      simpleUnit("g5-u17", "正多角形と円周の長さ", 18,
        gen(3, () => circumferenceQ()),
        gen(3, () => circumferenceQ()),
        [
          C("正六角形の辺の数は？", "6", ["5", "8", "4"], "6本。", ""),
          C("半径5cmの円の円周は？（3.14）", "31.4cm", ["15.7cm", "78.5cm", "10cm"], "10×3.14=31.4。", ""),
          C("正多角形の辺の長さは全部？", "等しい", ["ちがう", "2倍", "半分"], "等しい。", ""),
        ]
      ),
      simpleUnit("g5-u18", "角柱と円柱", 19,
        [
          C("底面が三角形の柱は？", "三角柱", ["三角すい", "円柱", "四角柱"], "三角柱。", ""),
          C("円柱の底面の形は？", "円", ["三角", "四角", "だ円"], "円。", ""),
          C("角柱の底面はいくつ？", "2", ["1", "3", "4"], "上下2つ。", ""),
        ],
        [
          C("四角柱の側面はいくつ？", "4", ["2", "6", "8"], "側面4つ。", ""),
          C("三角柱の面は全部でいくつ？", "5", ["6", "4", "3"], "底面2+側面3=5。", ""),
          C("円柱を横に切った切り口は？", "円", ["四角", "三角", "だ円"], "底面に平行なら円。", ""),
        ],
        [
          C("五角柱の側面はいくつ？", "5", ["10", "7", "2"], "5つ。", ""),
          C("三角柱の頂点はいくつ？", "6", ["5", "8", "4"], "上下3つずつ=6。", ""),
          C("円柱の展開図で側面は何の形？", "長方形", ["円", "三角", "台形"], "側面は長方形。", ""),
        ]
      ),
    ],
  },

  // ════ 6年生 ════
  {
    id: "math-g6",
    name: "算数",
    grade: 6,
    units: [
      simpleUnit("g6-u1", "対称な図形", 1,
        [
          C("1本の線で折るとぴったり重なる図形は？", "線対称", ["点対称", "合同", "相似"], "線対称。", ""),
          C("線対称の折り目の線を何という？", "対称の軸", ["対角線", "中心線でなく軸", "半径"], "対称の軸。", ""),
          C("正方形の対称の軸は何本？", "4", ["2", "1", "8"], "4本。", ""),
        ],
        [
          C("180度回すと重なる図形は？", "点対称", ["線対称", "合同のみ", "相似"], "点対称。", ""),
          C("長方形の対称の軸は何本？", "2", ["4", "1", "0"], "2本。", ""),
          C("円の対称の軸は何本？", "無数", ["1", "2", "4"], "直径すべてが軸。", ""),
        ],
        [
          C("正三角形の対称の軸は何本？", "3", ["1", "2", "6"], "3本。", ""),
          C("点対称の中心を何という？", "対称の中心", ["対称の軸", "頂点", "重心でなく中心"], "対称の中心。", ""),
          C("平行四辺形は点対称？線対称？", "点対称", ["線対称", "両方", "どちらでもない"], "点対称（一般には線対称でない）。", ""),
        ]
      ),
      simpleUnit("g6-u2", "文字と式", 2,
        gen(3, () => substituteQ()),
        gen(3, () => substituteQ()),
        [
          C("1本x円のえんぴつ5本の代金は？", "5×x", ["x+5", "x÷5", "x-5"], "5×x円。", ""),
          C("x×4=20のときxは？", "5", ["80", "16", "24"], "20÷4=5。", ""),
          C("底辺x高さ6の三角形の面積を式に。", "x×6÷2", ["x×6", "x+6", "x×3×2"], "三角形=底辺×高さ÷2。", ""),
        ]
      ),
      simpleUnit("g6-u3", "分数のかけ算", 3,
        gen(3, () => fracMultQ()),
        gen(3, () => fracMultQ()),
        [
          C("2/3 × 3/4 = ？", "1/2", ["6/12のまま", "5/7", "6/7"], "6/12=1/2。", ""),
          C("3/5 × 10 = ？", "6", ["30/5のまま", "3/50", "13/5"], "30/5=6。", ""),
          C("4/9 × 3/8 = ？", "1/6", ["12/72のまま", "7/17", "1/12"], "12/72=1/6。", ""),
        ]
      ),
      simpleUnit("g6-u4", "分数のわり算", 4,
        gen(3, () => fracDivQ()),
        gen(3, () => fracDivQ()),
        [
          C("2/3 ÷ 4/5 = ？", "5/6", ["8/15", "10/12のまま", "5/7"], "2/3×5/4=10/12=5/6。", ""),
          C("3/4 ÷ 3 = ？", "1/4", ["9/4", "3/12のまま", "1/3"], "3/4×1/3=1/4。", ""),
          C("5/6 ÷ 5/12 = ？", "2", ["1/2", "25/72", "60/30のまま"], "5/6×12/5=2。", ""),
        ]
      ),
      simpleUnit("g6-u5", "分数の倍", 5,
        [
          C("6mは8mの何倍？（分数で）", "3/4", ["4/3", "3/4倍でない", "6/8のまま"], "6/8=3/4。", ""),
          C("もとの3/4が9。もとは？", "12", ["6", "27/4", "12.5"], "9÷3/4=12。", ""),
          C("4の3/2倍は？", "6", ["8", "2", "12"], "4×3/2=6。", ""),
        ],
        [
          C("10は15の何倍（分数）？", "2/3", ["3/2", "10/15のまま", "5"], "10/15=2/3。", ""),
          C("もとの2/5が8。もとは？", "20", ["3.2", "16", "10"], "8÷2/5=20。", ""),
          C("9の2/3倍は？", "6", ["13.5", "3", "27"], "9×2/3=6。", ""),
        ],
        [
          C("8mは12mの何倍？", "2/3", ["3/2", "8/12のまま", "4"], "8/12=2/3。", ""),
          C("もとの5/6が10。もとは？", "12", ["8.3", "60", "11"], "10÷5/6=12。", ""),
          C("14の3/7倍は？", "6", ["2", "42", "21"], "14×3/7=6。", ""),
        ]
      ),
      simpleUnit("g6-u6", "比", 6,
        gen(3, () => ratioValueQ()),
        gen(3, () => equalRatioQ()),
        [
          C("12:18を簡単にすると？", "2:3", ["3:2", "6:9", "1:2"], "6でわって2:3。", ""),
          C("3:4=□:12 の□は？", "9", ["6", "15", "12"], "4→12は3倍、3×3=9。", ""),
          C("みかんとりんごが2:3で全部20こ。みかんは？", "8こ", ["12こ", "10こ", "6こ"], "20×2/5=8。", ""),
        ]
      ),
      simpleUnit("g6-u7", "拡大図と縮図", 7,
        [
          C("形が同じで大きくした図を？", "拡大図", ["縮図", "合同", "対称"], "拡大図。", ""),
          C("形が同じで小さくした図を？", "縮図", ["拡大図", "合同", "相似でなく縮図"], "縮図。", ""),
          C("2倍の拡大図で辺は何倍？", "2倍", ["4倍", "半分", "同じ"], "辺は2倍。", ""),
        ],
        [
          C("拡大・縮図で対応する角は？", "等しい", ["ちがう", "2倍", "半分"], "角は変わらない。", ""),
          C("1/2の縮図で6cmの辺は？", "3cm", ["12cm", "6cm", "4cm"], "6×1/2=3。", ""),
          C("3倍の拡大図で4cmの辺は？", "12cm", ["7cm", "4cm", "1.3cm"], "4×3=12。", ""),
        ],
        [
          C("縮尺1/1000で地図2cmは実際何m？", "20m", ["2m", "200m", "2000m"], "2cm×1000=2000cm=20m。", ""),
          C("2倍の拡大図で面積は何倍？", "4倍", ["2倍", "8倍", "同じ"], "面積は2×2=4倍。", ""),
          C("1/100の縮図で実際5mは図で何cm？", "5cm", ["50cm", "0.5cm", "500cm"], "500cm÷100=5cm。", ""),
        ]
      ),
      simpleUnit("g6-u8", "円の面積", 8,
        gen(3, () => circleAreaQ()),
        gen(3, () => circleAreaQ()),
        [
          C("半径10cmの円の面積は？（3.14）", "314cm²", ["62.8cm²", "31.4cm²", "100cm²"], "10×10×3.14=314。", ""),
          C("直径6cmの円の面積は？", "28.26cm²", ["18.84cm²", "113.04cm²", "36cm²"], "半径3、3×3×3.14=28.26。", ""),
          C("半径2cmの半円の面積は？", "6.28cm²", ["12.56cm²", "3.14cm²", "4cm²"], "2×2×3.14÷2=6.28。", ""),
        ]
      ),
      simpleUnit("g6-u9", "角柱と円柱の体積", 9,
        [
          C("角柱・円柱の体積の求め方は？", "底面積×高さ", ["底面積+高さ", "底面積÷高さ", "たて×よこ"], "底面積×高さ。", ""),
          C("底面積20cm²高さ5cmの体積は？", "100cm³", ["25cm³", "4cm³", "200cm³"], "20×5=100。", ""),
          C("底面積15高さ4の角柱の体積は？", "60cm³", ["19cm³", "3.75cm³", "120cm³"], "15×4=60。", ""),
        ],
        [
          C("底面が3×4の長方形高さ5の体積は？", "60cm³", ["12cm³", "35cm³", "120cm³"], "12×5=60。", ""),
          C("底面積25高さ6の体積は？", "150cm³", ["31cm³", "4cm³", "300cm³"], "25×6=150。", ""),
          C("半径2cm高さ10cmの円柱の体積は？（3.14）", "125.6cm³", ["62.8cm³", "12.56cm³", "40cm³"], "2×2×3.14×10=125.6。", ""),
        ],
        [
          C("底面が三角形(底辺6高さ4)高さ10の三角柱の体積は？", "120cm³", ["240cm³", "12cm³", "60cm³"], "底面積12×10=120。", ""),
          C("半径3cm高さ5cmの円柱の体積は？（3.14）", "141.3cm³", ["47.1cm³", "28.26cm³", "45cm³"], "3×3×3.14×5=141.3。", ""),
          C("底面積40高さ7の体積は？", "280cm³", ["47cm³", "5.7cm³", "560cm³"], "40×7=280。", ""),
        ]
      ),
      simpleUnit("g6-u10", "およその面積と体積", 10,
        [
          C("およその面積を求めるとき形を何に見立てる？", "長方形や三角形", ["円だけ", "点", "線"], "近い形に見立てる。", ""),
          C("約20m×約30mの土地のおよその面積は？", "600m²", ["50m²", "100m²", "500m²"], "20×30=600。", ""),
          C("方眼1マス1cm²で約12マス分の面積は？", "約12cm²", ["12m²", "1.2cm²", "24cm²"], "12マス=約12cm²。", ""),
        ],
        [
          C("約10m×約8mの花だんのおよその面積は？", "80m²", ["18m²", "40m²", "800m²"], "10×8=80。", ""),
          C("約5cm×5cm×4cmの箱のおよその体積は？", "100cm³", ["14cm³", "25cm³", "1000cm³"], "5×5×4=100。", ""),
          C("半径約10mの円の池のおよその面積は？（3.14）", "314m²", ["62.8m²", "100m²", "31.4m²"], "10×10×3.14=314。", ""),
        ],
        [
          C("約30m×約40mの校庭のおよその面積は？", "1200m²", ["70m²", "120m²", "12000m²"], "30×40=1200。", ""),
          C("底面積約50m²深さ約2mのプールの体積は？", "100m³", ["52m³", "25m³", "1000m³"], "50×2=100。", ""),
          C("約8m×約6mの部屋のおよその面積は？", "48m²", ["14m²", "24m²", "480m²"], "8×6=48。", ""),
        ]
      ),
      simpleUnit("g6-u11", "比例と反比例", 11,
        gen(3, () => proportionQ()),
        [
          C("xが2倍でyが半分の関係は？", "反比例", ["比例", "一定", "合同"], "反比例。", ""),
          C("反比例でx×y=12。x=3のときyは？", "4", ["36", "9", "15"], "12÷3=4。", ""),
          C("比例のグラフは何になる？", "直線", ["曲線", "円", "点"], "原点を通る直線。", ""),
        ],
        [
          C("反比例 x×y=24。x=6のとき？", "4", ["18", "144", "30"], "24÷6=4。", ""),
          C("比例でx=4,y=20。x=10のとき？", "50", ["26", "8", "40"], "比例定数5、5×10=50。", ""),
          C("反比例のグラフの形は？", "曲線", ["直線", "円", "折れ線"], "なめらかな曲線。", ""),
        ]
      ),
      simpleUnit("g6-u12", "場合の数", 12,
        [
          C("A,B,Cの3人が1列に並ぶ並び方は何通り？", "6通り", ["3通り", "9通り", "12通り"], "3×2×1=6。", ""),
          C("赤青黄から2色選ぶ組み合わせは？", "3通り", ["6通り", "2通り", "9通り"], "赤青/赤黄/青黄。", ""),
          C("コインを2回投げる表裏の出方は？", "4通り", ["2通り", "3通り", "8通り"], "2×2=4。", ""),
        ],
        [
          C("4人から委員長1人副1人を選ぶ選び方は？", "12通り", ["4通り", "6通り", "24通り"], "4×3=12。", ""),
          C("1,2,3で2けたの整数（同じ数字なし）は？", "6通り", ["9通り", "3通り", "12通り"], "3×2=6。", ""),
          C("4チームの総当たり試合数は？", "6試合", ["4試合", "12試合", "8試合"], "4×3÷2=6。", ""),
        ],
        [
          C("A,B,C,Dの4人が1列に並ぶ並び方は？", "24通り", ["12通り", "16通り", "4通り"], "4×3×2×1=24。", ""),
          C("5人から2人を選ぶ組み合わせは？", "10通り", ["20通り", "25通り", "5通り"], "5×4÷2=10。", ""),
          C("0,1,2で3けたの整数（同じ数字なし、先頭0不可）は？", "4通り", ["6通り", "9通り", "3通り"], "先頭1か2、残り並べ2×2=4。", ""),
        ]
      ),
      simpleUnit("g6-u13", "データの調べ方", 13,
        gen(3, () => averageQ()),
        [
          C("データの真ん中の値を何という？", "中央値", ["平均値", "最頻値", "合計"], "中央値（メジアン）。", ""),
          C("一番多く出てくる値を何という？", "最頻値", ["中央値", "平均値", "範囲"], "最頻値（モード）。", ""),
          C("最大と最小の差を何という？", "範囲", ["平均", "中央値", "合計"], "範囲（レンジ）。", ""),
        ],
        [
          C("2,4,4,6,9の最頻値は？", "4", ["5", "6", "9"], "4が2回で最多。", ""),
          C("1,3,5,7,9の中央値は？", "5", ["4", "9", "25"], "真ん中は5。", ""),
          C("最高90最低40の範囲は？", "50", ["130", "65", "40"], "90-40=50。", ""),
        ]
      ),
    ],
  },
];

