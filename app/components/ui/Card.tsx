import type { HTMLAttributes } from "react";
import { cx } from "~/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,55,48,0.045)] sm:p-6", className)} {...props} />;
}
