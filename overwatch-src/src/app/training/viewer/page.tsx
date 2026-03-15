"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ChevronLeft, CheckCircle2, Clock,
  FileText, Loader2, GraduationCap, Volume2, VolumeX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  getTrainingModule, getModuleSlides, upsertModuleProgress, completeModule,
} from "@/lib/supabase/db";
import type { TrainingModule, ModuleSlide } from "@/types";

export default function ModuleViewerPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    }>
      <ModuleViewerInner />
    </Suspense>
  );
}

function ModuleViewerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = searchParams.get("id") ?? "";

  const [mod, setMod] = useState<TrainingModule | null>(null);
  const [slides, setSlides] = useState<ModuleSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    if (!moduleId) { setLoading(false); return; }
    try {
      const [moduleData, slideData] = await Promise.all([
        getTrainingModule(moduleId),
        getModuleSlides(moduleId),
      ]);
      setMod(moduleData as TrainingModule | null);
      setSlides(slideData as ModuleSlide[]);
    } catch (err) {
      console.error("Failed to load module:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => { load(); }, [load]);

  // Save progress whenever slide changes
  useEffect(() => {
    if (slides.length === 0 || loading || !moduleId) return;
    const timeout = setTimeout(() => {
      upsertModuleProgress(moduleId, {
        currentSlide,
        totalSlides: slides.length,
      }).catch(console.error);
    }, 500);
    return () => clearTimeout(timeout);
  }, [currentSlide, slides.length, moduleId, loading]);

  // Handle audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
    const slide = slides[currentSlide];
    if (slide?.audio_url) {
      audioRef.current = new Audio(slide.audio_url);
      audioRef.current.onended = () => setAudioPlaying(false);
    } else {
      audioRef.current = null;
    }
  }, [currentSlide, slides]);

  function toggleAudio() {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.play();
      setAudioPlaying(true);
    }
  }

  function goToSlide(index: number) {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }

  function handlePrev() { goToSlide(currentSlide - 1); }
  function handleNext() { goToSlide(currentSlide + 1); }

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeModule(moduleId);
      setCompleted(true);
    } catch (err) {
      console.error("Failed to complete module:", err);
    } finally {
      setCompleting(false);
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!mod) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold">Module Not Found</h2>
          <Button variant="outline" onClick={() => router.push("/training")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Training
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;
  const progress = slides.length > 0
    ? Math.round(((currentSlide + 1) / slides.length) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/training")} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight truncate">{mod.module_name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {mod.duration_minutes}m
              <span className="text-border">·</span>
              <FileText className="h-3 w-3" /> {slides.length} slides
            </div>
          </div>
          {completed && (
            <Badge className="bg-green-500/15 text-green-600 text-xs gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Slide {currentSlide + 1} of {slides.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Slide dots */}
        {slides.length > 0 && slides.length <= 30 && (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide
                    ? "w-6 bg-primary"
                    : i < currentSlide
                    ? "w-2 bg-primary/40"
                    : "w-2 bg-border/60"
                }`}
                title={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Slide content */}
        {slides.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30" />
              <h3 className="text-sm font-semibold">No Slides Yet</h3>
              <p className="text-xs text-muted-foreground">
                This module doesn&apos;t have any content yet. Check back later.
              </p>
            </CardContent>
          </Card>
        ) : slide ? (
          <Card className="border-border/40 overflow-hidden">
            <CardContent className="p-0">
              {/* Slide header */}
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5 bg-muted/30">
                <h2 className="text-sm font-semibold">{slide.title}</h2>
                {slide.audio_url && (
                  <Button size="sm" variant="ghost" onClick={toggleAudio} className="gap-1 h-7 text-xs">
                    {audioPlaying ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {audioPlaying ? "Pause" : "Play Audio"}
                  </Button>
                )}
              </div>

              {/* Slide image */}
              {slide.image_url && (
                <div className="border-b border-border/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image_url}
                    alt={slide.title}
                    className="w-full max-h-64 object-contain bg-black/5"
                  />
                </div>
              )}

              {/* Slide body */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none px-6 py-6"
                dangerouslySetInnerHTML={{ __html: slide.content_html }}
              />
            </CardContent>
          </Card>
        ) : null}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>

          <div className="flex-1" />

          {isLastSlide && !completed ? (
            <Button
              onClick={handleComplete}
              disabled={completing}
              className="gap-1 bg-green-600 hover:bg-green-700"
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Complete Module
            </Button>
          ) : isLastSlide && completed ? (
            <Button variant="outline" onClick={() => router.push("/training")} className="gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Back to Training
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
