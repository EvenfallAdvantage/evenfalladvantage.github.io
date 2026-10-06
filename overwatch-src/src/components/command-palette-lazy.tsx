"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// cmdk + the dialog primitives are only needed once someone presses
// Cmd/Ctrl+K, so keep them out of every page's first-load JS.
const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

export function LazyCommandPalette() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setLoaded(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [loaded]);

  // After the first shortcut press the real palette mounts (already open)
  // and handles Cmd/Ctrl+K itself from then on.
  return loaded ? <CommandPalette defaultOpen /> : null;
}
