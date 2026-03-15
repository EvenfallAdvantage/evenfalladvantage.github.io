"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth-layout";

const CODE_LENGTH = 6;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d !== "") && index === CODE_LENGTH - 1) {
      handleVerify(newCode.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(otp?: string) {
    const pin = otp || code.join("");
    if (pin.length !== CODE_LENGTH) return;

    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const formattedPhone = phone.startsWith("+")
        ? phone
        : `+1${phone.replace(/\D/g, "")}`;

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: pin,
        type: "sms",
      });

      if (verifyError) throw verifyError;

      router.push("/feed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    try {
      const supabase = createClient();
      const formattedPhone = phone.startsWith("+")
        ? phone
        : `+1${phone.replace(/\D/g, "")}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (otpError) throw otpError;
    } catch {
      setError("Failed to resend code");
    }
  }

  const maskedPhone = phone
    ? phone.replace(/(\d{3})\d{4}(\d{2,})/, "$1****$2")
    : "";

  return (
    <Card className="w-full max-w-sm border-border/50 shadow-xl">
      <CardContent className="pt-6">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <h2 className="mb-1 text-center text-lg font-semibold">
          Enter the {CODE_LENGTH}-digit code
        </h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sent to {maskedPhone || "your phone"}
        </p>

        <div className="mb-6 flex justify-center gap-2">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-11 rounded-lg border border-border bg-muted/50 text-center text-xl font-bold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-destructive">{error}</p>
        )}

        <div className="mb-4 text-center text-sm text-muted-foreground">
          Didn&apos;t get the code?{" "}
          <button
            onClick={handleResend}
            className="font-medium text-primary hover:underline"
          >
            Resend code
          </button>
        </div>

        <Button
          onClick={() => handleVerify()}
          className="w-full gap-2"
          disabled={isLoading || code.some((d) => d === "")}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Verify"
          )}
        </Button>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-xs text-primary hover:underline"
          >
            Log in using email
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="h-96" />}>
        <VerifyForm />
      </Suspense>
    </AuthLayout>
  );
}
