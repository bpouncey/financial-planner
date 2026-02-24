"use client";

import { Label } from "@/components/ui/label";
import { HelpTooltip } from "./help-tooltip";

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
        <Label htmlFor={id} className="text-muted-foreground">
          {label}
        </Label>
        <HelpTooltip content={helpContent} side="top" />
      </div>
      {children}
    </div>
  );
}
