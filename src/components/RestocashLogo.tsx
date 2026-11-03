import React from "react";

export function RestocashLogo({
  className = "",
  size = 24,
  variant = "default",
  showDeveloper = false,
}: {
  className?: string;
  size?: number;
  variant?: "default" | "white";
  showDeveloper?: boolean;
}) {
  const isWhite = variant === "white";
  const boxSize = Math.max(28, Math.round(size * 1.25));
  const textSize = Math.max(15, Math.round(size * 0.78));

  return (
    <div className={`inline-flex flex-col no-translate select-none ${className}`} dir="ltr">
      <div className="inline-flex items-center gap-2.5">
        <div
          style={{ width: boxSize, height: boxSize }}
          className={`relative flex items-center justify-center rounded-xl shrink-0 shadow-xs border ${
            isWhite
              ? "bg-white/15 border-white/25 text-white backdrop-blur-md"
              : "bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-800 border-emerald-500/30 text-white dark:from-emerald-600 dark:via-teal-700 dark:to-slate-900"
          }`}
        >
          <svg
            width={Math.round(boxSize * 0.58)}
            height={Math.round(boxSize * 0.58)}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M4 7.5L12 3L20 7.5V16.5L12 21L4 16.5V7.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              className="opacity-35"
            />
            <path
              d="M8.5 15.5V8.5H12.5C14.1569 8.5 15.5 9.61929 15.5 11C15.5 12.3807 14.1569 13.5 12.5 13.5H8.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12.2 13.5L15.8 16.5"
              stroke="#34D399"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />
        </div>

        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            style={{ fontSize: textSize }}
            className={`font-extrabold tracking-tight ${
              isWhite ? "text-white" : "text-foreground"
            }`}
          >
            Resto<span className={isWhite ? "text-emerald-300" : "text-primary"}>cash</span>
          </span>
          <span
            className={`text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${
              isWhite
                ? "bg-white/15 text-emerald-200 border-white/20"
                : "bg-primary/10 text-primary border-primary/20"
            }`}
          >
            ERP
          </span>
        </div>
      </div>

      {showDeveloper && (
        <span
          className={`text-[10px] font-medium tracking-wider uppercase mt-1 ${
            isWhite ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          Enterprise Suite • Lion Creativity M.H
        </span>
      )}
    </div>
  );
}
