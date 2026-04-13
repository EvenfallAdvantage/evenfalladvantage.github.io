"use client";

interface QuickDMModalProps {
  dmTarget: { userId: string; name: string };
  dmText: string;
  dmSending: boolean;
  onTextChange: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export function QuickDMModal({ dmTarget, dmText, dmSending, onTextChange, onSend, onClose }: QuickDMModalProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-80 rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)", border: "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">💬 Message {dmTarget.name}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xs">✕</button>
        </div>
        <div className="p-4">
          <textarea
            className="w-full h-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 font-mono resize-none focus:outline-none focus:border-white/30"
            placeholder={`Type a message to ${dmTarget.name.split(" ")[0]}...`}
            value={dmText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && dmText.trim()) {
                e.preventDefault();
                onSend();
              }
            }}
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <button
              onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                  const lat = pos.coords.latitude.toFixed(6);
                  const lng = pos.coords.longitude.toFixed(6);
                  onTextChange(dmText + `\n📍 ${lat}, ${lng}`);
                }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
              }}
              className="text-[10px] text-white/30 hover:text-white/60"
              title="Attach my location"
            >
              📍 Location
            </button>
            <button
              onClick={() => {
                if (!dmText.trim() || dmSending) return;
                onSend();
              }}
              disabled={!dmText.trim() || dmSending}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: dmText.trim() ? "var(--brand-accent, #d59b3c)" : "transparent",
                color: dmText.trim() ? "#000" : "rgba(255,255,255,0.2)",
                border: dmText.trim() ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {dmSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
