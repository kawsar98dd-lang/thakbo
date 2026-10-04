import type { HTMLAttributes } from "react";
import { cx } from "~/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6", className)} {...props} />;
}
