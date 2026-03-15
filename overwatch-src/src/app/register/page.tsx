"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerUserInDB } from "@/lib/supabase/db";
import { AuthLayout } from "@/components/auth-layout";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"info" | "company" | "confirm">("info");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
            company_name: companyName,
          },
          emailRedirectTo: `${window.location.origin}/overwatch/auth/callback/`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        setStep("confirm");
        return;
      }

      // Create User + Company + Membership in database
      if (data.user) {
        try {
          await registerUserInDB({
            supabaseId: data.user.id,
            email: data.user.email,
            phone: phone || null,
            firstName,
            lastName,
            companyName,
          });
        } catch (dbErr) {
          console.warn("DB registration deferred:", dbErr);
          // Non-fatal: AuthProvider will retry on next login
        }
      }

      router.push("/feed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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

          {step === "confirm" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-center text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>.
                Click it to activate your account.
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold">Create your account</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {step === "info"
                  ? "Enter your details to get started"
                  : "Set up your company"}
              </p>
            </>
          )}

          {step !== "confirm" && <form onSubmit={handleRegister} className="space-y-4">
            {step === "info" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regEmail">Email</Label>
                  <Input
                    id="regEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPhone">Phone (optional)</Label>
                  <Input
                    id="regPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password</Label>
                  <Input
                    id="regPassword"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => setStep("company")}
                  disabled={!firstName || !lastName || !email || !password}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {step === "company" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. Apex Security Services"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This creates a new company. To join an existing company, use a
                    company code instead.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("info")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={isLoading || !companyName}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>}

          {step !== "confirm" && (
            <div className="mt-6 text-center">
              <Link
                href="/join"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Have a company code? Join an existing company
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
