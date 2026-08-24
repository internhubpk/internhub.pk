"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { generatePassword, passwordStrength } from "@/lib/password";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  showGenerate?: boolean;
  showStrength?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

/**
 * Reusable password input for account-provisioning forms.
 *
 * - Generate button (calls generatePassword, fills the field)
 * - show/hide eye toggle
 * - live strength meter
 *
 * The generated password is only held in the parent component's state
 * long enough to be POSTed to the server; it is never persisted to the
 * application database or localStorage.
 */
export function PasswordField({
  id = "password",
  label = "Password",
  value,
  onChange,
  placeholder = "At least 8 characters",
  required = true,
  autoComplete = "new-password",
  showGenerate = true,
  showStrength = true,
  error,
  hint,
  className,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);

  const handleGenerate = useCallback(() => {
    onChange(generatePassword(16));
  }, [onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {showGenerate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Generate
            </Button>
          )}
        </div>
      )}
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={8}
          className="pr-10"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {showStrength && value && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < strength.score
                    ? strength.color === "green"
                      ? "bg-green-500"
                      : strength.color === "amber"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground w-20 text-right">{strength.label}</span>
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
