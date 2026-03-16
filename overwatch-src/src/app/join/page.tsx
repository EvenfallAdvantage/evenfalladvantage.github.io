"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { joinCompanyByCode } from "@/lib/supabase/db";
import { AuthLayout } from "@/components/auth-layout";

export default function JoinPage() {
  const router = useRouter();
  const [companyCode, setCompanyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not logged in — redirect to register with code preserved
        router.push(`/register?code=${encodeURIComponent(companyCode)}`);
        return;
      }

      const meta = user.user_metadata || {};
      await joinCompanyByCode({
        supabaseId: user.id,
        email: user.email ?? null,
        phone: user.phone ?? meta.phone ?? null,
        firstName: meta.first_name ?? "",
        lastName: meta.last_name ?? "",
        joinCode: companyCode,
      });

      router.push("/feed");
      router.refresh();
    } catch (err) {
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
            href="/login"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>

          <h2 className="mb-1 text-lg font-semibold">Join a Company</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the company code provided by your manager
          </p>

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
              Join Company
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/register"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Want to create a new company instead?
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
