"use client";

import { useEffect, useState } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Radar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { getPosts, createPost, togglePinPost, deletePost, getChatChannels } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import { usePageHeader } from "@/stores/page-header-store";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getQueryClient } from "@/lib/query-client";

import { BriefingComposer } from "@/components/updates/briefing-composer";
import { BriefingPostCard } from "@/components/updates/briefing-post-card";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row shape varies by query
type Post = any;

export default function UpdatesPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { user, activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("COMMS", "Team channels, external groups, and messaging", <Radar className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  const [posting, setPosting] = useState(false);
  const [togglingPin, setTogglingPin] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  type UpdatesBundle = {
    posts: Post[];
    channelCount: number;
    externalCount: number;
    reactions: Record<string, PostReaction[]>;
    comments: Record<string, PostComment[]>;
  };

  const { data: bundle, isLoading: loading, refetch } = useCompanyQuery<UpdatesBundle>(
    "updates-feed",
    async (cid) => {
      const [postsData, channelsData] = await Promise.all([
        getPosts(cid),
        getChatChannels(cid).catch(() => []),
      ]);
      const chs = channelsData as { id: string; description?: string | null }[];
      const ext = chs.filter((c) => { try { const m = JSON.parse(c.description || ""); return m?.external; } catch { return false; } });
      const rMap: Record<string, PostReaction[]> = {};
      const cMap: Record<string, PostComment[]> = {};
      if (postsData.length > 0) {
        const { getPostReactions, getPostComments } = await import("@/lib/supabase/db");
        const [allReactions, allComments] = await Promise.all([
          Promise.all(postsData.map((p: { id: string }) => getPostReactions(p.id).catch(() => []))),
          Promise.all(postsData.map((p: { id: string }) => getPostComments(p.id).catch(() => []))),
        ]);
        postsData.forEach((p: { id: string }, i: number) => {
          rMap[p.id] = allReactions[i];
          cMap[p.id] = allComments[i];
        });
      }
      return {
        posts: postsData,
        channelCount: chs.length - ext.length,
        externalCount: ext.length,
        reactions: rMap,
        comments: cMap,
      };
    }
  );
  const posts: Post[] = bundle?.posts ?? [];
  const channelCount = bundle?.channelCount ?? 0;
  const externalCount = bundle?.externalCount ?? 0;
  const reactions = bundle?.reactions ?? {};
  const comments = bundle?.comments ?? {};
  const load = async () => { await refetch(); };

  // Realtime — new posts from teammates appear automatically
  useEffect(() => {
    if (!activeCompanyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`posts-${activeCompanyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "posts",
        filter: `company_id=eq.${activeCompanyId}`,
      }, () => {
        getQueryClient().invalidateQueries({ queryKey: ["updates-feed", activeCompanyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeCompanyId]);

  async function handlePost(data: { title: string; content: string; imageUrl: string; linkUrl: string; postType: string }) {
    if (!data.content.trim() || !activeCompanyId) return;
    setPosting(true);
    try {
      await createPost({
        companyId: activeCompanyId,
        content: data.content.trim(),
        title: data.title.trim() || undefined,
        type: data.postType,
        imageUrl: data.imageUrl.trim() || undefined,
        linkUrl: data.linkUrl.trim() || undefined,
      });
      // Notify all company members about the new briefing
      const postTitle = data.title.trim() || data.content.trim().slice(0, 60);
      import("@/lib/supabase/db").then((mod) => {
        mod.getCompanyMembers(activeCompanyId).then((mbrs: { users: { id: string } | { id: string }[] }[]) => {
          import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
            for (const m of mbrs) {
              const u = Array.isArray(m.users) ? m.users[0] : m.users;
              if (!u?.id || u.id === user?.id) continue;
              dispatch({
                userId: u.id,
                companyId: activeCompanyId,
                title: "New Briefing",
                body: postTitle,
                type: "announcement",
                actionUrl: "/updates",
              }).catch(() => {});
            }
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
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

  async function handleDelete(postId: string) {
    if (!await confirm({ description: "Delete this post? This cannot be undone.", variant: "destructive", confirmLabel: "Delete" })) return;
    setDeleting(postId);
    try { await deletePost(postId); await load(); }
    catch (err) { console.error(err); }
    finally { setDeleting(null); }
  }

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
          <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
            <Radar className="h-3.5 w-3.5 text-primary" />
            Briefing
          </div>
          <Link href="/chat"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
            Channels
            {channelCount > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{channelCount}</Badge>}
          </Link>
          <Link href="/chat?tab=messages"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
            Messages
          </Link>
          <Link href="/chat?tab=external"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
            External Groups
            {externalCount > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{externalCount}</Badge>}
          </Link>
        </div>

        {/* Composer — leadership only */}
        {isAdmin && (
          <BriefingComposer
            userAvatarUrl={user?.avatarUrl ?? undefined}
            userInitials={initials}
            posting={posting}
            onPost={handlePost}
          />
        )}

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
            {posts.map((post: Post) => (
              <BriefingPostCard
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                currentUserId={user?.id}
                currentUserAvatarUrl={user?.avatarUrl ?? undefined}
                currentUserInitials={initials}
                initialReactions={reactions[post.id] ?? []}
                initialComments={comments[post.id] ?? []}
                togglingPin={togglingPin}
                deleting={deleting}
                onTogglePin={handleTogglePin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </>
  );
}
