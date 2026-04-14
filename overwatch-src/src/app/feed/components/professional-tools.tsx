"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TOOLS_GRID } from "./shared";

interface ProfessionalToolsProps {
  hiddenTabs: Set<string>;
}

export function ProfessionalTools({ hiddenTabs }: ProfessionalToolsProps) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        Professional Tools
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TOOLS_GRID.filter((tool) => !hiddenTabs.has(tool.href)).map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tool.bg} transition-transform group-hover:scale-110`}>
                    <tool.icon className={`h-4 w-4 ${tool.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{tool.title}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{tool.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
