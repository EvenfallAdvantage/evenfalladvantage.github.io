"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0b1422]"><Loader2 className="h-8 w-8 animate-spin text-[#dd8c33]" /></div>}>
      <RegisterRedirect />
    </Suspense>
  );
}

function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  useEffect(() => {
    const url = code ? `/?auth=register&code=${encodeURIComponent(code)}` : "/?auth=register";
    router.replace(url);
  }, [router, code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#dd8c33]" />
        <p className="text-sm text-white/50">Redirecting...</p>
      </div>
    </div>
  );
}
