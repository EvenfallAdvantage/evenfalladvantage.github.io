"use client";

import { useSyncExternalStore } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Type } from "lucide-react";
import { getFieldMode, setFieldMode, subscribeFieldMode } from "@/lib/field-mode";

/** Profile → Display: large text / field mode toggle (this device). */
export function DisplayCard() {
  const on = useSyncExternalStore(subscribeFieldMode, getFieldMode, () => false);
  return (
    <Card data-testid="display-card">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Type className="h-4 w-4" /> Display</CardTitle></CardHeader>
      <CardContent>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Large text (field mode)</span>
            <span className="block text-xs text-muted-foreground">Bigger, higher-contrast text for sunlight and gloves. This device only.</span>
          </span>
          <Switch checked={on} onCheckedChange={(v: boolean) => setFieldMode(v)} aria-label="Large text (field mode)" data-testid="field-mode-toggle" />
        </label>
      </CardContent>
    </Card>
  );
}
