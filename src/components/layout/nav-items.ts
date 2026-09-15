import {
  LayoutDashboard,
  FilePlus2,
  ClipboardList,
  BarChart3,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Inspection", href: "/inspections/new", icon: FilePlus2 },
  { label: "Inspections", href: "/inspections", icon: ClipboardList },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Rules", href: "/rules", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
];
