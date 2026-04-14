"use client";

import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import AddressAutocomplete from "@/components/address-autocomplete";

interface ApplyPersonalInfoSectionProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  onChange: (field: string, value: string) => void;
}

export function ApplyPersonalInfoSection({ firstName, lastName, email, phone, address, onChange }: ApplyPersonalInfoSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span>
        Personal Information
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">First Name <span className="text-red-400">*</span></label>
          <Input value={firstName} onChange={(e) => onChange("firstName", e.target.value)}
            required className="bg-zinc-900 border-zinc-700 text-white" placeholder="John" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Last Name <span className="text-red-400">*</span></label>
          <Input value={lastName} onChange={(e) => onChange("lastName", e.target.value)}
            required className="bg-zinc-900 border-zinc-700 text-white" placeholder="Doe" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Email <span className="text-red-400">*</span></label>
          <Input value={email} onChange={(e) => onChange("email", e.target.value)}
            type="email" required className="bg-zinc-900 border-zinc-700 text-white" placeholder="john@example.com" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Phone</label>
          <PhoneInput value={phone} onChange={(v) => onChange("phone", v)}
            className="bg-zinc-900 border-zinc-700 text-white" />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Address</label>
        <AddressAutocomplete
          value={address}
          onChange={(v) => onChange("address", v)}
          onSelect={(s) => onChange("address", s.displayName)}
          placeholder="123 Main St, City, State ZIP"
          inputClassName="bg-zinc-900 border-zinc-700 text-white"
        />
      </div>
    </div>
  );
}
