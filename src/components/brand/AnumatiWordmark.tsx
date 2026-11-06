import { cn } from "@/lib/utils";

/** Anumati wordmark: Telugu "అను" + Hindi "मति", with "ANUMATI" underneath (per brand brief). */
export function AnumatiWordmark({
  tone = "light",
  size = 32,
  className,
  align = "left",
}: {
  tone?: "light" | "dark";
  size?: number;
  className?: string;
  align?: "left" | "center";
}) {
  const onDark = tone === "dark";
  return (
    <div className={cn("inline-flex flex-col leading-none", align === "center" ? "items-center" : "items-start", className)} aria-label="Anumati">
      <span className="whitespace-nowrap font-bold" style={{ fontSize: size, lineHeight: 1.1 }}>
        <span className={onDark ? "text-white" : "text-brand-blue"} style={{ fontFamily: "var(--font-wordmark-te)" }}>అను</span>
        <span className={onDark ? "text-brand-orange" : "text-brand-orange-light"} style={{ fontFamily: "var(--font-wordmark-hi)" }}>मति</span>
      </span>
      <span
        className={cn("font-serif uppercase", onDark ? "text-white" : "text-charcoal")}
        style={{ fontSize: Math.max(9, size * 0.2), letterSpacing: "0.3em", marginTop: size * 0.14 * 0.5 }}
      >
        Anumati
      </span>
    </div>
  );
}
