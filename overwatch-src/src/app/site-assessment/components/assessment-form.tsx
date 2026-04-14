"use client";

import { ChevronRight, ChevronDown, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SectionDef, NominatimResult } from "./assessment-types";
import AddressAutocomplete from "./address-autocomplete";

interface AssessmentFormProps {
  sections: SectionDef[];
  data: Record<string, string>;
  expandedSections: Set<string>;
  onUpdateField: (name: string, value: string) => void;
  onToggleSection: (id: string) => void;
  onCalculate: () => void;
  onAddressSelect: (result: NominatimResult) => void;
  onAddressClear: () => void;
  addrResolved: string | null;
  addrQuery: string;
}

export default function AssessmentForm({
  sections,
  data,
  expandedSections,
  onUpdateField,
  onToggleSection,
  onCalculate,
  onAddressSelect,
  onAddressClear,
  addrResolved,
  addrQuery,
}: AssessmentFormProps) {
  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        const showSection = section.id === "clientInfo" || data.facilityType;

        if (!showSection) return null;

        return (
          <Card key={section.id} className="border-border/40">
            <button
              onClick={() => onToggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {section.icon}
                <span className="text-sm font-semibold">{section.title}</span>
                <span className="text-[10px] text-muted-foreground">{section.tooltip}</span>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 grid gap-3 sm:grid-cols-2">
                {/* Address autocomplete for Client Information section */}
                {section.id === "clientInfo" && (
                  <AddressAutocomplete
                    onSelect={onAddressSelect}
                    onClear={onAddressClear}
                    addrResolved={addrResolved}
                    externalQuery={addrQuery}
                  />
                )}

                {section.fields.map((field) => (
                  <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={data[field.name] || ""}
                        onChange={(e) => onUpdateField(field.name, e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={data[field.name] || ""}
                        onChange={(e) => onUpdateField(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px] resize-y"
                      />
                    ) : (
                      <Input
                        type={field.type}
                        value={data[field.name] || ""}
                        onChange={(e) => onUpdateField(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="h-8 text-sm"
                      />
                    )}
                    {field.tooltip && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{field.tooltip}</p>}
                  </div>
                ))}

                {/* Calculate button in risk section */}
                {section.id === "riskScoring" && (
                  <div className="sm:col-span-2 pt-2">
                    <Button className="w-full gap-2" onClick={onCalculate}>
                      <BarChart3 className="h-4 w-4" /> Calculate Risk Score & Generate Report
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
