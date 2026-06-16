"use client";

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Member } from "../shared";

interface MemberSearchSelectProps {
  value: string;
  onChange: (userId: string) => void;
  sortedMembers: Member[];
  availByUser: Map<string, string>;
  hasConflict?: boolean;
  filled?: boolean;
  placeholder?: string;
}

export function MemberSearchSelect({
  value,
  onChange,
  sortedMembers,
  availByUser,
  hasConflict,
  filled,
  placeholder = "Open",
}: MemberSearchSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = sortedMembers.find((m) => m.users?.id === value);
  const displayName = selected
    ? `${selected.users?.first_name} ${selected.users?.last_name}`
    : placeholder;

  const borderColor = hasConflict
    ? "border-red-500/40 text-red-500"
    : filled
    ? "border-green-500/30 text-green-600"
    : "border-amber-500/30 text-amber-600";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`h-6 w-full sm:w-auto sm:max-w-[180px] truncate rounded border bg-background px-1.5 text-[10px] font-medium cursor-pointer flex items-center justify-between gap-1 ${borderColor}`}
      >
        <span className="truncate">{displayName}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" align="start" sideOffset={2}>
        <Command>
          <CommandInput placeholder="Search members..." className="h-8" />
          <CommandList>
            <CommandEmpty>No members found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none unassigned open clear"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("h-3 w-3", !value || value === "" ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">{placeholder}</span>
              </CommandItem>
              {sortedMembers.map((m) => {
                const status = availByUser.get(m.users?.id ?? "");
                const tag = status === "available" ? "\u2713" : status === "tentative" ? "?" : status === "unavailable" ? "\u2717" : "";
                const isSelected = m.users?.id === value;
                return (
                  <CommandItem
                    key={m.id ?? m.user_id}
                    value={`${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`}
                    onSelect={() => {
                      onChange(m.users?.id ?? "");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                    <span>{m.users?.first_name} {m.users?.last_name}</span>
                    {tag && <span className="ml-auto text-[10px] opacity-60">{tag}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
