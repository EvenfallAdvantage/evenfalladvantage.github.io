"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth-layout";
import { logSecurityEvent, checkLoginAttempts, recordFailedAttempt, clearLoginAttempts } from "@/lib/security/audit";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePhoneLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { allowed } = await checkLoginAttempts(phone);
      if (!allowed) {
        setError("Too many attempts. Account locked for 15 minutes.");
        logSecurityEvent({ event_type: "security.lockout", outcome: "blocked", metadata: { method: "phone", identifier: phone } });
        return;
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`,
      });

      if (otpError) throw otpError;

      router.push(`/verify?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      recordFailedAttempt(phone);
      logSecurityEvent({ event_type: "auth.login.failed", outcome: "failure", metadata: { method: "phone" } });
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { allowed } = await checkLoginAttempts(email);
      if (!allowed) {
        setError("Too many attempts. Account locked for 15 minutes.");
        logSecurityEvent({ event_type: "security.lockout", outcome: "blocked", metadata: { method: "email", identifier: email } });
        return;
      }

      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      clearLoginAttempts(email);
      logSecurityEvent({ event_type: "auth.login.success", user_id: data.user?.id, outcome: "success", metadata: { method: "email" } });
      router.push("/feed");
      router.refresh();
    } catch (err) {
      recordFailedAttempt(email);
      logSecurityEvent({ event_type: "auth.login.failed", outcome: "failure", metadata: { method: "email", identifier: email } });
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm border-border/50 shadow-xl">
        <CardContent className="pt-6">
          <h2 className="mb-1 text-center text-lg font-semibold">Welcome back</h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Sign in to your Overwatch account
          </p>

          <Tabs
            value={method}
            onValueChange={(v) => {
              setMethod(v as "phone" | "email");
              setError("");
            }}
            className="w-full"
          >
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="phone" className="gap-1.5 text-xs">
                <Phone className="h-3.5 w-3.5" />
                Phone
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1.5 text-xs">
                <Mail className="h-3.5 w-3.5" />
                Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="flex gap-2">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                      US +1
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll send you a code to verify your number
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading || !phone}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Verify
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading || !email || !password}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Sign In
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Create one now
            </Link>
          </div>

          <div className="mt-3 text-center">
            <Link
              href="/join"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Have a company code? Join here
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
