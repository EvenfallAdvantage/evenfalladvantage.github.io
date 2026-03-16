"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, ArrowRight, CheckCircle2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerUserInDB, joinCompanyByCode } from "@/lib/supabase/db";
import { AuthLayout } from "@/components/auth-layout";
import { checkPasswordStrength, type PasswordCheck } from "@/lib/security";
import { TOSModal } from "@/components/terms-of-service";

const STRENGTH_COLORS: Record<PasswordCheck["strength"], string> = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-green-500",
  military: "bg-emerald-400",
};

const STRENGTH_WIDTH: Record<PasswordCheck["strength"], string> = {
  weak: "w-1/5",
  fair: "w-2/5",
  good: "w-3/5",
  strong: "w-4/5",
  military: "w-full",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AuthLayout>}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinCode = searchParams.get("code") ?? "";
  const [step, setStep] = useState<"info" | "company" | "confirm">("info");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pwCheck, setPwCheck] = useState<PasswordCheck | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);

  function handlePasswordChange(val: string) {
    setPassword(val);
    setPwCheck(val.length > 0 ? checkPasswordStrength(val) : null);
  }

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
            tos_accepted_at: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}/overwatch/auth/callback/`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        // Email confirmation required — persist join code for after verification
        if (joinCode && data.user) {
          localStorage.setItem("pending_join", JSON.stringify({
            code: joinCode,
            supabaseId: data.user.id,
            email: data.user.email,
            phone: phone || null,
            firstName,
            lastName,
          }));
        }
        setStep("confirm");
        return;
      }

      // Create User + Company/Join in database
      if (data.user) {
        try {
          if (joinCode) {
            // Join existing company by code
            await joinCompanyByCode({
              supabaseId: data.user.id,
              email: data.user.email,
              phone: phone || null,
              firstName,
              lastName,
              joinCode,
            });
          } else {
            // Create new company
            await registerUserInDB({
              supabaseId: data.user.id,
              email: data.user.email,
              phone: phone || null,
              firstName,
              lastName,
              companyName,
            });
          }
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
                  ? joinCode
                    ? `Enter your details to join with code ${joinCode}`
                    : "Enter your details to get started"
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
                    autoComplete="email"
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
                    placeholder="Min 12 characters (military-grade)"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={12}
                  />
                  {pwCheck && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLORS[pwCheck.strength]} ${STRENGTH_WIDTH[pwCheck.strength]}`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {pwCheck.strength === "military" && <Shield className="inline h-3 w-3 mr-0.5 text-emerald-400" />}
                          {pwCheck.strength}
                        </span>
                        {pwCheck.strength === "military" && (
                          <span className="text-[10px] text-emerald-400 font-mono">NIST 800-63B ✓</span>
                        )}
                      </div>
                      {pwCheck.errors.length > 0 && (
                        <ul className="text-[11px] text-destructive space-y-0.5">
                          {pwCheck.errors.map((err) => <li key={err}>• {err}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {joinCode ? (
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoading || !firstName || !lastName || !email || !password || (pwCheck ? !pwCheck.valid : true)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create Account & Join Company"
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={() => setStep("company")}
                    disabled={!firstName || !lastName || !email || !password || (pwCheck ? !pwCheck.valid : true)}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
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

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                    className="mt-0.5 rounded" />
                  <span className="text-xs text-muted-foreground leading-tight">
                    I have read and agree to the{" "}
                    <button type="button" onClick={() => setShowTos(true)} className="text-primary hover:underline font-medium">Terms of Service</button>
                  </span>
                </label>

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
                    disabled={isLoading || !companyName || !tosAccepted}
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
            <>
              <div className="mt-6 text-center">
                <Link
                  href="/join"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Have a company code? Join an existing company
                </Link>
              </div>
              <div className="mt-2 text-center">
                <a
                  href="/student-portal/login.html"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Individual student? Use the Student Portal
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <TOSModal open={showTos} onClose={() => setShowTos(false)} />
    </AuthLayout>
  );
}
