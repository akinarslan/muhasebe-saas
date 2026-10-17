"use client";
import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "aria-label"
> & { label: string; className?: string };
export function SearchField({ label, className = "", ...props }: Props) {
  return (
    <label className={`pusula-search ${className}`}>
      <Search size={18} aria-hidden="true" />
      <input {...props} type="text" aria-label={label} />
    </label>
  );
}
