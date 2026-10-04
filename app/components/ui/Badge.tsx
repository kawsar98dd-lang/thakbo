import type { ReactNode } from "react";
import { cx } from "~/lib/utils";

type Tone = "neutral" | "brand" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-800",
  brand: "bg-brand-100 text-brand-900",
  warning: "bg-accent-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
};

/** Always contains text, so status is never communicated by colour alone. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>;
}
