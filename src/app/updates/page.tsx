"use client";

import { useEffect, useState, useCallback } from "react";
import { Radar, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getPosts, createPost } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UpdatesPage() {
  const { user, activeCompanyId } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") {
      setLoading(false);
      return;
    }
    try {
      const data = await getPosts(activeCompanyId);
      setPosts(data);
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!content.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setPosting(true);
    try {
      await createPost({ companyId: activeCompanyId, content: content.trim() });
      setContent("");
      await load();
    } catch (err) {
      console.error("Post failed:", err);
    } finally {
      setPosting(false);
    }
  }

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Briefing</h1>
          <p className="text-sm text-muted-foreground">
            Operational updates, alerts, and team posts
          </p>
        </div>

        {/* Compose */}
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Post an update to your team..."
                className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20 min-h-[80px]"
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={handlePost} disabled={!content.trim() || posting}>
                  {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Radar className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No briefings yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Post an update above to get your team started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post: Post) => {
              const author = post.users;
              const pi = (author?.first_name?.[0] ?? "") + (author?.last_name?.[0] ?? "");
              return (
                <div key={post.id} className="rounded-xl border border-border/50 bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-[11px] font-semibold text-primary">{pi}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{author?.first_name} {author?.last_name}</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                      </div>
                      {post.title && <h3 className="mt-1 font-semibold">{post.title}</h3>}
                      <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
