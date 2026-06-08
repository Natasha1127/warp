import Link from "next/link";

const GRADES = [
  { grade: 1, color: "#ff7a4d", shadow: "#c4502b", emoji: "🪐", label: "1年生", sub: "はじめての星" },
  { grade: 2, color: "#f4b942", shadow: "#bd8a17", emoji: "🌕", label: "2年生", sub: "月のクレーター" },
  { grade: 3, color: "#3aa66b", shadow: "#247a4a", emoji: "⭐", label: "3年生", sub: "かがやく恒星" },
  { grade: 4, color: "#1cb0f6", shadow: "#1083b8", emoji: "🌍", label: "4年生", sub: "青い惑星" },
  { grade: 5, color: "#7c6ff0", shadow: "#5044b3", emoji: "🌟", label: "5年生", sub: "流れ星の道" },
  { grade: 6, color: "#e2604f", shadow: "#a83e30", emoji: "🚀", label: "6年生", sub: "深宇宙へ" },
];

export default function GradesPage() {
  return (
    <div className="space-bg min-h-screen flex flex-col items-center pt-8 pb-20 px-4">
      {/* ヘッダー */}
      <header className="w-full max-w-lg flex items-center gap-3 mb-8 relative z-10">
        <Link href="/" className="text-sm font-bold text-white/80 hover:text-white">
          ← もどる
        </Link>
        <h1 className="flex-1 text-center font-display text-3xl font-black text-white neon-text">
          学年をえらぼう
        </h1>
        <span className="text-2xl rocket">🚀</span>
      </header>

      {/* 学年カード */}
      <section className="w-full max-w-lg flex flex-col gap-4 relative z-10">
        {GRADES.map(({ grade, color, shadow, emoji, label, sub }, i) => (
          <Link
            key={grade}
            href={`/units?grade=${grade}`}
            className="duo3d node-pop flex items-center gap-4 rounded-2xl px-5 py-4 text-white"
            style={{
              background: `linear-gradient(110deg, ${color}, ${color}cc)`,
              ["--d3d" as string]: shadow,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <span className="text-4xl float select-none">{emoji}</span>
            <div className="flex-1">
              <div className="font-display text-2xl font-black leading-none">{label}</div>
              <div className="text-xs font-bold opacity-85 mt-1">{sub}</div>
            </div>
            <span className="font-display text-3xl font-black opacity-60">{grade}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
