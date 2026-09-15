"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { LoadingState } from "@/components/common/loading-state";

export default function RootPage() {
  const { inspector, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(inspector ? "/dashboard" : "/login");
  }, [isLoading, inspector, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingState label="Loading ThinkSphere…" />
    </div>
  );
}
