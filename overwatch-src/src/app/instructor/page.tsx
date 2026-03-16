"use client";

import { useState, useEffect, useRef } from "react";
import {
  Video, Copy, Users, Clock, ExternalLink,
  Mic, MicOff, VideoOff, LogOut, Check, Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

type SessionState = "setup" | "live" | "ended";

export default function InstructorPage() {
  const user = useAuthStore((s) => s.user);
  const [sessionState, setSessionState] = useState<SessionState>("setup");
  const [roomUrl, setRoomUrl] = useState("");
  const [instructorName, setInstructorName] = useState(
    user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""
  );
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionState === "live") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  function formatDuration(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function startSession() {
    if (!roomUrl.trim()) return;
    setSessionState("live");
    setDuration(0);
  }

  function endSession() {
    setSessionState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function copyStudentLink() {
    const link = requirePassword ? `${roomUrl}?password=${password}` : roomUrl;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetSession() {
    setSessionState("setup");
    setDuration(0);
    setRoomUrl("");
  }

  // ─── Session Ended ───
  if (sessionState === "ended") {
    return (
      <>
        <div className="max-w-md mx-auto space-y-4 text-center pt-12">
          <div className="h-16 w-16 rounded-full mx-auto bg-green-500/15 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold font-mono">SESSION ENDED</h2>
          <p className="text-sm text-muted-foreground">
            Session duration: <strong className="font-mono">{formatDuration(duration)}</strong>
          </p>
          <Button onClick={resetSession} className="gap-1.5">
            <Video className="h-4 w-4" /> Start New Session
          </Button>
        </div>
      </>
    );
  }

  // ─── Live Session ───
  if (sessionState === "live") {
    const studentLink = requirePassword ? `${roomUrl}?password=${password}` : roomUrl;

    return (
      <>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg font-bold font-mono">LIVE SESSION</h2>
              <Badge className="bg-red-500/15 text-red-500 text-xs font-mono">{formatDuration(duration)}</Badge>
            </div>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={endSession}>
              <LogOut className="h-3.5 w-3.5" /> End Session
            </Button>
          </div>

          {/* Video Embed */}
          <Card className="border-border/40 overflow-hidden">
            <div className="aspect-video bg-black relative">
              <iframe
                src={roomUrl}
                allow="camera; microphone; fullscreen; display-capture"
                className="w-full h-full border-0"
                title="Training Session"
              />
              {/* Controls Overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button size="sm" variant={muted ? "destructive" : "secondary"} className="h-9 w-9 p-0 rounded-full"
                  onClick={() => setMuted(!muted)}>
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant={videoOff ? "destructive" : "secondary"} className="h-9 w-9 p-0 rounded-full"
                  onClick={() => setVideoOff(!videoOff)}>
                  {videoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>

          {/* Session Info */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Instructor</p>
              <p className="text-sm font-semibold">{instructorName || "Instructor"}</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</p>
              <p className="text-sm font-semibold font-mono">{formatDuration(duration)}</p>
            </CardContent></Card>
          </div>

          {/* Student Link */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Student Join Link</p>
              <div className="flex gap-2">
                <Input readOnly value={studentLink} className="text-xs font-mono" />
                <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={copyStudentLink}>
                  {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // ─── Setup ───
  return (
    <>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <Video className="h-5 w-5 sm:h-6 sm:w-6" /> INSTRUCTOR ROOM
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Host live training sessions with video conferencing</p>
        </div>

        <Card className="border-border/40">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold mb-1 block">Room URL *</label>
              <Input placeholder="https://your-domain.daily.co/room-name" value={roomUrl}
                onChange={(e) => setRoomUrl(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Paste your Daily.co or video conference room URL</p>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block">Instructor Name</label>
              <Input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="reqPw" checked={requirePassword}
                onChange={(e) => setRequirePassword(e.target.checked)}
                className="h-4 w-4 rounded border-border" />
              <label htmlFor="reqPw" className="text-xs font-semibold">Require Password</label>
            </div>

            {requirePassword && (
              <div>
                <label className="text-xs font-semibold mb-1 block">Room Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}

            <Button className="w-full gap-1.5" onClick={startSession} disabled={!roomUrl.trim()}>
              <Video className="h-4 w-4" /> Start Session
            </Button>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Quick Start</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>1. Create a room at <a href="https://dashboard.daily.co" target="_blank" rel="noopener noreferrer" className="text-primary underline">Daily.co</a> or your video provider</p>
              <p>2. Paste the room URL above</p>
              <p>3. Click <strong>Start Session</strong> to go live</p>
              <p>4. Share the student join link with trainees</p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <a href="https://dashboard.daily.co" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3" /> Open Daily.co Dashboard
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
