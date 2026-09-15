"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageHeaderProvider } from "@/components/layout/page-header-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <TooltipProvider delayDuration={200}>
        <PageHeaderProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
          </div>
        </PageHeaderProvider>
      </TooltipProvider>
    </ProtectedRoute>
  );
}
