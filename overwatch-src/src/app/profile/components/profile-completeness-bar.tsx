"use client";

import type { SessionUser, MemberProfile } from "./types";

interface Props {
  user: SessionUser | null;
  mp: MemberProfile;
  mpLoaded: boolean;
}

export function ProfileCompletenessBar({ user, mp, mpLoaded }: Props) {
  if (!mpLoaded) return null;

  const completenessFields = [
    !!user?.firstName, !!user?.lastName, !!user?.email, !!user?.phone,
    !!mp?.bio, !!mp?.address, !!mp?.guard_card_number, !!mp?.emergency_contact_name,
    !!mp?.emergency_contact_phone, (mp?.work_preferences?.length ?? 0) > 0,
  ];
  const completeness = Math.round((completenessFields.filter(Boolean).length / completenessFields.length) * 100);

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">Profile Completeness</span>
        <span className={`text-xs font-bold ${completeness === 100 ? "text-green-500" : completeness >= 70 ? "text-amber-500" : "text-red-500"}`}>{completeness}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${completeness === 100 ? "bg-green-500" : completeness >= 70 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${completeness}%` }} />
      </div>
      {completeness < 100 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Complete your profile to help your team identify you. Missing: {completenessFields.map((v, i) => !v ? ["first name", "last name", "email", "phone", "bio", "address", "guard card", "emergency name", "emergency phone", "work preferences"][i] : null).filter(Boolean).join(", ")}
        </p>
      )}
    </div>
  );
}
