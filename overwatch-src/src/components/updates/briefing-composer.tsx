"use client";

import { useState } from "react";
import { Send, Loader2, ImageIcon, Link2, X, ChevronDown, Radar, Megaphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { isImageUrl, getYouTubeId, getVimeoId } from "./media-embed";

const POST_TYPES = [
  { value: "update", label: "Update", icon: Radar, color: "text-blue-500" },
  { value: "announcement", label: "Announcement", icon: Megaphone, color: "text-violet-500" },
  { value: "alert", label: "Alert", icon: AlertTriangle, color: "text-amber-500" },
];

interface BriefingComposerProps {
  userAvatarUrl?: string;
  userInitials: string;
  posting: boolean;
  onPost: (data: { title: string; content: string; imageUrl: string; linkUrl: string; postType: string }) => void;
}

export function BriefingComposer({ userAvatarUrl, userInitials, posting, onPost }: BriefingComposerProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [postType, setPostType] = useState("update");
  const [showAttach, setShowAttach] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const activeType = POST_TYPES.find((t) => t.value === postType) ?? POST_TYPES[0];

  function handlePublish() {
    if (!content.trim()) return;
    onPost({ title, content, imageUrl, linkUrl, postType });
    setContent(""); setTitle(""); setImageUrl(""); setLinkUrl("");
    setPostType("update"); setShowAttach(false);
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={userAvatarUrl} />
            <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline (optional)"
              className="border-none bg-transparent px-0 text-base font-semibold placeholder:text-muted-foreground/40 focus-visible:ring-0 h-auto py-0"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your briefing... (paste URLs to auto-embed images, YouTube, or links)"
              className="w-full resize-none rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20 min-h-[100px]"
              rows={4}
            />
          </div>
        </div>

        {/* Attachment fields */}
        {showAttach && (
          <div className="ml-12 space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (jpg, png, gif, webp...)"
                className="flex-1 h-8 text-xs"
              />
              {imageUrl && (
                <button onClick={() => setImageUrl("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Link URL (YouTube, Vimeo, or any webpage)"
                className="flex-1 h-8 text-xs"
              />
              {linkUrl && (
                <button onClick={() => setLinkUrl("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Preview */}
            {imageUrl && isImageUrl(imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Preview" className="mt-1 max-h-32 rounded-lg border border-border/40 object-cover" />
            )}
            {linkUrl && getYouTubeId(linkUrl) && (
              <p className="text-[10px] text-green-500 font-medium">✓ YouTube video detected — will embed</p>
            )}
            {linkUrl && getVimeoId(linkUrl) && (
              <p className="text-[10px] text-green-500 font-medium">✓ Vimeo video detected — will embed</p>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2">
        <div className="flex items-center gap-1">
          {/* Post type selector */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <activeType.icon className={`h-3.5 w-3.5 ${activeType.color}`} />
              {activeType.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showTypeMenu && (
              <div className="absolute left-0 bottom-full z-10 mb-1 min-w-[160px] rounded-lg border border-border/50 bg-card p-1 shadow-xl">
                {POST_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => { setPostType(t.value); setShowTypeMenu(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${postType === t.value ? "bg-accent" : ""}`}
                  >
                    <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAttach(!showAttach)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${showAttach ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Attach
          </button>
        </div>

        <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={handlePublish} disabled={!content.trim() || posting}>
          {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
