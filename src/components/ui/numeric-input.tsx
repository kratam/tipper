"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface NumericInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
}

function NumericInput({
  value,
  onChange,
  allowDecimal = false,
  min,
  max,
  ...props
}: NumericInputProps) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
      value={display}
      onChange={(e) => {
        const charPattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
        let raw = e.target.value.replace(charPattern, "");

        if (allowDecimal) {
          const dotIndex = raw.indexOf(".");
          if (dotIndex !== -1) {
            raw = raw.slice(0, dotIndex + 1) + raw.slice(dotIndex + 1).replace(/\./g, "");
          }
        }

        setDisplay(raw);
        const num = Number(raw);
        if (raw !== "" && !Number.isNaN(num)) {
          onChange(num);
        }
      }}
      onBlur={() => {
        let num = Number(display);
        if (Number.isNaN(num) || display === "") {
          num = min ?? 0;
        }
        if (min !== undefined && num < min) num = min;
        if (max !== undefined && num > max) num = max;
        onChange(num);
        setDisplay(String(num));
      }}
      {...props}
    />
  );
}

export { NumericInput };
