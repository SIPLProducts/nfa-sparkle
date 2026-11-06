import { cn } from "@/lib/utils";

/** Anumati wordmark: Telugu "అను" + Hindi "मति", with "ANUMATI" underneath (per brand brief). */
export function AnumatiWordmark({
  tone = "light",
  size = 32,
  className,
  align = "left",
  maxVh,
}: {
  maxVh?: number;
  tone?: "light" | "dark";
  size?: number;
  className?: string;
  align?: "left" | "center";
}) {
  const onDark = tone === "dark";
  // Optional cap based on screen height so short screens don't overflow.
  const fs = (k: number) => (maxVh ? `min(${size * k}px, ${maxVh * k}vh)` : `${size * k}px`);
  return (
    <div className={cn("inline-flex flex-col leading-none", align === "center" ? "items-center" : "items-start", className)} aria-label="Anumati">
      <span className="whitespace-nowrap font-bold" style={{ fontSize: fs(1), lineHeight: 1.1 }}>
        <span className={onDark ? "text-white" : "text-brand-blue"} style={{ fontFamily: "var(--font-wordmark-te)" }}>అను</span>
        <span className={onDark ? "text-brand-orange" : "text-brand-orange-light"} style={{ fontFamily: "var(--font-wordmark-hi)" }}>मति</span>
      </span>
      <span
        className={cn("font-serif uppercase", onDark ? "text-white" : "text-charcoal")}
        style={{ fontSize: `max(9px, ${fs(0.2)})`, letterSpacing: "0.3em", marginTop: fs(0.07) }}
      >
        Anumati
      </span>
    </div>
  );
}
