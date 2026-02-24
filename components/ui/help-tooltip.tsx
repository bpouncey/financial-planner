"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

type TooltipSide = "top" | "right" | "bottom" | "left";

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    className="h-3 w-3"
    aria-hidden
  >
    <path
      fillRule="evenodd"
      d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z"
      clipRule="evenodd"
    />
  </svg>
);

interface HelpTooltipProps {
  /** Help text shown in the tooltip */
  content: string;
  /** Placement of tooltip relative to trigger */
  side?: TooltipSide;
  /** Custom trigger element (e.g. label). When omitted, uses a small info icon. Must accept ref and be focusable. */
  children?: React.ReactNode;
}

export function HelpTooltip({
  content,
  side = "top",
  children,
}: HelpTooltipProps) {
  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded text-content-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-1"
      aria-label="Help"
    >
      <InfoIcon />
    </button>
  );

  const trigger = children ?? defaultTrigger;

  return (
    <TooltipPrimitive.TooltipProvider delayDuration={400}>
      <TooltipPrimitive.Tooltip>
        <TooltipPrimitive.TooltipTrigger asChild>
          {trigger}
        </TooltipPrimitive.TooltipTrigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-md bg-content px-3 py-2 text-sm text-background shadow-md"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Tooltip>
    </TooltipPrimitive.TooltipProvider>
  );
}
