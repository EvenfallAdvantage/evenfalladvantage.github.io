"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadAvatar } from "@/lib/supabase/db";
import type { SessionUser } from "./types";

interface Props {
  user: SessionUser | null;
  role: string;
  isOnboarding: boolean;
  onAvatarUpdated: (url: string) => void;
}

export function ProfileAvatarSection({ user, role, isOnboarding, onAvatarUpdated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      onAvatarUpdated(url);
      toast.success("Avatar updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setAvatarError(message);
      // Include the real reason in the toast so it's visible even
      // without scrolling to the error line under the avatar.
      toast.error(message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Avatar className="h-16 w-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">
            {role}
          </Badge>
          {isOnboarding && <Badge className="text-[10px] bg-amber-500/15 text-amber-600">Onboarding</Badge>}
        </div>
      </div>
      {avatarError && (
        <p className="text-xs text-red-500 leading-snug break-words max-w-md">
          {avatarError}
        </p>
      )}
    </div>
  );
}
