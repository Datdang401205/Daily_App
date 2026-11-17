"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "@/store/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-6"
    >
      {toasts.map((toast) => {
        const Icon = toast.variant === "success" ? CheckCircle2 : toast.variant === "error" ? XCircle : Info;
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card p-3 text-sm shadow-lg animate-slide-up",
              toast.variant === "success" && "border-emerald-500/30",
              toast.variant === "error" && "border-destructive/40"
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                toast.variant === "success" && "text-emerald-600 dark:text-emerald-400",
                toast.variant === "error" && "text-destructive",
                toast.variant === "default" && "text-primary"
              )}
            />
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
