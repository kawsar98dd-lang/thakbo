import type { ReactNode } from "react";
import { cx } from "~/lib/utils";
import { Icon } from "./Icon";

type Tone = "info" | "error" | "success";

const TONES: Record<Tone, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-green-200 bg-green-50 text-green-900",
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 rounded-lg border p-3 text-sm", TONES[tone])}>
      <Icon name={tone === "success" ? "check" : "alert"} className="mt-0.5 size-5 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
