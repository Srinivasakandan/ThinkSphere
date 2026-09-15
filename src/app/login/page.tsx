"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ScaleIcon, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth/auth-context";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isDemoMode } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const rememberMe = watch("rememberMe");

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      await login({ email: values.email, password: values.password });
      router.replace("/dashboard");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ScaleIcon className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Legal Metrology Compliance Inspection System
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspection assistance for packaged commodity compliance
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {isDemoMode && (
            <div className="mb-4 rounded-md border border-status-neutral-border bg-status-neutral-bg px-3 py-2 text-xs text-status-neutral">
              Demo mode: Supabase is not configured. Enter any email and password to continue.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="inspector@legalmetrology.gov.in"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-status-fail">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-status-fail">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => setValue("rememberMe", checked === true)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="focus-ring rounded text-primary hover:underline"
                onClick={() => alert("Password reset is not available in demo mode.")}
              >
                Forgot password?
              </button>
            </div>

            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-status-fail-border bg-status-fail-bg px-3 py-2 text-sm text-status-fail">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This system assists inspection under the Legal Metrology (Packaged
          Commodities) Rules, 2011. All findings require inspector verification.
        </p>
      </div>
    </div>
  );
}
