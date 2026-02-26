"use client";

import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface StepperInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** When set, display value is value * factor (e.g. 100 for %). onChange receives raw value. */
  displayFactor?: number;
}

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  displayFactor = 1,
  className,
  id,
  ...inputProps
}: StepperInputProps) {
  const displayValue = value * displayFactor;
  const displayMin = min * displayFactor;
  const displayMax = max * displayFactor;
  const displayStep = step * displayFactor;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    const raw = Number.isNaN(v) ? min : v / displayFactor;
    onChange(Math.max(min, Math.min(max, raw)));
  };

  const handleStep = (delta: number) => {
    const newVal = Math.max(min, Math.min(max, value + delta));
    onChange(newVal);
  };

  const inputVal =
    displayValue === 0 && displayMin === 0 ? "" : String(displayValue);

  return (
    <ButtonGroup className={cn("w-fit", className)}>
      <Input
        id={id}
        type="number"
        min={displayMin}
        max={displayMax}
        step={displayStep}
        value={inputVal}
        onChange={handleInputChange}
        {...inputProps}
        className={cn(
          "w-16 shrink-0 rounded-r-none border-r-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 rounded-l-none rounded-r-none"
        aria-label="Decrease"
        onClick={() => handleStep(-step)}
        disabled={value <= min}
      >
        <MinusIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 rounded-l-none"
        aria-label="Increase"
        onClick={() => handleStep(step)}
        disabled={value >= max}
      >
        <PlusIcon className="size-4" />
      </Button>
    </ButtonGroup>
  );
}
