"use client";

import { useState } from "react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/auth-context";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function SettingsPage() {
  usePageHeader("Settings", [{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]);
  const { inspector, isDemoMode } = useAuth();
  const [notifyFindings, setNotifyFindings] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [compactTables, setCompactTables] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your inspector identity as recorded on inspections you create.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-secondary text-base">
              {inspector ? initials(inspector.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-base font-semibold text-foreground">{inspector?.name}</p>
            <p className="text-sm text-muted-foreground">{inspector?.email}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant="secondary">{inspector?.role}</Badge>
              {inspector?.badgeId && <Badge variant="outline">Badge {inspector.badgeId}</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {isDemoMode
              ? "Demo mode is active — account changes are not persisted to a backend."
              : "Manage your account credentials."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" defaultValue={inspector?.name} disabled={isDemoMode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" defaultValue={inspector?.email} disabled={isDemoMode} />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <Button disabled={isDemoMode}>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose what you want to be notified about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <Checkbox checked={notifyFindings} onCheckedChange={(c) => setNotifyFindings(c === true)} />
            <span>
              <span className="block text-sm font-medium text-foreground">Potential non-compliance findings</span>
              <span className="block text-xs text-muted-foreground">
                Get notified when a rule evaluation flags a potential issue on your inspections.
              </span>
            </span>
          </label>
          <Separator />
          <label className="flex items-start gap-3">
            <Checkbox checked={notifyDigest} onCheckedChange={(c) => setNotifyDigest(c === true)} />
            <span>
              <span className="block text-sm font-medium text-foreground">Weekly summary digest</span>
              <span className="block text-xs text-muted-foreground">
                A weekly email summarizing inspections completed and outstanding reviews.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Display preferences for this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3">
            <Checkbox checked={compactTables} onCheckedChange={(c) => setCompactTables(c === true)} />
            <span>
              <span className="block text-sm font-medium text-foreground">Compact table rows</span>
              <span className="block text-xs text-muted-foreground">
                Show more inspections per screen in history and rule tables.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
