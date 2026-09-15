"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderState {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

interface PageHeaderContextValue {
  header: PageHeaderState | null;
  setHeader: (state: PageHeaderState | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderContext(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderContext must be used within PageHeaderProvider");
  return ctx;
}

/** Lets a page declare its header title/breadcrumbs, including for dynamic routes. */
export function usePageHeader(title: string, breadcrumbs?: Breadcrumb[]) {
  const { setHeader } = usePageHeaderContext();
  const breadcrumbKey = breadcrumbs?.map((b) => `${b.label}:${b.href ?? ""}`).join("|");

  useEffect(() => {
    setHeader({ title, breadcrumbs });
    return () => setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, breadcrumbKey]);
}
