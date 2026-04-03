"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  DoorOpen,
  Camera,
  ShieldAlert,
  Heart,
  Flame,
  User,
  Radio,
  Car,
  Star,
  Plus,
  Trash2,
  GripVertical,
  X,
} from "lucide-react";
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
  className?: string;
};

/* ── Icon map ── */

const ICON_MAP: Record<string, typeof MapPin> = {
  pin: MapPin,
  gate: DoorOpen,
  camera: Camera,
  incident: ShieldAlert,
  medical: Heart,
  fire: Flame,
  personnel: User,
  radio: Radio,
  car: Car,
  star: Star,
  exit: DoorOpen,
};

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "pin", label: "Pin" },
  { value: "gate", label: "Gate" },
  { value: "camera", label: "Camera" },
  { value: "incident", label: "Incident" },
  { value: "medical", label: "Medical" },
  { value: "fire", label: "Fire" },
  { value: "personnel", label: "Personnel" },
  { value: "radio", label: "Radio" },
  { value: "car", label: "Vehicle" },
  { value: "star", label: "Star" },
  { value: "exit", label: "Exit" },
];

const DEFAULT_COLORS = [
  "#d59b3c",
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
        background: "#0d1520",
        borderColor: "#1a2a3a",
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
            background: "#111b2a",
            borderColor: "#1a2a3a",
            border: "1px solid #1a2a3a",
          }}
          onFocus={(e) => (e.target.style.ringColor = "#d59b3c")}
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

      {/* Icon select */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Icon
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map((opt) => {
            const active = form.icon === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm({ ...form, icon: opt.value })}
                title={opt.label}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                  active
                    ? "border-[#d59b3c] bg-[#d59b3c]/15 text-[#d59b3c]"
                    : "border-[#1a2a3a] bg-[#111b2a] text-slate-500 hover:text-slate-300 hover:border-slate-600"
                )}
              >
                <PinIcon icon={opt.value} size={14} />
              </button>
            );
          })}
        </div>
      </div>

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
              ? "bg-[#d59b3c] text-black hover:bg-[#e5ab4c]"
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
  className,
}: StoryboardEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [addMode, setAddMode] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [newPinPos, setNewPinPos] = useState<{ x: number; y: number } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
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
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
  const handlePinDragStart = useCallback(
    (e: React.MouseEvent, pinId: string) => {
      if (readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingPinId(pinId);
      setSelectedPinId(null);
      setEditingPinId(null);
      setNewPinPos(null);

      const onMove = (me: MouseEvent) => {
        const img = imageRef.current;
        if (!img) return;
        const rect = img.getBoundingClientRect();
        const x = clamp((me.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((me.clientY - rect.top) / rect.height, 0, 1);
        // Live update
        const next = pins.map((p) => (p.id === pinId ? { ...p, x, y } : p));
        updatePins(next);
      };

      const onUp = () => {
        setDraggingPinId(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [readOnly, pins, updatePins]
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
          "relative rounded-lg border overflow-hidden select-none",
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

            return (
              <div
                key={pin.id}
                className={cn(
                  "absolute flex items-center justify-center transition-transform",
                  isDragging ? "z-50 scale-110" : "z-20",
                  isSelected && "z-40",
                  !readOnly && "cursor-grab active:cursor-grabbing"
                )}
                style={{
                  left: `${pin.x * 100}%`,
                  top: `${pin.y * 100}%`,
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
                    ringColor: pin.color,
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

        {/* ── New pin form popover ── */}
        {newPinPos && imageLoaded && (
          <div
            className="absolute z-[60]"
            style={{
              left: popoverPos.left,
              top: popoverPos.top,
            }}
          >
            <PinForm
              initial={{
                label: "",
                description: "",
                icon: "pin",
                color: "#d59b3c",
              }}
              onSubmit={handleNewPinSubmit}
              onCancel={() => {
                setNewPinPos(null);
                setAddMode(false);
              }}
              submitLabel="Place Pin"
            />
          </div>
        )}

        {/* ── Selected pin detail popover ── */}
        {selectedPin && !editingPinId && imageLoaded && (
          <div
            className="absolute z-[60]"
            style={{
              left: popoverPos.left,
              top: popoverPos.top,
            }}
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
        )}

        {/* ── Editing pin form popover ── */}
        {editingPin && imageLoaded && (
          <div
            className="absolute z-[60]"
            style={{
              left: popoverPos.left,
              top: popoverPos.top,
            }}
          >
            <PinForm
              initial={{
                label: editingPin.label,
                description: editingPin.description,
                icon: editingPin.icon,
                color: editingPin.color,
              }}
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setEditingPinId(null);
              }}
              submitLabel="Save"
            />
          </div>
        )}

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
