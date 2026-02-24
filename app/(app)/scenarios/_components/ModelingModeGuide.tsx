"use client";

import { useState, useCallback, useEffect } from "react";
import { SCENARIO_GUIDE } from "@/lib/copy/scenario-guide";
import { Button } from "@/components/ui/button";

/** Simple inline bold: **text** → <strong>text</strong> */
function formatInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-content">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

function GuideContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        {SCENARIO_GUIDE.intro}
      </p>
      {SCENARIO_GUIDE.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          <h3 className="text-sm font-medium text-content">
            {section.title}
          </h3>
          {"content" in section && section.content && (
            <div className="space-y-2">
              {section.content.split(/\n\n+/).map((para, k) => (
                <p
                  key={k}
                  className="text-sm leading-relaxed text-content-muted"
                >
                  {formatInlineBold(para)}
                </p>
              ))}
            </div>
          )}
          {"items" in section &&
            section.items &&
            section.items.map((item, j) => (
              <div
                key={j}
                className="rounded-md border border-border bg-surface-elevated p-3"
              >
                <div className="text-sm font-medium text-content">
                  {item.label}
                </div>
                <div className="mt-1 text-sm text-content-muted">
                  {formatInlineBold(item.config)}
                </div>
                <div className="mt-1 text-xs text-content-muted">
                  {item.why}
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

export function ModelingModeGuide() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Real vs Nominal guide
      </Button>

      {open && (
        <div
          id="modeling-guide-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modeling-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={close}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2
                id="modeling-guide-title"
                className="text-base font-medium text-content"
              >
                {SCENARIO_GUIDE.toggleLabel}
              </h2>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={close}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </Button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 52px)" }}>
              <GuideContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
