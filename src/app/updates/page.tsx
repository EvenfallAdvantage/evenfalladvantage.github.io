"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Radar, Send, Loader2, ImageIcon, Link2, Pin, PinOff,
  Megaphone, AlertTriangle, ChevronDown, ExternalLink, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getPosts, createPost, togglePinPost } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

// Extract YouTube video ID from various URL formats
function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

// Extract Vimeo video ID
function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

// Check if URL is a direct image
function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

// Render embedded media for a URL
function MediaEmbed({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  const vimeoId = getVimeoId(url);
  if (vimeoId) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title="Vimeo video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (isImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Attachment"
        className="mt-3 max-h-[400px] w-full rounded-xl border border-border/40 object-cover"
      />
    );
  }

  // Generic link card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <ExternalLink className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{new URL(url).hostname}</p>
        <p className="truncate text-xs text-muted-foreground">{url}</p>
      </div>
    </a>
  );
}

// Auto-detect URLs in text content and render embeds
function ContentWithEmbeds({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  const urls = text.match(urlRegex) ?? [];
  const uniqueUrls = [...new Set(urls)];

  return (
    <>
      <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{text}</p>
      {uniqueUrls.map((url) => (
        <MediaEmbed key={url} url={url} />
      ))}
    </>
  );
}

const POST_TYPES = [
  { value: "update", label: "Update", icon: Radar, color: "text-blue-500" },
  { value: "announcement", label: "Announcement", icon: Megaphone, color: "text-violet-500" },
  { value: "alert", label: "Alert", icon: AlertTriangle, color: "text-amber-500" },
];

export default function UpdatesPage() {
  const { user, activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [togglingPin, setTogglingPin] = useState<string | null>(null);

  // Composer state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [postType, setPostType] = useState("update");
  const [showAttach, setShowAttach] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setPosts(await getPosts(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!content.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setPosting(true);
    try {
      await createPost({
        companyId: activeCompanyId,
        content: content.trim(),
        title: title.trim() || undefined,
        type: postType,
        imageUrl: imageUrl.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
      });
      setContent(""); setTitle(""); setImageUrl(""); setLinkUrl("");
      setPostType("update"); setShowAttach(false);
      await load();
    } catch (err) { console.error("Post failed:", err); }
    finally { setPosting(false); }
  }

  async function handleTogglePin(postId: string, currentlyPinned: boolean) {
    setTogglingPin(postId);
    try { await togglePinPost(postId, !currentlyPinned); await load(); }
    catch (err) { console.error(err); }
    finally { setTogglingPin(null); }
  }

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");
  const activeType = POST_TYPES.find((t) => t.value === postType) ?? POST_TYPES[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">BRIEFING</h1>
          <p className="text-sm text-muted-foreground">Announcements, alerts, and team updates</p>
        </div>

        {/* Composer */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                  {initials}
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
                  <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-border/50 bg-card p-1 shadow-xl">
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

            <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={handlePost} disabled={!content.trim() || posting}>
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publish
            </Button>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Radar className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No briefings yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Publish your first update above to brief your team.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: Post) => {
              const author = post.users;
              const pi = (author?.first_name?.[0] ?? "") + (author?.last_name?.[0] ?? "");
              const typeInfo = POST_TYPES.find((t) => t.value === post.type) ?? POST_TYPES[0];
              const allUrls: string[] = [];
              if (post.image_url) allUrls.push(post.image_url);
              if (post.link_url) allUrls.push(post.link_url);

              return (
                <article
                  key={post.id}
                  className={`rounded-xl border bg-card overflow-hidden transition-all ${
                    post.is_pinned
                      ? "border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.05)]"
                      : "border-border/50"
                  } ${
                    post.type === "alert"
                      ? "border-l-4 border-l-amber-500"
                      : post.type === "announcement"
                      ? "border-l-4 border-l-violet-500"
                      : ""
                  }`}
                >
                  {/* Post header */}
                  <div className="flex items-start gap-3 p-4 pb-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-[11px] font-semibold text-primary">{pi}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{author?.first_name} {author?.last_name}</span>
                        {post.type !== "update" && (
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                            post.type === "alert" ? "bg-amber-500/15 text-amber-600" : "bg-violet-500/15 text-violet-600"
                          }`}>
                            <typeInfo.icon className="h-2.5 w-2.5 mr-0.5" />
                            {typeInfo.label}
                          </Badge>
                        )}
                        {post.is_pinned && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-600">
                            <Pin className="h-2.5 w-2.5 mr-0.5" />
                            Pinned
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleTogglePin(post.id, post.is_pinned)}
                        disabled={togglingPin === post.id}
                        className="shrink-0 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                        title={post.is_pinned ? "Unpin" : "Pin to top"}
                      >
                        {togglingPin === post.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : post.is_pinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Post body */}
                  <div className="px-4 pb-4 pl-[60px]">
                    {post.title && (
                      <h3 className="mt-1 text-base font-bold leading-tight">{post.title}</h3>
                    )}
                    <ContentWithEmbeds text={post.content} />
                    {allUrls.map((url) => (
                      <MediaEmbed key={url} url={url} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
