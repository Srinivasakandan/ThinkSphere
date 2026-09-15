"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScaleIcon, LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (href === "/inspections") {
    return pathname === "/inspections" || (pathname.startsWith("/inspections/") && !pathname.startsWith("/inspections/new"));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { inspector, logout } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-active text-sidebar-active-foreground">
          <ScaleIcon className="h-4.5 w-4.5" size={18} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">ThinkSphere</p>
          <p className="text-[11px] text-sidebar-foreground/70">Legal Metrology Inspection</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-active text-white">
              {inspector ? initials(inspector.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{inspector?.name ?? "Guest"}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{inspector?.role ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Log out"
            className="focus-ring rounded-md p-2 text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>
  );
}
