"use client";

import { useState, useCallback } from "react";
import {
  MessageCircle, ArrowLeft, RotateCcw, CheckCircle2, XCircle,
  Zap, ChevronRight, Trophy, AlertTriangle, Heart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SCENARIOS, STATE_COLORS, type Scenario, type Step } from "@/lib/deescalation-scenarios";

type ScenarioResult = { steps: number; success: boolean; date: string };

const STORAGE_KEY = "overwatch_scenario_results";

function loadResults(): Record<string, ScenarioResult> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveResult(scenarioId: string, steps: number, success: boolean) {
  const results = loadResults();
  const existing = results[scenarioId];
  if (!existing || (success && (!existing.success || steps < existing.steps))) {
    results[scenarioId] = { steps, success, date: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  }
}

function MeterBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 75 ? "bg-red-500" : pct >= 50 ? "bg-orange-500" : pct >= 25 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">Emotional Tension</span>
        <span className="font-mono font-bold">{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-border/40 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 75 && <p className="text-[9px] text-red-500 font-medium animate-pulse">Warning: Subject is near breaking point!</p>}
    </div>
  );
}

export default function ScenariosPage() {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [currentStepId, setCurrentStepId] = useState("start");
  const [meter, setMeter] = useState(40);
  const [stepCount, setStepCount] = useState(1);
  const [ending, setEnding] = useState<Step | null>(null);
  const [results, setResults] = useState<Record<string, ScenarioResult>>(loadResults);

  const startScenario = useCallback((scenario: Scenario) => {
    setActiveScenario(scenario);
    setCurrentStepId("start");
    setMeter(scenario.initialMeter);
    setStepCount(1);
    setEnding(null);
  }, []);

  function handleChoice(next: string, meterChange: number) {
    if (!activeScenario) return;
    const newMeter = Math.max(0, Math.min(100, meter + meterChange));
    setMeter(newMeter);
    setStepCount((s) => s + 1);

    // Auto-fail at 90%+
    if (newMeter >= 90 && next !== "fail-very-angry") {
      const failStep = activeScenario.steps["fail-very-angry"];
      if (failStep) { setEnding(failStep); saveResult(activeScenario.id, stepCount + 1, false); setResults(loadResults()); return; }
    }

    const step = activeScenario.steps[next];
    if (!step) return;

    if (step.isEnding) {
      setEnding(step);
      saveResult(activeScenario.id, stepCount + 1, !!step.success);
      setResults(loadResults());
    } else {
      setCurrentStepId(next);
    }
  }

  function exitToMenu() {
    setActiveScenario(null);
    setEnding(null);
    setResults(loadResults());
  }

  // ─── Results Screen ───
  if (activeScenario && ending) {
    const success = !!ending.success;
    const stateStyle = STATE_COLORS[ending.state] || STATE_COLORS.Distressed;
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto space-y-6">
          <div className={`rounded-xl border-2 p-8 text-center ${success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
            <div className={`h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center ${success ? "bg-green-500/20" : "bg-red-500/20"}`}>
              {success ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <XCircle className="h-8 w-8 text-red-500" />}
            </div>
            <h2 className="text-xl font-bold font-mono">{success ? "DE-ESCALATION SUCCESSFUL" : "ESCALATION FAILURE"}</h2>
            <Badge className={`mt-2 ${stateStyle.bg} ${stateStyle.text}`}>{ending.state}</Badge>
          </div>

          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 italic text-sm">&ldquo;{ending.dialogue}&rdquo;</div>
              <p className="text-sm text-muted-foreground">{ending.debrief}</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Steps taken: <strong>{stepCount}</strong></span>
                <span>Final tension: <strong>{meter}%</strong></span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => startScenario(activeScenario)}>
              <RotateCcw className="h-3.5 w-3.5" /> Try Again
            </Button>
            <Button className="flex-1 gap-1.5" onClick={exitToMenu}>
              <ArrowLeft className="h-3.5 w-3.5" /> All Scenarios
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Active Scenario ───
  if (activeScenario) {
    const step = activeScenario.steps[currentStepId];
    if (!step) return null;
    const stateStyle = STATE_COLORS[step.state] || STATE_COLORS.Distressed;

    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={exitToMenu}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-bold font-mono">{activeScenario.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" /> Step {stepCount}
            </div>
          </div>

          {/* Meter */}
          <MeterBar value={meter} />

          {/* Subject State & Dialogue */}
          <Card className={`border-2 ${stateStyle.border}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${stateStyle.bg}`}>
                  {step.state === "Angry" ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
                   step.state === "Sad" ? <Heart className="h-4 w-4 text-blue-500" /> :
                   step.state === "Faded" ? <MessageCircle className="h-4 w-4 text-purple-500" /> :
                   <MessageCircle className="h-4 w-4 text-amber-500" />}
                </div>
                <div>
                  <span className="text-xs font-semibold">Subject</span>
                  <Badge className={`ml-2 text-[9px] ${stateStyle.bg} ${stateStyle.text}`}>{step.state}</Badge>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm italic">&ldquo;{step.dialogue}&rdquo;</p>
              </div>
            </CardContent>
          </Card>

          {/* Choices */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Your Response:</p>
            {step.choices?.map((choice, i) => (
              <button
                key={i}
                onClick={() => handleChoice(choice.next, choice.meterChange)}
                className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/30 transition-all group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{choice.text}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Scenario Menu ───
  const completedCount = Object.values(results).filter((r) => r.success).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" /> DE-ESCALATION
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Interactive scenario-based conflict resolution</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono">{SCENARIOS.length}</p>
            <p className="text-[10px] text-muted-foreground">Scenarios</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-green-500">{completedCount}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-muted-foreground">{SCENARIOS.length - completedCount}</p>
            <p className="text-[10px] text-muted-foreground">Remaining</p>
          </CardContent></Card>
        </div>

        {/* Scenario Cards */}
        <div className="space-y-3">
          {SCENARIOS.map((scenario) => {
            const result = results[scenario.id];
            const completed = result?.success;
            return (
              <Card key={scenario.id} className={`border-border/40 hover:border-primary/30 transition-all cursor-pointer ${completed ? "border-green-500/20" : ""}`}
                onClick={() => startScenario(scenario)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${completed ? "bg-green-500/15" : "bg-muted/50"}`}>
                      {completed ? <Trophy className="h-5 w-5 text-green-500" /> : <MessageCircle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{scenario.title}</h3>
                      <p className="text-[10px] text-muted-foreground">{scenario.description}</p>
                      {result && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {result.success ? `Best: ${result.steps} steps` : "Last attempt: failed"}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How it works */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">How It Works</h3>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <p>- Each scenario presents a tense situation with a distressed or agitated subject</p>
              <p>- Choose your response carefully — each choice affects the <strong>emotional tension meter</strong></p>
              <p>- Empathy and active listening lower tension; confrontation raises it</p>
              <p>- If tension reaches 90%+, the subject will escalate regardless of your next choice</p>
              <p>- Goal: resolve the situation peacefully in the fewest steps possible</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
