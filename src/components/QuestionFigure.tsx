"use client";

/**
 * 問題に付随する図・グラフを描画する。
 * figure 文字列の形式: "kind|payload"
 *   dots|3                         … ○を3こ ならべる（かぞえる用）
 *   bars|りんご:3,みかん:5,ぶどう:2   … ぼうグラフ
 *   clock|3:00                      … アナログ時計（H:MM）
 *   seq|★,☆,●,◆                    … 記号をならべて 左/右からの順番を見せる
 */
export default function QuestionFigure({ figure }: { figure: string }) {
  const sep = figure.indexOf("|");
  if (sep < 0) return null;
  const kind = figure.slice(0, sep).trim();
  const payload = figure.slice(sep + 1).trim();

  let inner: React.ReactNode = null;
  if (kind === "dots") inner = <Dots payload={payload} />;
  else if (kind === "bars") inner = <Bars payload={payload} />;
  else if (kind === "clock") inner = <Clock payload={payload} />;
  else if (kind === "seq") inner = <Seq payload={payload} />;
  else return null;

  return (
    <div
      className="rounded-xl px-4 py-4 my-1 flex items-center justify-center"
      style={{ background: "rgba(34,224,229,0.06)", border: "1px solid rgba(34,224,229,0.3)" }}
    >
      {inner}
    </div>
  );
}

const CYAN = "#22e0e5";
const PALETTE = ["#22e0e5", "#f7c948", "#3ef08a", "#ff6ba6", "#a78bfa", "#ff9e64"];

/** ○を N こ ならべる */
function Dots({ payload }: { payload: string }) {
  const n = Math.max(0, Math.min(50, parseInt(payload, 10) || 0));
  return (
    <div className="flex flex-wrap gap-2.5 justify-center max-w-[16rem]">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 30,
            height: 30,
            border: `3px solid ${CYAN}`,
            background: "transparent",
            boxShadow: `0 0 8px rgba(34,224,229,0.45)`,
          }}
        />
      ))}
    </div>
  );
}

/** ぼうグラフ */
function Bars({ payload }: { payload: string }) {
  const items = payload
    .split(",")
    .map((s) => {
      const [label, v] = s.split(":");
      return { label: (label ?? "").trim(), value: Math.max(0, parseInt(v ?? "0", 10) || 0) };
    })
    .filter((x) => x.label);
  if (items.length === 0) return null;
  const max = Math.max(...items.map((x) => x.value), 1);
  const H = 120;

  return (
    <div className="flex items-end gap-4" style={{ minHeight: H + 36 }}>
      {items.map((it, i) => {
        const color = PALETTE[i % PALETTE.length];
        const h = Math.round((it.value / max) * H) + 4;
        return (
          <div key={it.label} className="flex flex-col items-center gap-1.5">
            <span className="font-display text-sm font-black" style={{ color }}>
              {it.value}
            </span>
            <div
              className="rounded-t-md"
              style={{ width: 30, height: h, background: color, boxShadow: `0 0 10px ${color}66` }}
            />
            <span className="text-[11px] font-bold" style={{ color: "#dceefb" }}>
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** アナログ時計 */
function Clock({ payload }: { payload: string }) {
  const [hStr, mStr] = payload.split(":");
  const h = parseInt(hStr ?? "12", 10) || 12;
  const m = parseInt(mStr ?? "0", 10) || 0;
  const minuteAngle = m * 6; // 1分=6度
  const hourAngle = ((h % 12) + m / 60) * 30; // 1時=30度
  const cx = 70;
  const cy = 70;
  const R = 60;

  const hand = (angleDeg: number, len: number, width: number, color: string) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return (
      <line
        x1={cx}
        y1={cy}
        x2={cx + len * Math.cos(a)}
        y2={cy + len * Math.sin(a)}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    );
  };

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={R} fill="rgba(8,14,32,0.9)" stroke={CYAN} strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        const num = i === 0 ? 12 : i;
        return (
          <text
            key={i}
            x={cx + (R - 14) * Math.cos(a)}
            y={cy + (R - 14) * Math.sin(a) + 5}
            textAnchor="middle"
            fontSize="13"
            fontWeight="800"
            fill="#dceefb"
          >
            {num}
          </text>
        );
      })}
      {hand(hourAngle, 32, 5, "#f7c948")}
      {hand(minuteAngle, 46, 3, CYAN)}
      <circle cx={cx} cy={cy} r="4" fill="#fff" />
    </svg>
  );
}

/** 記号をならべる（なんばんめ用） */
function Seq({ payload }: { payload: string }) {
  const items = payload.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="flex items-end gap-2">
      {items.map((sym, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span
            className="flex items-center justify-center text-2xl"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(20,32,60,0.85)",
              border: `1.5px solid rgba(34,224,229,0.45)`,
              color: "#fff",
            }}
          >
            {sym}
          </span>
          <span className="text-[10px] font-bold" style={{ color: "#7b93b5" }}>
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
