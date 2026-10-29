import { useEffect, useRef, useState } from "react";

export function OrderTimer({ createdAt }: { createdAt?: string | null }) {
  const [elapsed, setElapsed] = useState<string>("00:00");
  const startMsRef = useRef<number>(Date.now());
  const lastPropRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const now = Date.now();
    if (createdAt !== lastPropRef.current) {
      lastPropRef.current = createdAt;
      const parsed = createdAt ? new Date(createdAt).getTime() : now;
      // Guard against NaN or server clock being ahead of client clock
      startMsRef.current = !isNaN(parsed) && parsed > 0 ? Math.min(parsed, now) : now;
    }

    const updateTimer = () => {
      const currentNow = Date.now();
      const diff = Math.max(0, currentNow - startMsRef.current);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setElapsed(
          `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
        );
      } else {
        setElapsed(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div
      className="inline-flex items-center gap-1.5 bg-slate-900/10 px-2 py-0.5 rounded text-xs sm:text-sm font-black font-mono tabular-nums text-slate-800 shrink-0"
      role="timer"
      aria-label={`وقت الطلب المنقضي: ${elapsed}`}
      aria-live="off"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
      </span>
      <span>{elapsed}</span>
    </div>
  );
}
