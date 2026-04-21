"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus, Loader2, Save, X, Pencil, Trash2, FileText, Image as ImageIcon, Type, Video,
} from "lucide-react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getLegacySlides, createLegacySlide, updateLegacySlide, deleteLegacySlide,
  type LegacySlide,
} from "@/lib/legacy-bridge";
import { sanitizeHtml } from "@/lib/security";
import { logger } from "@/lib/logger";

const SLIDE_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "mixed", label: "Mixed", icon: FileText },
];

interface SlidesPanelProps {
  moduleId: string;
}

export function SlidesPanel({ moduleId }: SlidesPanelProps) {
  const [slides, setSlides] = useState<LegacySlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [editSlide, setEditSlide] = useState<LegacySlide | null>(null);
  const [previewSlide, setPreviewSlide] = useState<LegacySlide | null>(null);

  // New slide state
  const [showNewSlide, setShowNewSlide] = useState(false);
  const [nsTitle, setNsTitle] = useState("");
  const [nsContent, setNsContent] = useState("");
  const [nsType, setNsType] = useState("text");
  const [nsImage, setNsImage] = useState("");
  const [savingSlide, setSavingSlide] = useState(false);

  // Edit slide state
  const [esTitle, setEsTitle] = useState("");
  const [esContent, setEsContent] = useState("");
  const [esType, setEsType] = useState("text");
  const [esImage, setEsImage] = useState("");
  const [savingSlideEdit, setSavingSlideEdit] = useState(false);

  const loadSlides = useCallback(async () => {
    setSlidesLoading(true);
    try { setSlides(await getLegacySlides(moduleId)); } catch (e) { logger.swallow("instructor-slides:load", e, "warn"); }
    finally { setSlidesLoading(false); }
  }, [moduleId]);

  useEffect(() => { loadSlides(); }, [loadSlides]);

  function startEditSlide(s: LegacySlide) {
    setEditSlide(s); setPreviewSlide(null);
    setEsTitle(s.title || ""); setEsContent(s.content || ""); setEsType(s.slide_type || "text"); setEsImage(s.image_url || "");
  }

  async function handleCreateSlide() {
    if (!nsTitle.trim()) return; setSavingSlide(true);
    try {
      await createLegacySlide({ module_id: moduleId, title: nsTitle.trim(), content_html: nsContent.trim() || undefined, slide_number: slides.length + 1, slide_type: nsType || "text", image_url: nsImage.trim() || undefined });
      setShowNewSlide(false); setNsTitle(""); setNsContent(""); setNsType("text"); setNsImage("");
      setSlides(await getLegacySlides(moduleId));
    } catch { alert("Failed to create slide"); } finally { setSavingSlide(false); }
  }

  async function handleUpdateSlide() {
    if (!editSlide) return; setSavingSlideEdit(true);
    try {
      await updateLegacySlide(editSlide.id, { title: esTitle.trim(), content_html: esContent, slide_type: esType, image_url: esImage.trim() || undefined });
      setEditSlide(null); setSlides(await getLegacySlides(moduleId));
    } catch { alert("Failed to update slide"); } finally { setSavingSlideEdit(false); }
  }

  async function handleDeleteSlide(slideId: string) {
    if (!confirm("Delete this slide?")) return;
    await deleteLegacySlide(slideId); if (editSlide?.id === slideId) setEditSlide(null);
    setSlides(await getLegacySlides(moduleId));
  }

  return (
    <div className="border-t border-border/20 px-3 py-2.5 ml-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Slides</span>
        <Button size="sm" variant="outline" className="gap-1 text-[10px] h-6 px-2" onClick={() => { setShowNewSlide(true); setEditSlide(null); setPreviewSlide(null); }}><Plus className="h-2.5 w-2.5" /> Add Slide</Button>
      </div>
      {slidesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : (
        <div className="space-y-1">
          {slides.map((s) => (
            <div key={s.id} className={`flex items-center gap-2 rounded border px-2.5 py-1 text-xs cursor-pointer transition-colors ${editSlide?.id === s.id ? "border-[#dd8c33]/50 bg-[#dd8c33]/5" : previewSlide?.id === s.id ? "border-primary/30 bg-primary/5" : "border-border/30 hover:border-border/60"}`}>
              <span className="font-mono text-muted-foreground w-5">{s.slide_number}.</span>
              <span className="flex-1 truncate" onClick={() => { setPreviewSlide(previewSlide?.id === s.id ? null : s); setEditSlide(null); }}>{s.title}</span>
              <div className="flex items-center gap-0.5">
                {s.slide_type && s.slide_type !== "text" && <Badge className="text-[8px] h-4 px-1">{s.slide_type}</Badge>}
                <button onClick={() => startEditSlide(s)} className="p-0.5 text-muted-foreground/50 hover:text-[#dd8c33]"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => handleDeleteSlide(s.id)} className="p-0.5 text-muted-foreground/50 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
          {slides.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-1">No slides yet</p>}
        </div>
      )}
      {previewSlide && !editSlide && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h6 className="text-xs font-semibold">{previewSlide.title}</h6>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => startEditSlide(previewSlide)}><Pencil className="h-2.5 w-2.5" /> Edit</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setPreviewSlide(null)}><X className="h-2.5 w-2.5" /></Button>
            </div>
          </div>
          {previewSlide.image_url && <NextImage src={previewSlide.image_url} alt="Slide preview" className="rounded max-h-40 object-contain" width={400} height={160} unoptimized />}
          {previewSlide.content ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewSlide.content) }} />
          ) : <p className="text-[10px] text-muted-foreground italic">No content</p>}
        </div>
      )}
      {editSlide && (
        <div className="rounded-lg border border-[#dd8c33]/30 bg-[#dd8c33]/5 p-3 space-y-2">
          <h6 className="text-[10px] font-semibold uppercase text-[#dd8c33]">Edit Slide #{editSlide.slide_number}</h6>
          <Input value={esTitle} onChange={(e) => setEsTitle(e.target.value)} placeholder="Slide Title" className="h-8 text-sm" />
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t) => (
              <button key={t.value} onClick={() => setEsType(t.value)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] border transition-colors ${esType === t.value ? "border-[#dd8c33] bg-[#dd8c33]/10 text-[#dd8c33]" : "border-border/30 text-muted-foreground hover:border-border/60"}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
          {(esType === "image" || esType === "mixed") && <Input value={esImage} onChange={(e) => setEsImage(e.target.value)} placeholder="Image URL" className="h-8 text-sm" />}
          <textarea value={esContent} onChange={(e) => setEsContent(e.target.value)} placeholder="HTML content" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleUpdateSlide} disabled={savingSlideEdit}>{savingSlideEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditSlide(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {showNewSlide && !editSlide && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <h6 className="text-[10px] font-semibold uppercase text-primary">New Slide</h6>
          <Input value={nsTitle} onChange={(e) => setNsTitle(e.target.value)} placeholder="Slide Title *" className="h-8 text-sm" />
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t) => (
              <button key={t.value} onClick={() => setNsType(t.value)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] border transition-colors ${nsType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border/60"}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
          {(nsType === "image" || nsType === "mixed") && <Input value={nsImage} onChange={(e) => setNsImage(e.target.value)} placeholder="Image URL" className="h-8 text-sm" />}
          <textarea value={nsContent} onChange={(e) => setNsContent(e.target.value)} placeholder="HTML content" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[60px]" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleCreateSlide} disabled={savingSlide}>{savingSlide ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewSlide(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
