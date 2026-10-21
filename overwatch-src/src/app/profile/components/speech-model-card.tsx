"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Download, Loader2, Check, Wifi } from "lucide-react";
import { getSpeechModelCacheState, predownloadSpeechModels, onMeteredConnection, type ModelCacheState } from "@/lib/speech/model-cache";

/** Profile: download the on-device dictation models ahead of time (on Wi-Fi). */
export function SpeechModelCard() {
  const [state, setState] = useState<ModelCacheState>("unknown");
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const metered = onMeteredConnection();

  useEffect(() => { getSpeechModelCacheState().then(setState); }, []);

  async function download() {
    setErr(null); setPct(0);
    try { await predownloadSpeechModels((p) => setPct(p)); setState(await getSpeechModelCacheState()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Download failed"); }
    finally { setPct(null); }
  }

  const chip = state === "ready" ? { t: "Downloaded", c: "bg-emerald-500/15 text-emerald-500" }
    : state === "partial" ? { t: "Partly downloaded", c: "bg-amber-500/15 text-amber-500" }
    : state === "missing" ? { t: "Not downloaded", c: "bg-muted text-muted-foreground" }
    : { t: "Unknown", c: "bg-muted text-muted-foreground" };

  return (
    <Card data-testid="speech-model-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4" /> Private dictation model
          <span className={`ml-auto rounded px-2 py-0.5 text-xs font-medium ${chip.c}`} data-testid="speech-model-status">{chip.t}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Dictation and speaker labels run on this device. Your audio never leaves it. The speech model (~80 MB) downloads once. Get it now on Wi-Fi so it&apos;s ready in the field.</p>
        {metered && state !== "ready" && <p className="flex items-center gap-1.5 text-amber-500"><Wifi className="h-4 w-4" /> You seem to be on cellular data.</p>}
        {err && <p className="text-red-500">{err}</p>}
        {state !== "ready" && (
          <Button className="h-11" onClick={download} disabled={pct !== null}>
            {pct !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading… {pct}%</> : <><Download className="mr-2 h-4 w-4" />Download speech model now</>}
          </Button>
        )}
        {state === "ready" && <p className="flex items-center gap-1.5 text-emerald-500"><Check className="h-4 w-4" /> Ready to use offline.</p>}
      </CardContent>
    </Card>
  );
}
