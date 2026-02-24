"use client";

import * as React from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function formatWithCommas(value: string): string {
  if (value === "" || value === "-") return value;
  const hasNegative = value.startsWith("-");
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [intPart, decPart] = cleaned.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (hasNegative ? "-" : "") + formatted + (decPart !== undefined ? "." + decPart : "");
}

interface MoneyInputProps
  extends Omit<React.ComponentProps<typeof InputGroupInput>, "type"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function MoneyInput({ className, value, onChange, ...props }: MoneyInputProps) {
  return (
    <InputGroup className={cn(className)}>
      <InputGroupInput
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="tabular-nums"
        placeholder="0.00"
        value={formatWithCommas(value)}
        onChange={onChange}
        {...props}
      />
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupText>USD</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

interface SharesInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function SharesInput({ value, onChange, ...props }: SharesInputProps) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="tabular-nums"
      value={formatWithCommas(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        onChange({
          ...e,
          target: { ...e.target, value: raw },
        } as React.ChangeEvent<HTMLInputElement>);
      }}
      {...props}
    />
  );
}

export { MoneyInput, SharesInput };
