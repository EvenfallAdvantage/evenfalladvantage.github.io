"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  hasFamilyWatchdogKey, setFamilyWatchdogKey, getFamilyWatchdogKey,
  hasCrimeometerKey, setCrimeometerKey, getCrimeometerKey,
} from "@/lib/crime-incidents";

export function ApiKeyConfig() {
  const [fwKeyInput, setFwKeyInput] = useState("");
  const [showFwKey, setShowFwKey] = useState(false);
  const [fwKeyConfigured, setFwKeyConfigured] = useState(false);
  const [cmKeyInput, setCmKeyInput] = useState("");
  const [showCmKey, setShowCmKey] = useState(false);
  const [cmKeyConfigured, setCmKeyConfigured] = useState(false);

  useEffect(() => {
    setFwKeyConfigured(hasFamilyWatchdogKey());
    setFwKeyInput(getFamilyWatchdogKey());
    setCmKeyConfigured(hasCrimeometerKey());
    setCmKeyInput(getCrimeometerKey());
  }, []);

  return (
    <>
      {/* Family Watchdog API Key Config */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" /> Sex Offender Overlay
            {fwKeyConfigured && <Badge variant="outline" className="text-[9px] ml-1 text-green-500 border-green-500/30">Active</Badge>}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            To display registered sex offenders on the map, enter your{" "}
            <a href="https://www.familywatchdog.us/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Family Watchdog API key
            </a>
            . Keys start at $75 for 500 lookups. Without a key, use the free NSOPW Registry link on the results page.
          </p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFamilyWatchdogKey(fwKeyInput.trim()); setFwKeyConfigured(!!fwKeyInput.trim()); }}>
            <div className="relative flex-1">
              <Input
                type={showFwKey ? "text" : "password"}
                placeholder="Enter API key..."
                value={fwKeyInput}
                onChange={(e) => setFwKeyInput(e.target.value)}
                className="h-8 text-xs pr-8"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowFwKey(!showFwKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showFwKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8" type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      {/* Crimeometer API Key Config */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" /> Crimeometer (National)
            {cmKeyConfigured && <Badge variant="outline" className="text-[9px] ml-1 text-green-500 border-green-500/30">Active</Badge>}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            For nationwide geocoded crime data (fills gaps where city open data isn&apos;t available), enter your{" "}
            <a href="https://www.crimeometer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Crimeometer API key
            </a>
            . Free tier: 100 calls/month. Without a key, Socrata + OpenDataSoft + ArcGIS are used (all free).
          </p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCrimeometerKey(cmKeyInput.trim()); setCmKeyConfigured(!!cmKeyInput.trim()); }}>
            <div className="relative flex-1">
              <Input
                type={showCmKey ? "text" : "password"}
                placeholder="Enter API key..."
                value={cmKeyInput}
                onChange={(e) => setCmKeyInput(e.target.value)}
                className="h-8 text-xs pr-8"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowCmKey(!showCmKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8" type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
