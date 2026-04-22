"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap, Plus, HelpCircle, BookOpen, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import type { TrainingModule } from "@/types";
import { ModulesTab } from "./components/modules-tab";
import { QuestionBankTab } from "./components/question-bank-tab";
import { StaffProgressTab } from "./components/staff-progress-tab";

export default function AdminTrainingPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [tab, setTab] = useState<"modules" | "questions" | "progress">("modules");

  // Shared state lifted so modules list is available across tabs
  const [modules, setModules] = useState<TrainingModule[]>([]);

  // New module form toggle (declared before useEffect that references it)
  const [showNewModule, setShowNewModule] = useState(false);

  // Question Bank show form toggle (declared before useEffect that references it)
  const [showNewQ, setShowNewQ] = useState(false);

  useEffect(() => {
    setHeader("TRAINING ADMIN", "Manage training modules, slides, and assessment questions",
      tab === "questions" ? <HelpCircle className="h-5 w-5" /> : tab === "progress" ? <BarChart3 className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />,
      tab === "modules" ? (
        <Button onClick={() => setShowNewModule(true)} className="gap-1.5" disabled={showNewModule}>
          <Plus className="h-4 w-4" /> New Module
        </Button>
      ) : tab === "questions" ? (
        <Button onClick={() => setShowNewQ(true)} className="gap-1.5" disabled={showNewQ}>
          <Plus className="h-4 w-4" /> New Question
        </Button>
      ) : undefined
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, tab, showNewModule, showNewQ]);

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <div>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full scrollbar-hide">
            <button onClick={() => setTab("modules")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "modules" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "modules" && <GraduationCap className="h-3.5 w-3.5 text-primary" />}Modules
            </button>
            <button onClick={() => setTab("questions")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "questions" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "questions" && <HelpCircle className="h-3.5 w-3.5 text-primary" />}Question Bank
            </button>
            <button onClick={() => setTab("progress")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "progress" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "progress" && <BarChart3 className="h-3.5 w-3.5 text-primary" />}Staff Progress
            </button>
          </div>
        </div>

        {tab === "modules" && (
          <ModulesTab
            activeCompanyId={activeCompanyId}
            showNewModule={showNewModule}
            setShowNewModule={setShowNewModule}
            modules={modules}
            setModules={setModules}
          />
        )}

        {tab === "questions" && (
          <QuestionBankTab
            activeCompanyId={activeCompanyId}
            modules={modules}
            showNewQ={showNewQ}
            setShowNewQ={setShowNewQ}
          />
        )}

        {tab === "progress" && (
          <StaffProgressTab
            activeCompanyId={activeCompanyId}
            modules={modules}
          />
        )}
      </div>
    </>
  );
}
