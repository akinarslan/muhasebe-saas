"use client";
import { useState } from "react";
import { parseNumeric } from "@/lib/numeric";
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;
export function NumericInput({
  value,
  defaultValue,
  onChange,
  onFocus,
  name,
  min,
  max,
  ...props
}: Props) {
  const initial = String(value ?? defaultValue ?? "");
  const [edit, setEdit] = useState({
    raw: initial === "NaN" ? "" : initial,
    external: initial,
  });
  const external = String(value ?? defaultValue ?? "");
  const raw =
    value !== undefined && external !== edit.external
      ? external === "NaN"
        ? ""
        : external
      : edit.raw;
  const parsed = parseNumeric(raw);
  const invalid =
    parsed === null ||
    (min !== undefined && parsed < Number(min)) ||
    (max !== undefined && parsed > Number(max));
  return (
    <>
      <input
        {...props}
        type="text"
        role="spinbutton"
        inputMode="decimal"
        aria-valuemin={min === undefined ? undefined : Number(min)}
        aria-valuemax={max === undefined ? undefined : Number(max)}
        aria-valuenow={parsed ?? undefined}
        aria-invalid={invalid || undefined}
        value={raw}
        onFocus={(e) => {
          if (raw === "0") e.currentTarget.select();
          onFocus?.(e);
        }}
        onChange={(e) => {
          const text = e.target.value.replace(/^([+-]?)0+(?=\d)/, "$1");
          const num = parseNumeric(text);
          const normalized =
            text === "" ? "" : num === null ? "NaN" : String(num);
          setEdit({ raw: text, external: normalized });
          onChange?.({
            ...e,
            target: { ...e.target, name: name ?? "", value: normalized },
            currentTarget: {
              ...e.currentTarget,
              name: name ?? "",
              value: normalized,
            },
          } as React.ChangeEvent<HTMLInputElement>);
        }}
      />
      {name && (
        <input
          type="hidden"
          name={name}
          value={invalid ? "NaN" : String(parsed)}
        />
      )}{" "}
      {raw !== "" && invalid && (
        <small className="error">
          Geçerli bir sayı girin{min !== undefined ? ` (en az ${min})` : ""}.
        </small>
      )}
    </>
  );
}
