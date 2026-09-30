"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false }
);

export function CommandPaletteShell() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPublicOpen, setIsPublicOpen] = useState(false);

  const openPalette = useCallback(() => {
    setIsLoaded(true);
    setIsPublicOpen(true);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsLoaded(true);
        setIsPublicOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <CommandPaletteTrigger onOpen={openPalette} />
      {isLoaded && (
        <CommandPalette open={isPublicOpen} onClose={() => setIsPublicOpen(false)} />
      )}
    </>
  );
}

