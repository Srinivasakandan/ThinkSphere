"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { LoadingState } from "@/components/common/loading-state";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { inspector, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !inspector) {
      router.replace("/login");
    }
  }, [isLoading, inspector, router]);

  if (isLoading || !inspector) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  return <>{children}</>;
}
