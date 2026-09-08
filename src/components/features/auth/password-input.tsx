"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: React.Ref<HTMLInputElement>;
};

export function PasswordInput({ className, ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        {...(ref ? { ref } : {})}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
