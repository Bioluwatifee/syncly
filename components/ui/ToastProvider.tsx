"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import CheckMarkIcon from "@/components/ui/CheckMarkIcon";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { accent: string; icon: "check" | "!" | "i" }> = {
  success: { accent: "#1ed760", icon: "check" },
  error: { accent: "#e85f47", icon: "!" },
  info: { accent: "#e8c547", icon: "i" },
  warning: { accent: "#f29d4b", icon: "!" },
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  const style = TONE_STYLES[tone];
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        border: `1px solid ${style.accent}`,
        color: style.accent,
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'DM Sans', sans-serif",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {style.icon === "check" ? <CheckMarkIcon size={12} color={style.accent} /> : style.icon}
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tone = input.tone ?? "info";
    const durationMs = input.durationMs ?? (tone === "error" ? 5200 : 3600);

    setToasts((prev) => [
      ...prev.slice(-3),
      {
        id,
        title: input.title,
        description: input.description,
        tone,
      },
    ]);

    window.setTimeout(() => {
      removeToast(id);
    }, durationMs);
  }, [removeToast]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "min(92vw, 360px)",
          pointerEvents: "none",
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              background: "rgba(19, 19, 22, 0.95)",
              border: "1px solid rgba(255,255,255,0.11)",
              borderRadius: 12,
              boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              padding: "12px 12px 12px 11px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
            role="status"
          >
            <ToastIcon tone={toast.tone} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#f0ede8",
                  fontSize: 18,
                  lineHeight: 1.1,
                  marginBottom: toast.description ? 4 : 0,
                }}
              >
                {toast.title}
              </div>
              {toast.description && (
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}
                >
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
                padding: 2,
                marginTop: 2,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
