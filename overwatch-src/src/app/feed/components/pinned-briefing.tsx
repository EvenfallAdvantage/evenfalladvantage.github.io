"use client";

import { useState, useEffect, useCallback } from "react";
import { timeAgo } from "@/lib/utils";
import { ChevronRight, ThumbsUp, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getPosts, getPostReactions, togglePostReaction,
  getPostComments, addPostComment,
} from "@/lib/supabase/db";
import type { Post } from "./shared";
import { logger } from "@/lib/logger";

interface PinnedBriefingProps {
  activeCompanyId: string;
  userId?: string;
}

export function PinnedBriefing({ activeCompanyId, userId }: PinnedBriefingProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [postReactions, setPostReactions] = useState<Record<string, any[]>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [togglingReaction, setTogglingReaction] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const p = await getPosts(activeCompanyId, 5);
      setPosts(p);
    } catch (e) { logger.swallow("pinned-briefing:load-posts", e, "warn"); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleReaction(postId: string) {
    setTogglingReaction(postId);
    try {
      await togglePostReaction(postId, "like");
      const r = await getPostReactions(postId);
      setPostReactions((prev) => ({ ...prev, [postId]: r }));
    } catch (err) { console.error(err); }
    finally { setTogglingReaction(null); }
  }

  async function toggleCommentSection(postId: string) {
    if (expandedPostId === postId) { setExpandedPostId(null); return; }
    setExpandedPostId(postId);
    setCommentText("");
    try {
      const [c, r] = await Promise.all([getPostComments(postId), getPostReactions(postId)]);
      setPostComments((prev) => ({ ...prev, [postId]: c }));
      setPostReactions((prev) => ({ ...prev, [postId]: r }));
    } catch (e) { logger.swallow("pinned-briefing:load-engagement", e, "debug"); }
  }

  async function handleSendComment(postId: string) {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await addPostComment(postId, commentText.trim());
      const c = await getPostComments(postId);
      setPostComments((prev) => ({ ...prev, [postId]: c }));
      setCommentText("");
    } catch (err) { console.error(err); }
    finally { setSendingComment(false); }
  }

  const pinnedPosts = posts.filter((p: Post) => p.is_pinned);
  if (pinnedPosts.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Pinned Briefing
        </h2>
        <Link href="/updates" className="flex items-center gap-1 text-xs text-primary hover:underline">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {pinnedPosts.map((post: Post) => {
          const author = post.users;
          const rxns = postReactions[post.id] ?? [];
          const cmts = postComments[post.id] ?? [];
          const userLiked = rxns.some((r: { users?: { id?: string } }) => r.users?.id === userId);
          return (
            <div key={post.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={author?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-amber-500/15 text-[10px] font-bold text-amber-600">
                    {(author?.first_name?.[0] ?? "")}{(author?.last_name?.[0] ?? "")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{author?.first_name} {author?.last_name}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">PINNED</span>
                  </div>
                  {post.title && <p className="mt-0.5 text-sm font-semibold">{post.title}</p>}
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 border-t border-amber-500/20 px-3 py-1.5">
                <button onClick={() => handleReaction(post.id)} disabled={togglingReaction === post.id}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${userLiked ? "text-primary" : "text-muted-foreground"}`}>
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {rxns.length > 0 && <span>{rxns.length}</span>}
                </button>
                <button onClick={() => toggleCommentSection(post.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${expandedPostId === post.id ? "text-primary" : "text-muted-foreground"}`}>
                  <MessageCircle className="h-3.5 w-3.5" /> Comment
                  {cmts.length > 0 && <span className="ml-0.5">({cmts.length})</span>}
                </button>
              </div>
              {expandedPostId === post.id && (
                <div className="border-t border-amber-500/20 px-3 py-2 space-y-2">
                  {cmts.map((cm: { id: string; content: string; created_at: string; users?: { first_name?: string; last_name?: string; avatar_url?: string } }) => (
                    <div key={cm.id} className="flex items-start gap-2 text-xs">
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={cm.users?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-[8px] font-bold text-primary">
                          {(cm.users?.first_name?.[0] ?? "")}{(cm.users?.last_name?.[0] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{cm.users?.first_name} {cm.users?.last_name}</span>
                        <span className="ml-1.5 text-muted-foreground">{cm.content}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..."
                      onKeyDown={(e) => e.key === "Enter" && handleSendComment(post.id)}
                      className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50" />
                    <button onClick={() => handleSendComment(post.id)} disabled={sendingComment || !commentText.trim()}
                      className="rounded-md p-1 text-primary hover:bg-primary/10 disabled:opacity-40" aria-label="Send comment">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
