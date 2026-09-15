"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Bell, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "@/components/layout/sidebar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { usePageHeaderContext } from "@/components/layout/page-header-context";
import { useAuth } from "@/lib/auth/auth-context";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fallbackTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "ThinkSphere";
}

export function Header() {
  const pathname = usePathname();
  const { header } = usePageHeaderContext();
  const { inspector } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = header?.title ?? fallbackTitle(pathname);
  const breadcrumbs = header?.breadcrumbs;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-status-fail" aria-hidden="true" />
      </Button>

      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-secondary text-xs">
          {inspector ? initials(inspector.name) : "?"}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
