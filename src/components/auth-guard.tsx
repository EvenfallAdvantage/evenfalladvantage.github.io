"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_ROUTES = ["/login", "/register", "/verify", "/join", "/auth/callback"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

      if (!user && !isAuthRoute) {
        router.replace("/login");
      } else if (user && isAuthRoute) {
        router.replace("/feed");
      } else {
        setIsReady(true);
      }
    });
  }, [pathname, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
