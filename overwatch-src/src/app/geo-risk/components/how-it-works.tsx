"use client";

import { Card, CardContent } from "@/components/ui/card";

export function HowItWorks() {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-2">How It Works</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>- Enter a location and facility type to generate a risk assessment</p>
          <p>- Crime data sourced from <strong>FBI UCR 2022</strong> (city → county → state fallback)</p>
          <p>- <strong>Map overlay:</strong> crime incidents from 4 OSINT sources (Socrata, ArcGIS, Crimeometer, UK Police)</p>
          <p>- <strong>Environmental risk:</strong> Overpass/OSM queries for CPTED indicators (bars, clubs, pawn shops, etc.)</p>
          <p>- All sources queried in parallel, deduplicated by proximity + date + type</p>
          <p>- <strong>Sex offender overlay:</strong> via Family Watchdog API (optional, key required)</p>
          <p>- Risk score factors in violent crime, property crime, and facility vulnerability</p>
          <p>- Auto-generates security recommendations based on risk level</p>
          <p>- Export professional PDF reports for client proposals</p>
        </div>
      </CardContent>
    </Card>
  );
}
