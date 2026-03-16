"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?auth=login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#dd8c33]" />
        <p className="text-sm text-white/50">Redirecting...</p>
      </div>
    </div>
  );
}
