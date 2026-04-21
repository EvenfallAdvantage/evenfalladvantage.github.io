"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

import type { StoryboardPin, StoryboardEditorProps, PinFormData } from "./storyboard/types";
import { ICON_MAP } from "./storyboard/icon-catalog";
import { clamp } from "./storyboard/utils";
import { PinForm } from "./storyboard/pin-form";
import { PinLegend } from "./storyboard/pin-legend";
import { PinDetailPopover } from "./storyboard/pin-detail-popover";

// Re-export types so existing consumers keep working
export type { StoryboardPin, StoryboardEditorProps };

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
            <PinDetailPopover
              pin={selectedPin}
              readOnly={readOnly}
              onClose={() => setSelectedPinId(null)}
              onEdit={() => {
                setEditingPinId(selectedPin.id);
                setSelectedPinId(null);
              }}
              onDelete={() => handleDelete(selectedPin.id)}
            />
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
      <PinLegend
        pins={pins}
        selectedPinId={selectedPinId}
        editingPinId={editingPinId}
        readOnly={readOnly}
        onSelectPin={(pin) => {
          setSelectedPinId(pin.id);
          setEditingPinId(null);
          setNewPinPos(null);
          setPopoverPos(computePopoverPos({ x: pin.x, y: pin.y }));
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
