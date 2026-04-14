"use client";

import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface MemberProfile {
  users?: {
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  role: string;
  status: string;
  bio?: string;
  title?: string;
  guard_card_number?: string;
  guard_card_expiry?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  work_preferences?: string[];
  shirt_size?: string;
  jacket_size?: string;
  hire_date?: string;
}

interface MemberProfileModalProps {
  profile: MemberProfile;
  onClose: () => void;
}

export function MemberProfileModal({ profile, onClose }: MemberProfileModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4 shrink-0">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={profile.users?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
              {(profile.users?.first_name?.[0] ?? "")}{(profile.users?.last_name?.[0] ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{profile.users?.first_name} {profile.users?.last_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{profile.users?.email}</p>
            {profile.users?.phone && <p className="text-[11px] text-muted-foreground">{profile.users.phone}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-[9px] capitalize">{profile.role}</Badge>
            <Badge variant={profile.status === "active" ? "default" : "outline"} className="text-[9px] capitalize">{profile.status}</Badge>
          </div>
        </div>

        {/* Profile content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          <h3 className="text-sm font-semibold">Company Profile</h3>

          {profile.bio && (
            <div>
              <span className="text-muted-foreground text-xs">Bio</span>
              <p className="font-medium text-sm">{profile.bio}</p>
            </div>
          )}

          {profile.title && (
            <div>
              <span className="text-muted-foreground text-xs">Title</span>
              <p className="font-medium text-sm">{profile.title}</p>
            </div>
          )}

          <div>
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Guard Card <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
            <p className="font-medium text-sm">{profile.guard_card_number ?? "—"}</p>
            {profile.guard_card_expiry && (
              <p className="text-[10px] text-muted-foreground">
                Expires {new Date(profile.guard_card_expiry).toLocaleDateString()}
              </p>
            )}
          </div>

          <hr className="border-border/30" />

          <div>
            <span className="text-muted-foreground text-xs flex items-center gap-1">Address <Lock className="h-2.5 w-2.5 text-amber-500" /></span>
            <p className="font-medium text-sm">{profile.address ?? "—"}</p>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Emergency Contact</span>
            <p className="font-medium text-sm">
              {profile.emergency_contact_name ?? "—"}
              {profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ""}
            </p>
          </div>

          {(profile.work_preferences?.length ?? 0) > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">Work Preferences</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.work_preferences?.map((w: string) => (
                  <Badge key={w} variant="outline" className="text-[9px]">{w}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground text-xs">Shirt</span>
              <p className="font-medium text-sm">{profile.shirt_size || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Jacket</span>
              <p className="font-medium text-sm">{profile.jacket_size || "—"}</p>
            </div>
          </div>

          {profile.hire_date && (
            <div>
              <span className="text-muted-foreground text-xs">Hire Date</span>
              <p className="font-medium text-sm">{new Date(profile.hire_date).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        {/* Close */}
        <div className="border-t border-border/40 px-5 py-3 shrink-0">
          <Button size="sm" variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
