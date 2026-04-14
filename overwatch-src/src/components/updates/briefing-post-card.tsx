"use client";

import { useState } from "react";
import { Loader2, Pin, PinOff, Trash2, ThumbsUp, MessageCircle, Send, Radar, Megaphone, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";
import { MediaEmbed, ContentWithEmbeds } from "./media-embed";
import { getPostComments, getPostReactions, togglePostReaction, addPostComment, deletePostComment } from "@/lib/supabase/db";

const POST_TYPES = [
  { value: "update", label: "Update", icon: Radar, color: "text-blue-500" },
  { value: "announcement", label: "Announcement", icon: Megaphone, color: "text-violet-500" },
  { value: "alert", label: "Alert", icon: AlertTriangle, color: "text-amber-500" },
];

interface PostReaction {
  id: string;
  emoji?: string;
  users?: { id?: string; first_name?: string; last_name?: string };
}

interface PostComment {
  id: string;
  content: string;
  created_at: string;
  users?: { id?: string; first_name?: string; last_name?: string; avatar_url?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

interface BriefingPostCardProps {
  post: Post;
  isAdmin: boolean;
  currentUserId?: string;
  currentUserAvatarUrl?: string;
  currentUserInitials: string;
  initialReactions: PostReaction[];
  initialComments: PostComment[];
  togglingPin: string | null;
  deleting: string | null;
  onTogglePin: (postId: string, currentlyPinned: boolean) => void;
  onDelete: (postId: string) => void;
}

export function BriefingPostCard({
  post,
  isAdmin,
  currentUserId,
  currentUserAvatarUrl,
  currentUserInitials,
  initialReactions,
  initialComments,
  togglingPin,
  deleting,
  onTogglePin,
  onDelete,
}: BriefingPostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [togglingReaction, setTogglingReaction] = useState(false);
  const [reactions, setReactions] = useState<PostReaction[]>(initialReactions);
  const [comments, setComments] = useState<PostComment[]>(initialComments);

  const author = post.users;
  const pi = (author?.first_name?.[0] ?? "") + (author?.last_name?.[0] ?? "");
  const typeInfo = POST_TYPES.find((t) => t.value === post.type) ?? POST_TYPES[0];
  const allUrls: string[] = [];
  if (post.image_url) allUrls.push(post.image_url);
  if (post.link_url) allUrls.push(post.link_url);

  async function toggleComments() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    setCommentText("");
    try {
      const [c, r] = await Promise.all([getPostComments(post.id), getPostReactions(post.id)]);
      setComments(c);
      setReactions(r);
    } catch {}
  }

  async function handleReaction() {
    setTogglingReaction(true);
    try {
      await togglePostReaction(post.id, "like");
      const r = await getPostReactions(post.id);
      setReactions(r);
    } catch (err) { console.error(err); }
    finally { setTogglingReaction(false); }
  }

  async function handleSendComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await addPostComment(post.id, commentText.trim());
      setCommentText("");
      const c = await getPostComments(post.id);
      setComments(c);
    } catch (err) { console.error(err); }
    finally { setSendingComment(false); }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deletePostComment(commentId);
      const c = await getPostComments(post.id);
      setComments(c);
    } catch (err) { console.error(err); }
  }

  return (
    <article
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
          <AvatarImage src={author?.avatar_url ?? undefined} />
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
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onTogglePin(post.id, post.is_pinned)}
              disabled={togglingPin === post.id}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
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
            <button
              onClick={() => onDelete(post.id)}
              disabled={deleting === post.id}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete post"
            >
              {deleting === post.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Post body */}
      <div className="px-4 pb-2 pl-[60px]">
        {post.title && (
          <h3 className="mt-1 text-base font-bold leading-tight">{post.title}</h3>
        )}
        <ContentWithEmbeds text={post.content} />
        {allUrls.map((url) => (
          <MediaEmbed key={url} url={url} />
        ))}
      </div>

      {/* Reaction + Comment bar */}
      <div className="flex items-center gap-1 border-t border-border/30 px-4 py-1.5 pl-[60px]">
        <button
          onClick={handleReaction}
          disabled={togglingReaction}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${
            reactions.some((r) => r.users?.id === currentUserId)
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {reactions.length > 0 && <span>{reactions.length}</span>}
        </button>
        <button
          onClick={toggleComments}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${
            expanded ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {comments.length > 0 && <span>{comments.length}</span>}
          <span className="hidden sm:inline">Comment</span>
        </button>
      </div>

      {/* Expanded comments */}
      {expanded && (
        <div className="border-t border-border/30 bg-muted/20 px-4 py-3 pl-[60px] space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={c.users?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-[8px] font-bold text-primary">
                  {(c.users?.first_name?.[0] ?? "")}{(c.users?.last_name?.[0] ?? "")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="rounded-lg bg-card border border-border/40 px-3 py-1.5">
                  <span className="text-xs font-semibold">{c.users?.first_name} {c.users?.last_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(c.created_at)}</span>
                  <p className="text-xs text-foreground/90 mt-0.5">{c.content}</p>
                </div>
              </div>
              {c.users?.id === currentUserId && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity self-center"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {/* Comment input */}
          <div className="flex gap-2 items-center">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={currentUserAvatarUrl} />
              <AvatarFallback className="bg-primary/10 text-[8px] font-bold text-primary">
                {currentUserInitials}
              </AvatarFallback>
            </Avatar>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
              placeholder="Write a comment..."
              className="flex-1 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={handleSendComment}
              disabled={!commentText.trim() || sendingComment}
              className="rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {sendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
