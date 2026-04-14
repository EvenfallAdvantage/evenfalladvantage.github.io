"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin, DoorOpen, Camera, ShieldAlert, Heart, Flame,
  User, Radio, Car, Star, Plus, Trash2, GripVertical, X,
  Search, ChevronDown,
  // Extended icon library for searchable picker
  Building2, Warehouse, ParkingCircle, Fence, TreePine, Mountain,
  Waves, Tent, Flag, Target, Eye, EyeOff, Lock, Unlock,
  Shield, Siren, Zap, AlertTriangle, Ban,
  Phone, Wifi, Satellite, Megaphone,
  Ambulance, Stethoscope, Pill, Cross, HeartPulse,
  Flashlight, Key, HardHat,
  Users, UserCheck, UserX, Baby, Dog, Footprints,
  Truck, Bus, Bike, Plane, Ship, TrainFront,
  Coffee, UtensilsCrossed, Droplets,
  Cctv, Scan, QrCode, Fingerprint,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Circle,
  Package,
  Lightbulb, Power,
  Bell, BellRing,
  MapPinned, Navigation, Compass,
  Skull, Bomb, Radiation, Biohazard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

export type StoryboardPin = {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  icon: string;
  color: string;
  timestamp?: string;
  createdBy?: string;
};

export type StoryboardEditorProps = {
  imageUrl: string;
  pins: StoryboardPin[];
  onPinsChange?: (pins: StoryboardPin[]) => void;
  readOnly?: boolean;
  singlePinMode?: boolean;
  /** Pre-fill label, description, icon, and color for new pins */
  defaultPinValues?: { label?: string; description?: string; icon?: string; color?: string };
  className?: string;
};

/* ── Icon map ── */

type IconEntry = { value: string; label: string; icon: LucideIcon; tags: string[] };

const ICON_CATEGORIES: { label: string; icons: IconEntry[] }[] = [
  { label: "Common", icons: [
    { value: "pin", label: "Pin", icon: MapPin, tags: ["location", "marker", "point"] },
    { value: "star", label: "Star", icon: Star, tags: ["important", "favorite", "command"] },
    { value: "flag", label: "Flag", icon: Flag, tags: ["checkpoint", "rally", "marker"] },
    { value: "target", label: "Target", icon: Target, tags: ["objective", "focus", "goal"] },
    { value: "circle", label: "Circle", icon: Circle, tags: ["area", "zone", "point"] },
    { value: "pinned", label: "Pinned", icon: MapPinned, tags: ["fixed", "location"] },
  ]},
  { label: "Security", icons: [
    { value: "incident", label: "Incident", icon: ShieldAlert, tags: ["alert", "security", "breach"] },
    { value: "shield", label: "Shield", icon: Shield, tags: ["protection", "secure", "guard"] },
    { value: "siren", label: "Siren", icon: Siren, tags: ["alarm", "emergency", "alert"] },
    { value: "eye", label: "Observation", icon: Eye, tags: ["watch", "surveillance", "lookout"] },
    { value: "eyeoff", label: "Blind Spot", icon: EyeOff, tags: ["hidden", "concealed", "no coverage"] },
    { value: "lock", label: "Locked", icon: Lock, tags: ["secure", "restricted", "closed"] },
    { value: "unlock", label: "Unlocked", icon: Unlock, tags: ["open", "access", "unsecured"] },
    { value: "ban", label: "Restricted", icon: Ban, tags: ["prohibited", "no entry", "blocked"] },
    { value: "alert", label: "Warning", icon: AlertTriangle, tags: ["caution", "danger", "hazard"] },
    { value: "skull", label: "Danger", icon: Skull, tags: ["lethal", "extreme", "death"] },
    { value: "scan", label: "Scanner", icon: Scan, tags: ["check", "inspect", "verify"] },
  ]},
  { label: "Access", icons: [
    { value: "gate", label: "Gate / Door", icon: DoorOpen, tags: ["entrance", "exit", "entry"] },
    { value: "exit", label: "Exit", icon: DoorOpen, tags: ["egress", "way out", "emergency exit"] },
    { value: "fence", label: "Fence", icon: Fence, tags: ["barrier", "perimeter", "boundary"] },
    { value: "key", label: "Key Access", icon: Key, tags: ["keycard", "badge", "credential"] },
    { value: "fingerprint", label: "Biometric", icon: Fingerprint, tags: ["access control", "scanner"] },
    { value: "qrcode", label: "QR Code", icon: QrCode, tags: ["scan", "ticket", "credential"] },
  ]},
  { label: "Surveillance", icons: [
    { value: "camera", label: "Camera", icon: Camera, tags: ["cctv", "surveillance", "photo"] },
    { value: "cctv", label: "CCTV", icon: Cctv, tags: ["surveillance", "monitor", "security camera"] },
    { value: "flashlight", label: "Flashlight", icon: Flashlight, tags: ["light", "search", "patrol"] },
  ]},
  { label: "Medical", icons: [
    { value: "medical", label: "Medical", icon: Heart, tags: ["first aid", "health", "aid station"] },
    { value: "heartpulse", label: "Heart Pulse", icon: HeartPulse, tags: ["vital", "emergency", "aed"] },
    { value: "ambulance", label: "Ambulance", icon: Ambulance, tags: ["ems", "transport", "medevac"] },
    { value: "stethoscope", label: "Stethoscope", icon: Stethoscope, tags: ["doctor", "nurse", "triage"] },
    { value: "cross", label: "Red Cross", icon: Cross, tags: ["aid", "first aid", "medical station"] },
    { value: "pill", label: "Pharmacy", icon: Pill, tags: ["medication", "drugs", "narcan"] },
  ]},
  { label: "Hazards", icons: [
    { value: "fire", label: "Fire", icon: Flame, tags: ["hazard", "burn", "emergency"] },
    { value: "zap", label: "Electrical", icon: Zap, tags: ["shock", "power", "hazard"] },
    { value: "radiation", label: "Radiation", icon: Radiation, tags: ["hazmat", "nuclear", "contamination"] },
    { value: "biohazard", label: "Biohazard", icon: Biohazard, tags: ["contamination", "biological", "hazmat"] },
    { value: "bomb", label: "Explosive", icon: Bomb, tags: ["ied", "suspicious package", "eod"] },
    { value: "droplets", label: "Water/Flood", icon: Droplets, tags: ["leak", "flooding", "spill"] },
  ]},
  { label: "Personnel", icons: [
    { value: "personnel", label: "Person", icon: User, tags: ["guard", "staff", "individual"] },
    { value: "users", label: "Group", icon: Users, tags: ["team", "crowd", "assembly"] },
    { value: "usercheck", label: "Verified", icon: UserCheck, tags: ["cleared", "confirmed", "vip"] },
    { value: "userx", label: "Denied", icon: UserX, tags: ["ejected", "banned", "trespasser"] },
    { value: "baby", label: "Child", icon: Baby, tags: ["minor", "lost child", "family"] },
    { value: "dog", label: "K9", icon: Dog, tags: ["canine", "animal", "service dog"] },
    { value: "footprints", label: "Footprints", icon: Footprints, tags: ["patrol", "route", "track"] },
    { value: "hardhat", label: "Hard Hat", icon: HardHat, tags: ["construction", "worker", "safety"] },
  ]},
  { label: "Vehicles", icons: [
    { value: "car", label: "Car", icon: Car, tags: ["vehicle", "parking", "automobile"] },
    { value: "truck", label: "Truck", icon: Truck, tags: ["delivery", "large vehicle", "semi"] },
    { value: "bus", label: "Bus", icon: Bus, tags: ["transport", "shuttle", "transit"] },
    { value: "bike", label: "Bicycle", icon: Bike, tags: ["cycle", "bike rack"] },
    { value: "plane", label: "Aircraft", icon: Plane, tags: ["helicopter", "aviation", "drone"] },
    { value: "ship", label: "Boat", icon: Ship, tags: ["watercraft", "marine", "dock"] },
    { value: "train", label: "Train", icon: TrainFront, tags: ["rail", "station", "transit"] },
    { value: "parking", label: "Parking", icon: ParkingCircle, tags: ["lot", "garage", "valet"] },
  ]},
  { label: "Comms", icons: [
    { value: "radio", label: "Radio", icon: Radio, tags: ["communication", "walkie talkie", "comms"] },
    { value: "phone", label: "Phone", icon: Phone, tags: ["call", "telephone", "landline"] },
    { value: "wifi", label: "WiFi", icon: Wifi, tags: ["internet", "network", "connectivity"] },
    { value: "satellite", label: "Satellite", icon: Satellite, tags: ["gps", "tracking", "comms"] },
    { value: "megaphone", label: "Megaphone", icon: Megaphone, tags: ["announcement", "pa system", "broadcast"] },
    { value: "bell", label: "Bell", icon: Bell, tags: ["alarm", "notification", "alert"] },
    { value: "bellring", label: "Alarm Bell", icon: BellRing, tags: ["fire alarm", "emergency alarm"] },
  ]},
  { label: "Facilities", icons: [
    { value: "building", label: "Building", icon: Building2, tags: ["structure", "office", "facility"] },
    { value: "warehouse", label: "Warehouse", icon: Warehouse, tags: ["storage", "depot", "staging"] },
    { value: "tent", label: "Tent", icon: Tent, tags: ["temporary", "canopy", "shelter"] },
    { value: "coffee", label: "Break Area", icon: Coffee, tags: ["rest", "break room", "canteen"] },
    { value: "utensils", label: "Food", icon: UtensilsCrossed, tags: ["concessions", "catering", "kitchen"] },
    { value: "power", label: "Power", icon: Power, tags: ["generator", "electrical", "outlet"] },
    { value: "lightbulb", label: "Lighting", icon: Lightbulb, tags: ["light", "illumination", "lamp"] },
    { value: "package", label: "Storage", icon: Package, tags: ["supply", "equipment", "staging area"] },
  ]},
  { label: "Navigation", icons: [
    { value: "arrowup", label: "North", icon: ArrowUp, tags: ["direction", "up"] },
    { value: "arrowdown", label: "South", icon: ArrowDown, tags: ["direction", "down"] },
    { value: "arrowleft", label: "West", icon: ArrowLeft, tags: ["direction", "left"] },
    { value: "arrowright", label: "East", icon: ArrowRight, tags: ["direction", "right"] },
    { value: "compass", label: "Compass", icon: Compass, tags: ["orientation", "bearing"] },
    { value: "navigate", label: "Navigate", icon: Navigation, tags: ["route", "direction", "heading"] },
  ]},
  { label: "Terrain", icons: [
    { value: "tree", label: "Tree / Woods", icon: TreePine, tags: ["forest", "vegetation", "nature"] },
    { value: "mountain", label: "Mountain", icon: Mountain, tags: ["hill", "elevation", "terrain"] },
    { value: "waves", label: "Water", icon: Waves, tags: ["river", "lake", "ocean", "shore"] },
  ]},
];

// Flat lookup for rendering pins
const ICON_MAP: Record<string, LucideIcon> = {};
const ALL_ICONS: IconEntry[] = [];
for (const cat of ICON_CATEGORIES) {
  for (const entry of cat.icons) {
    ICON_MAP[entry.value] = entry.icon;
    ALL_ICONS.push(entry);
  }
}

const DEFAULT_COLORS = [
  "#d59b3c", // will be replaced by brand accent at render time
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#facc15",
  "#64748b",
];

/* ── Helpers ── */

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function PinIcon({
  icon,
  size = 16,
}: {
  icon: string;
  size?: number;
}) {
  const Comp = ICON_MAP[icon] ?? MapPin;
  return <Comp size={size} strokeWidth={2.5} />;
}

/* ── Icon Picker (searchable dropdown) ── */

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedEntry = ALL_ICONS.find(i => i.value === value);
  const SelectedIcon = ICON_MAP[value] ?? MapPin;

  const query = search.toLowerCase().trim();
  const filtered = query
    ? ALL_ICONS.filter(i => i.label.toLowerCase().includes(query) || i.tags.some(t => t.includes(query)))
    : null;

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">Icon</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-200 border transition-colors"
        style={{ background: "color-mix(in srgb, var(--brand-primary, #0d1520), #ffffff 8%)", borderColor: open ? "var(--brand-accent, #d59b3c)" : "var(--brand-primary-light, #1a2a3a)" }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded" style={{ background: "color-mix(in srgb, var(--brand-accent, #d59b3c), transparent 85%)", color: "var(--brand-accent, #d59b3c)" }}>
          <SelectedIcon size={14} strokeWidth={2.5} />
        </span>
        <span className="flex-1 text-left truncate">{selectedEntry?.label ?? value}</span>
        <ChevronDown size={12} className={cn("text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute z-[100] mt-1 w-full rounded-lg border overflow-hidden"
          style={{ background: "var(--brand-primary, #0d1520)", borderColor: "var(--brand-primary-light, #1a2a3a)", boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: "#1a2a3a" }}>
            <Search size={12} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-300" aria-label="Clear search">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Icon grid */}
          <div className="max-h-[200px] overflow-y-auto p-2 space-y-2">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="text-[10px] text-slate-600 text-center py-3">No icons found</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {filtered.map(entry => {
                    const Ic = entry.icon;
                    const active = value === entry.value;
                    return (
                      <button key={entry.value} type="button" title={entry.label}
                        onClick={() => { onChange(entry.value); setOpen(false); setSearch(""); }}
                        className={cn("flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                          active ? "border-[var(--brand-accent,#d59b3c)] bg-primary/15 text-primary" : "border-border bg-card text-slate-500 hover:text-slate-300 hover:border-slate-600"
                        )}>
                        <Ic size={14} strokeWidth={2.5} />
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              ICON_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1 px-0.5">{cat.label}</p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {cat.icons.map(entry => {
                      const Ic = entry.icon;
                      const active = value === entry.value;
                      return (
                        <button key={entry.value} type="button" title={entry.label}
                          onClick={() => { onChange(entry.value); setOpen(false); setSearch(""); }}
                          className={cn("flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                            active ? "border-[var(--brand-accent,#d59b3c)] bg-primary/15 text-primary" : "border-border bg-card text-slate-500 hover:text-slate-300 hover:border-slate-600"
                          )}>
                          <Ic size={14} strokeWidth={2.5} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pin Form (inline popover) ── */

type PinFormData = {
  label: string;
  description: string;
  icon: string;
  color: string;
};

function PinForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: PinFormData;
  onSubmit: (data: PinFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<PinFormData>(initial);

  return (
    <div
      className="flex flex-col gap-2.5 p-3 rounded-lg border min-w-[260px]"
      style={{
        background: "var(--brand-primary, #0d1520)",
        borderColor: "var(--brand-primary-light, #1a2a3a)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Label */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Label
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="e.g. Main entrance"
            autoFocus
            className="w-full rounded-md px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1"
            style={{
              background: "color-mix(in srgb, var(--brand-primary, #0d1520), #ffffff 8%)",
              border: "1px solid var(--brand-primary-light, #1a2a3a)",
            }}
            onFocus={(e) => (e.target.style.outlineColor = "var(--brand-accent, #d59b3c)")}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional details..."
          rows={2}
          className="w-full rounded-md px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none focus:ring-1"
          style={{
            background: "#111b2a",
            border: "1px solid #1a2a3a",
          }}
        />
      </div>

      {/* Icon select — searchable dropdown */}
      <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />

      {/* Color picker */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Color
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_COLORS.map((c) => {
            const active = form.color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform",
                  active
                    ? "border-white scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ background: c }}
              />
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!form.label.trim()}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
            form.label.trim()
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          )}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 border border-[#1a2a3a] hover:border-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function StoryboardEditor({
  imageUrl,
  pins,
  onPinsChange,
  readOnly = false,
  singlePinMode = false,
  defaultPinValues,
  className,
}: StoryboardEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [addMode, setAddMode] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [newPinPos, setNewPinPos] = useState<{ x: number; y: number } | null>(null);
  const [_popoverPos, setPopoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Dismiss selection when clicking outside
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAddMode(false);
        setSelectedPinId(null);
        setEditingPinId(null);
        setNewPinPos(null);
      }
      // WCAG 2.5.7: Arrow key nudging as alternative to drag
      if (selectedPinId && !readOnly && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.01; // Shift = bigger steps
        const updated = pins.map((p) => {
          if (p.id !== selectedPinId) return p;
          let { x, y } = p;
          if (e.key === "ArrowUp") y = Math.max(0, y - step);
          if (e.key === "ArrowDown") y = Math.min(1, y + step);
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          if (e.key === "ArrowRight") x = Math.min(1, x + step);
          return { ...p, x, y };
        });
        onPinsChange?.(updated);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPinId, readOnly, pins, onPinsChange]);

  const updatePins = useCallback(
    (next: StoryboardPin[]) => {
      onPinsChange?.(next);
    },
    [onPinsChange]
  );

  // Convert a mouse event on the container into 0-1 coordinates relative to the image
  const eventToPercent = useCallback(
    (e: React.MouseEvent): { x: number; y: number } | null => {
      const img = imageRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      return { x, y };
    },
    []
  );

  // Compute popover position to keep it in view
  const computePopoverPos = useCallback(
    (pxFraction: { x: number; y: number }): { left: number; top: number } => {
      const container = containerRef.current;
      if (!container) return { left: 0, top: 0 };
      const rect = container.getBoundingClientRect();
      const img = imageRef.current;
      if (!img) return { left: 0, top: 0 };
      const imgRect = img.getBoundingClientRect();
      const imgOffsetLeft = imgRect.left - rect.left;
      const imgOffsetTop = imgRect.top - rect.top;

      let left = imgOffsetLeft + pxFraction.x * imgRect.width + 20;
      let top = imgOffsetTop + pxFraction.y * imgRect.height - 20;

      // Keep popover within container
      if (left + 280 > rect.width) {
        left = imgOffsetLeft + pxFraction.x * imgRect.width - 290;
      }
      if (top + 300 > rect.height) {
        top = rect.height - 310;
      }
      if (top < 4) top = 4;
      if (left < 4) left = 4;

      return { left, top };
    },
    []
  );

  /* ── Image click: place pin ── */
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly || !addMode || draggingPinId) return;

      const pos = eventToPercent(e);
      if (!pos) return;

      if (singlePinMode && pins.length > 0) {
        // Replace the existing pin position and open editor for it
        const updated = [{ ...pins[0], x: pos.x, y: pos.y }];
        updatePins(updated);
        setEditingPinId(updated[0].id);
        setPopoverPos(computePopoverPos(pos));
        setNewPinPos(null);
        setAddMode(false);
        return;
      }

      setNewPinPos(pos);
      setPopoverPos(computePopoverPos(pos));
      setSelectedPinId(null);
      setEditingPinId(null);
    },
    [readOnly, addMode, draggingPinId, singlePinMode, pins, eventToPercent, computePopoverPos, updatePins]
  );

  /* ── Create new pin from form ── */
  const handleNewPinSubmit = useCallback(
    (data: PinFormData) => {
      if (!newPinPos) return;
      const newPin: StoryboardPin = {
        id: crypto.randomUUID(),
        x: newPinPos.x,
        y: newPinPos.y,
        label: data.label,
        description: data.description,
        icon: data.icon,
        color: data.color,
        timestamp: new Date().toISOString(),
      };

      if (singlePinMode) {
        updatePins([newPin]);
      } else {
        updatePins([...pins, newPin]);
      }

      setNewPinPos(null);
      setAddMode(false);
    },
    [newPinPos, singlePinMode, pins, updatePins]
  );

  /* ── Edit existing pin ── */
  const handleEditSubmit = useCallback(
    (data: PinFormData) => {
      if (!editingPinId) return;
      const next = pins.map((p) =>
        p.id === editingPinId
          ? { ...p, label: data.label, description: data.description, icon: data.icon, color: data.color }
          : p
      );
      updatePins(next);
      setEditingPinId(null);
      setSelectedPinId(null);
    },
    [editingPinId, pins, updatePins]
  );

  /* ── Delete pin ── */
  const handleDelete = useCallback(
    (id: string) => {
      updatePins(pins.filter((p) => p.id !== id));
      setSelectedPinId(null);
      setEditingPinId(null);
    },
    [pins, updatePins]
  );

  /* ── Pin click ── */
  const handlePinClick = useCallback(
    (e: React.MouseEvent, pin: StoryboardPin) => {
      e.stopPropagation();
      if (draggingPinId) return;
      setNewPinPos(null);
      setSelectedPinId((prev) => (prev === pin.id ? null : pin.id));
      setEditingPinId(null);
      setPopoverPos(computePopoverPos({ x: pin.x, y: pin.y }));
    },
    [draggingPinId, computePopoverPos]
  );

  /* ── Pin drag ── */
  // Track live drag position without triggering saves
  const [dragPos, setDragPos] = useState<{ pinId: string; x: number; y: number } | null>(null);

  const handlePinDragStart = useCallback(
    (e: React.MouseEvent, pinId: string) => {
      if (readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingPinId(pinId);
      setSelectedPinId(null);
      setEditingPinId(null);
      setNewPinPos(null);

      let lastX = 0, lastY = 0;

      const onMove = (me: MouseEvent) => {
        const img = imageRef.current;
        if (!img) return;
        const rect = img.getBoundingClientRect();
        lastX = clamp((me.clientX - rect.left) / rect.width, 0, 1);
        lastY = clamp((me.clientY - rect.top) / rect.height, 0, 1);
        // Visual update only (no save triggered)
        setDragPos({ pinId, x: lastX, y: lastY });
      };

      const onUp = () => {
        setDraggingPinId(null);
        setDragPos(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        // Commit final position — this triggers the save via onPinsChange
        if (lastX || lastY) {
          onPinsChange?.(pins.map((p) => (p.id === pinId ? { ...p, x: lastX, y: lastY } : p)));
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [readOnly, pins, onPinsChange]
  );

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;
  const editingPin = pins.find((p) => p.id === editingPinId) ?? null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Toolbar ── */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {addMode
              ? singlePinMode
                ? "Click the map to place a marker"
                : "Click the map to place a pin"
              : `${pins.length} pin${pins.length !== 1 ? "s" : ""} placed`}
          </div>
          <button
            type="button"
            onClick={() => {
              setAddMode(!addMode);
              setSelectedPinId(null);
              setEditingPinId(null);
              setNewPinPos(null);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
              addMode
                ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                : "bg-[#d59b3c]/15 text-[#d59b3c] border border-[#d59b3c]/30 hover:bg-[#d59b3c]/25"
            )}
          >
            {addMode ? (
              <>
                <X size={13} />
                Cancel
              </>
            ) : (
              <>
                <Plus size={13} />
                Add Pin
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Map Container ── */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-lg border select-none",
          addMode && "cursor-crosshair"
        )}
        style={{
          background: "#0a1018",
          borderColor: "#1a2a3a",
        }}
        onClick={handleImageClick}
      >
        {/* Site map image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Site map"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-auto block transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{ userSelect: "none" }}
        />

        {/* Loading placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="h-3.5 w-3.5 border-2 border-[#d59b3c] border-t-transparent rounded-full animate-spin" />
              Loading site map...
            </div>
          </div>
        )}

        {/* ── Pins overlay ── */}
        {imageLoaded &&
          pins.map((pin, idx) => {
            const IconComp = ICON_MAP[pin.icon] ?? MapPin;
            const isSelected = selectedPinId === pin.id;
            const isDragging = draggingPinId === pin.id;
            // Use live drag position during drag, otherwise use saved position
            const displayX = (isDragging && dragPos) ? dragPos.x : pin.x;
            const displayY = (isDragging && dragPos) ? dragPos.y : pin.y;

            return (
              <div
                key={pin.id}
                className={cn(
                  "absolute flex items-center justify-center",
                  isDragging ? "z-50 scale-110" : "z-20 transition-transform",
                  isSelected && "z-40",
                  !readOnly && "cursor-grab active:cursor-grabbing"
                )}
                style={{
                  left: `${displayX * 100}%`,
                  top: `${displayY * 100}%`,
                  transform: `translate(-50%, -50%)${isDragging ? " scale(1.15)" : ""}`,
                }}
                onClick={(e) => handlePinClick(e, pin)}
                onMouseDown={(e) => handlePinDragStart(e, pin.id)}
              >
                {/* Outer ring for selection */}
                {isSelected && (
                  <div
                    className="absolute w-10 h-10 rounded-full animate-ping"
                    style={{
                      background: pin.color,
                      opacity: 0.2,
                    }}
                  />
                )}

                {/* Pin marker */}
                <div
                  className={cn(
                    "relative flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-lg transition-shadow",
                    isSelected && "ring-2 ring-offset-1 ring-offset-[#0a1018]"
                  )}
                  style={{
                    background: pin.color,
                    borderColor: "rgba(255,255,255,0.25)",
                    boxShadow: `0 2px 8px ${pin.color}66, 0 0 0 ${isSelected ? "3" : "0"}px ${pin.color}44`,
                    outlineColor: pin.color,
                  }}
                >
                  <IconComp size={15} strokeWidth={2.5} className="text-white drop-shadow" />
                </div>

                {/* Index badge */}
                <div
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{
                    background: "#0d1520",
                    color: pin.color,
                    border: `1.5px solid ${pin.color}`,
                  }}
                >
                  {idx + 1}
                </div>
              </div>
            );
          })}

        {/* ── New pin preview (ghost) ── */}
        {newPinPos && imageLoaded && (
          <div
            className="absolute z-30 flex items-center justify-center pointer-events-none"
            style={{
              left: `${newPinPos.x * 100}%`,
              top: `${newPinPos.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center animate-pulse"
              style={{
                background: "#d59b3c",
                borderColor: "rgba(255,255,255,0.3)",
                boxShadow: "0 2px 12px rgba(213,155,60,0.5)",
              }}
            >
              <Plus size={15} className="text-white" />
            </div>
          </div>
        )}

        {/* ── New pin form popover (rendered as fixed overlay to avoid clipping) ── */}
        {/* eslint-disable-next-line react-hooks/refs -- Popover position requires synchronous DOM measurement */}
        {newPinPos && imageLoaded && (() => {
          const container = containerRef.current;
          const cRect = container?.getBoundingClientRect();
          const img = imageRef.current;
          const iRect = img?.getBoundingClientRect();
          if (!cRect || !iRect) return null;
          // Calculate screen position of the pin
          const pinScreenX = iRect.left + newPinPos.x * iRect.width;
          const pinScreenY = iRect.top + newPinPos.y * iRect.height;
          // Position popover: prefer right/below the pin, flip if near edges
          const popW = 288, popH = 380;
          let left = pinScreenX + 20;
          let top = pinScreenY - 20;
          if (left + popW > window.innerWidth - 8) left = pinScreenX - popW - 10;
          if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
          if (top < 8) top = 8;
          if (left < 8) left = 8;
          return (
            <div className="fixed z-[200]" style={{ left, top }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <PinForm
                initial={{ label: defaultPinValues?.label ?? "", description: defaultPinValues?.description ?? "", icon: defaultPinValues?.icon ?? "pin", color: defaultPinValues?.color ?? "#d59b3c" }}
                onSubmit={handleNewPinSubmit}
                onCancel={() => { setNewPinPos(null); setAddMode(false); }}
                submitLabel="Place Pin"
              />
            </div>
          );
        })()}

        {/* ── Selected pin detail popover (fixed to avoid clipping) ── */}
        {/* eslint-disable-next-line react-hooks/refs -- Popover position requires synchronous DOM measurement */}
        {selectedPin && !editingPinId && imageLoaded && (() => {
          const img = imageRef.current;
          const iRect = img?.getBoundingClientRect();
          if (!iRect) return null;
          const pinScreenX = iRect.left + selectedPin.x * iRect.width;
          const pinScreenY = iRect.top + selectedPin.y * iRect.height;
          const popW = 240, popH = 200;
          let left = pinScreenX + 20;
          let top = pinScreenY - 20;
          if (left + popW > window.innerWidth - 8) left = pinScreenX - popW - 10;
          if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
          if (top < 8) top = 8;
          if (left < 8) left = 8;
          return (
          <div
            className="fixed z-[200]"
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-lg border p-3 min-w-[220px]"
              style={{
                background: "#0d1520",
                borderColor: "#1a2a3a",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedPin.color }}
                  >
                    <PinIcon icon={selectedPin.icon} size={12} />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">
                    {selectedPin.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPinId(null)}
                  className="text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {selectedPin.description && (
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                  {selectedPin.description}
                </p>
              )}

              {selectedPin.timestamp && (
                <p className="text-[10px] text-slate-600 mb-2">
                  {new Date(selectedPin.timestamp).toLocaleString()}
                  {selectedPin.createdBy && ` · ${selectedPin.createdBy}`}
                </p>
              )}

              {!readOnly && (
                <div className="flex items-center gap-2 pt-1 border-t border-[#1a2a3a]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPinId(selectedPin.id);
                      setSelectedPinId(null);
                    }}
                    className="flex-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#d59b3c] bg-[#d59b3c]/10 border border-[#d59b3c]/20 hover:bg-[#d59b3c]/20 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedPin.id)}
                    className="flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={11} className="mr-1" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ── Editing pin form popover (fixed to avoid clipping) ── */}
        {/* eslint-disable-next-line react-hooks/refs -- Popover position requires synchronous DOM measurement */}
        {editingPin && imageLoaded && (() => {
          const img = imageRef.current;
          const iRect = img?.getBoundingClientRect();
          if (!iRect) return null;
          const pinScreenX = iRect.left + editingPin.x * iRect.width;
          const pinScreenY = iRect.top + editingPin.y * iRect.height;
          const popW = 288, popH = 380;
          let left = pinScreenX + 20;
          let top = pinScreenY - 20;
          if (left + popW > window.innerWidth - 8) left = pinScreenX - popW - 10;
          if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
          if (top < 8) top = 8;
          if (left < 8) left = 8;
          return (
            <div className="fixed z-[200]" style={{ left, top }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <PinForm
                initial={{
                  label: editingPin.label,
                  description: editingPin.description,
                  icon: editingPin.icon,
                  color: editingPin.color,
                }}
                onSubmit={handleEditSubmit}
                onCancel={() => { setEditingPinId(null); }}
                submitLabel="Save"
              />
            </div>
          );
        })()}

        {/* ── Add-mode overlay hint ── */}
        {addMode && !newPinPos && imageLoaded && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div
              className="rounded-full px-4 py-2 text-xs font-medium backdrop-blur-sm"
              style={{
                background: "rgba(13,21,32,0.75)",
                color: "#d59b3c",
                border: "1px solid rgba(213,155,60,0.3)",
              }}
            >
              Click anywhere on the map to place a pin
            </div>
          </div>
        )}
      </div>

      {/* ── Pin List ── */}
      {pins.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{
            background: "#0d1520",
            borderColor: "#1a2a3a",
          }}
        >
          <div
            className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            style={{ borderColor: "#1a2a3a" }}
          >
            Pin Legend ({pins.length})
          </div>
          <div className="divide-y" style={{ borderColor: "#1a2a3a" }}>
            {pins.map((pin, idx) => {
              const isActive = selectedPinId === pin.id || editingPinId === pin.id;
              return (
                <div
                  key={pin.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer",
                    isActive
                      ? "bg-[#d59b3c]/5"
                      : "hover:bg-white/[0.02]"
                  )}
                  style={{ borderColor: "#1a2a3a" }}
                  onClick={() => {
                    setSelectedPinId(pin.id);
                    setEditingPinId(null);
                    setNewPinPos(null);
                    setPopoverPos(computePopoverPos({ x: pin.x, y: pin.y }));
                  }}
                >
                  {/* Drag handle */}
                  {!readOnly && (
                    <GripVertical size={12} className="text-slate-700 flex-shrink-0" />
                  )}

                  {/* Number badge */}
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: `${pin.color}22`,
                      color: pin.color,
                      border: `1px solid ${pin.color}44`,
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Icon */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: pin.color }}
                  >
                    <PinIcon icon={pin.icon} size={12} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {pin.label}
                    </div>
                    {pin.description && (
                      <div className="text-xs text-slate-500 truncate">
                        {pin.description}
                      </div>
                    )}
                  </div>

                  {/* Coordinates */}
                  <div className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                    {(pin.x * 100).toFixed(0)}%, {(pin.y * 100).toFixed(0)}%
                  </div>

                  {/* Delete button */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(pin.id);
                      }}
                      className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
