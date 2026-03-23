"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, UserPlus, CheckCircle2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { joinCompanyByCode, fetchUserProfile, createCompanyWithOwner } from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";
import { AuthLayout } from "@/components/auth-layout";
import type { CompanyContext } from "@/types";

export default function JoinPage() {
  const router = useRouter();
  const { user: storeUser, setUser, setActiveCompany } = useAuthStore();
  const [companyCode, setCompanyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"join" | "create">("join");
  const [newCompanyName, setNewCompanyName] = useState("");

  const isLoggedIn = !!storeUser;
  const currentUserEmail = storeUser?.email ?? null;

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) {
        router.push("/?auth=register");
        return;
      }

      const result = await createCompanyWithOwner({
        companyName: newCompanyName.trim(),
        supabaseId: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? storeUser?.phone ?? null,
        firstName: storeUser?.firstName ?? "",
        lastName: storeUser?.lastName ?? "",
      });

      // Re-fetch profile and update auth store
      const profile = await fetchUserProfile();
      if (profile?.user) {
        const companies: CompanyContext[] = (profile.memberships ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => ({
            companyId: m.companies?.id ?? m.company_id,
            companyName: m.companies?.name ?? "Unknown",
            companySlug: m.companies?.slug ?? "",
            companyLogo: m.companies?.logo_url ?? null,
            brandColor: m.companies?.brand_color ?? "#1d3451",
            role: m.role ?? "staff",
            isTrainingProvider: m.companies?.is_training_provider ?? false,
            settings: m.companies?.settings ?? {},
            membership: {
              id: m.id,
              nickname: m.nickname ?? null,
              status: m.status ?? "active",
            },
          })
        );

        setUser({
          id: profile.user.id,
          email: profile.user.email ?? authUser.email ?? null,
          phone: profile.user.phone ?? authUser.phone ?? null,
          firstName: profile.user.first_name ?? "",
          lastName: profile.user.last_name ?? "",
          avatarUrl: profile.user.avatar_url ?? null,
          isPlatformAdmin: profile.user.is_platform_admin ?? false,
          companies,
          activeCompanyId: result.company.id,
        });

        setActiveCompany(result.company.id);
      }

      setSuccess(result.company.name ?? "company");

      setTimeout(() => {
        router.push("/feed");
        router.refresh();
      }, 1200);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) {
        // Not logged in — redirect to register with code preserved
        router.push(`/register?code=${encodeURIComponent(companyCode)}`);
        return;
      }

      const meta = authUser.user_metadata || {};
      const result = await joinCompanyByCode({
        supabaseId: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone || meta.phone || null,
        firstName: meta.first_name ?? "",
        lastName: meta.last_name ?? "",
        joinCode: companyCode,
      });

      // Re-fetch profile and update auth store with new companies list
      const profile = await fetchUserProfile();
      if (profile?.user) {
        const companies: CompanyContext[] = (profile.memberships ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => ({
            companyId: m.companies?.id ?? m.company_id,
            companyName: m.companies?.name ?? "Unknown",
            companySlug: m.companies?.slug ?? "",
            companyLogo: m.companies?.logo_url ?? null,
            brandColor: m.companies?.brand_color ?? "#1d3451",
            role: m.role ?? "staff",
            isTrainingProvider: m.companies?.is_training_provider ?? false,
            settings: m.companies?.settings ?? {},
            membership: {
              id: m.id,
              nickname: m.nickname ?? null,
              status: m.status ?? "active",
            },
          })
        );

        setUser({
          id: profile.user.id,
          email: profile.user.email ?? authUser.email ?? null,
          phone: profile.user.phone ?? authUser.phone ?? null,
          firstName: profile.user.first_name ?? "",
          lastName: profile.user.last_name ?? "",
          avatarUrl: profile.user.avatar_url ?? null,
          isPlatformAdmin: profile.user.is_platform_admin ?? false,
          companies,
          activeCompanyId: result.company.id,
        });

        // Switch to the newly joined company
        setActiveCompany(result.company.id);
      }

      setSuccess(result.company.name ?? "company");

      // Brief delay so user sees confirmation, then redirect
      setTimeout(() => {
        router.push("/feed");
        router.refresh();
      }, 1200);
    } catch (err) {
      // Ignore AbortError from Supabase lock contention — session will resolve via AuthProvider
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Invalid company code or something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm border-border/50 shadow-xl">
        <CardContent className="pt-6">
          <Link
            href={isLoggedIn ? "/feed" : "/login"}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {isLoggedIn ? "Back to dashboard" : "Back to login"}
          </Link>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-lg font-semibold">Joined successfully!</h2>
              <p className="text-center text-sm text-muted-foreground">
                You&apos;re now a member of <strong>{success}</strong>.
                Redirecting to dashboard...
              </p>
            </div>
          ) : mode === "create" && isLoggedIn ? (
            <>
              <h2 className="mb-1 text-lg font-semibold">Create a Company</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Set up your security operation in seconds
              </p>

              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. Apex Security Group"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                    className="text-sm"
                    maxLength={100}
                    autoFocus
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading || !newCompanyName.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  Create Company
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => { setMode("join"); setError(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Have a company code? Join instead
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold">Join a Company</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Enter the company code provided by your manager
              </p>

              {isLoggedIn && currentUserEmail && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 mb-4">
                  <p className="text-xs text-muted-foreground">
                    Joining as <strong className="text-foreground">{currentUserEmail}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      useAuthStore.getState().clearSession();
                      router.push(`/register?code=${encodeURIComponent(companyCode || "")}`);
                    }}
                    className="text-[10px] text-primary hover:underline mt-0.5"
                  >
                    Not you? Sign out &amp; create a new account
                  </button>
                </div>
              )}

              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Company code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. ABC123"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                    required
                    className="text-center text-lg font-mono tracking-widest"
                    maxLength={10}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading || !companyCode}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isLoggedIn ? "Join Company" : "Continue"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => { setMode("create"); setError(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Want to create a new company instead?
                  </button>
                ) : (
                  <Link
                    href="/register"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Want to create a new company instead?
                  </Link>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
