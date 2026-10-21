import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ToastTone = "info" | "error" | "success" | "warning";
type ToastItem = { id: number; tone: ToastTone; title?: string; message: string; duration: number };
type ToastInput = Omit<ToastItem, "id" | "duration"> & { duration?: number };
const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null);
let nextToastId = 1;
const toneClasses: Record<ToastTone, string> = {
  success: "toast-success", error: "toast-error", warning: "toast-warning", info: "toast-info",
};

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value.showToast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback((input: ToastInput) => {
    const id = nextToastId++;
    const duration = input.duration ?? (input.tone === "error" ? 6500 : input.tone === "warning" ? 5000 : input.tone === "info" ? 4000 : 3500);
    setToasts((items) => [...items.slice(-3), { ...input, id, duration }]);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);



  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => dismiss(toast.id), toast.duration));
    return () => timers.forEach(window.clearTimeout);
  }, [toasts, dismiss]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-viewport" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => <section key={toast.id} className={`toast-card ${toneClasses[toast.tone]}`} role={toast.tone === "error" ? "alert" : "status"}>
        <span className="toast-icon"><Icon name={toast.tone === "success" ? "check" : "alert"} className="size-5" /></span>
        <div className="min-w-0 flex-1">{toast.title ? <p className="font-bold">{toast.title}</p> : null}<p className="break-words text-sm">{toast.message}</p></div>
        <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>×</button>
      </section>)}
    </div>
  </ToastContext.Provider>;
}
