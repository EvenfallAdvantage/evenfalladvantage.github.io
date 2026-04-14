"use client";

import { useState, useRef } from "react";
import { UserPlus, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { createCompanyWithOwner } from "@/lib/supabase/db-users";
import { createClient } from "@/lib/supabase/client";

interface OnboardingBannerProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    companies?: { companyId: string }[];
  };
}

export function OnboardingBanner({ user }: OnboardingBannerProps) {
  const [showCreateCo, setShowCreateCo] = useState(false);
  const [newCoName, setNewCoName] = useState("");
  const [creatingCo, setCreatingCo] = useState(false);
  const createCoRef = useRef<HTMLInputElement>(null);

  const showBanner =
    !user.companies ||
    user.companies.length === 0 ||
    (user.companies.length === 1 && user.companies[0].companyId === "pending");

  async function handleCreateCompany() {
    if (!newCoName.trim() || !user.id) return;
    setCreatingCo(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) throw new Error("Not authenticated");

      await createCompanyWithOwner({
        companyName: newCoName.trim(),
        supabaseId: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? user.phone ?? null,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      setShowCreateCo(false);
      setNewCoName("");
      window.location.reload();
    } catch (err) {
      console.error("Failed to create company:", err);
      alert(err instanceof Error ? err.message : "Failed to create company. Please try again.");
    } finally {
      setCreatingCo(false);
    }
  }

  return (
    <>
      {showBanner && (
        <Card className="border-[#dd8c33]/40 bg-gradient-to-r from-[#dd8c33]/10 via-[#dd8c33]/5 to-transparent">
          <CardContent className="py-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#dd8c33]/15 border border-[#dd8c33]/25">
                <UserPlus className="h-6 w-6 text-[#dd8c33]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">You&apos;re not part of a company yet</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Join an existing company with a code from your manager, or create your own.
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link
                  href="/join"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg text-sm font-medium bg-[#dd8c33] hover:bg-[#c47a2a] text-white transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Join Company
                </Link>
                <button
                  onClick={() => {
                    setShowCreateCo(true);
                    setTimeout(() => createCoRef.current?.focus(), 100);
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> Create Company
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Company Modal */}
      {showCreateCo && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateCo(false)} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center px-4">
            <Card className="w-full max-w-sm shadow-2xl">
              <CardContent className="pt-6 pb-4 space-y-4">
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/overwatch/images/overwatch_logo.png?v=2" alt="Overwatch" className="h-12 w-12 mx-auto mb-3" />
                  <h2 className="text-lg font-bold">Create Your Company</h2>
                  <p className="text-xs text-muted-foreground mt-1">Set up your security operation in seconds.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Company Name</label>
                  <Input
                    ref={createCoRef}
                    placeholder="e.g. Apex Security Group"
                    value={newCoName}
                    onChange={(e) => setNewCoName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCompany()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreateCo(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 gap-1.5" onClick={handleCreateCompany} disabled={creatingCo || !newCoName.trim()}>
                    {creatingCo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
