"use client";

import { HelpTooltip } from "./help-tooltip";

const labelBase =
  "block text-sm font-medium text-content-muted";

interface FormFieldWithHelpProps {
  id: string;
  label: string;
  helpContent: string;
  children: React.ReactNode;
}

export function FormFieldWithHelp({
  id,
  label,
  helpContent,
  children,
}: FormFieldWithHelpProps) {
  return (
    <div className="space-y-1">
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={id} className={labelBase}>
          {label}
        </label>
        <HelpTooltip content={helpContent} side="top" />
      </div>
      {children}
    </div>
  );
}
