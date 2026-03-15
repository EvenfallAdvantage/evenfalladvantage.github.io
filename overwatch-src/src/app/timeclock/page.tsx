"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, LogIn, LogOut, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  getActiveTimesheet,
  clockIn,
  clockOut,
  getRecentTimesheets,
} from "@/lib/supabase/db";

function formatDuration(ms: number) {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function calcHours(clockInISO: string, clockOutISO: string) {
  const ms = new Date(clockOutISO).getTime() - new Date(clockInISO).getTime();
  return (ms / 3600000).toFixed(2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Timesheet = any;

export default function TimeClockPage() {
  const [active, setActive] = useState<Timesheet | null>(null);
  const [recent, setRecent] = useState<Timesheet[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(),
        getRecentTimesheets(8),
      ]);
      setActive(ts);
      setRecent(history.filter((t: Timesheet) => t.clock_out));
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live elapsed timer
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Date.now() - new Date(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  async function handleClockIn() {
    setActing(true);
    try {
      await clockIn();
      await load();
    } catch (err) {
      console.error("Clock in failed:", err);
    } finally {
      setActing(false);
    }
  }

  async function handleClockOut() {
    if (!active) return;
    setActing(true);
    try {
      await clockOut(active.id);
      await load();
    } catch (err) {
      console.error("Clock out failed:", err);
    } finally {
      setActing(false);
    }
  }

  const isClockedIn = !!active;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Watch Log</h1>
          <p className="text-sm text-muted-foreground">
            Clock in/out and track your duty hours
          </p>
        </div>

        {/* Clock Widget */}
        <Card
          className={
            isClockedIn
              ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent"
              : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
          }
        >
          <CardContent className="flex flex-col items-center py-8">
            <div
              className={`mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 ${
                isClockedIn
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-primary/20 bg-primary/10"
              }`}
            >
              {loading ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : (
                <Clock
                  className={`h-10 w-10 ${
                    isClockedIn ? "text-green-500" : "text-primary"
                  }`}
                />
              )}
            </div>

            <p className="mb-1 text-sm text-muted-foreground">
              {isClockedIn ? "On duty since" : "Status"}
            </p>

            {isClockedIn ? (
              <>
                <p className="text-sm font-medium text-green-600">
                  {formatTime(active.clock_in)}
                </p>
                <p className="my-2 font-mono text-3xl font-bold tracking-wider text-green-600">
                  {formatDuration(elapsed)}
                </p>
              </>
            ) : (
              <p className="mb-3 text-2xl font-bold text-muted-foreground">
                Off Duty
              </p>
            )}

            {!loading && (
              <Button
                size="lg"
                className={`mt-2 gap-2 px-10 ${
                  isClockedIn
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                onClick={isClockedIn ? handleClockOut : handleClockIn}
                disabled={acting}
              >
                {acting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isClockedIn ? (
                  <LogOut className="h-5 w-5" />
                ) : (
                  <LogIn className="h-5 w-5" />
                )}
                {isClockedIn ? "Clock Out" : "Clock In"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent History */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="h-4 w-4" />
            Recent Watch Log
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed shifts yet. Clock in to start logging hours.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((ts: Timesheet) => (
                <div
                  key={ts.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground font-medium">
                      {formatDate(ts.clock_in)}
                    </div>
                    <div className="text-sm">
                      {formatTime(ts.clock_in)} → {formatTime(ts.clock_out)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {calcHours(ts.clock_in, ts.clock_out)}h
                    </span>
                    <Badge
                      variant={ts.approved ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {ts.approved ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
