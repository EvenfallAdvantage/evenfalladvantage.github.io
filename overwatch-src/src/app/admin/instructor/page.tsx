"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { trainingHqHref } from "@/lib/training/hq-tabs";

/** Instructor HQ merged into Training HQ; keep old links working. */
export default function InstructorHQRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(trainingHqHref("courses")); }, [router]);
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
