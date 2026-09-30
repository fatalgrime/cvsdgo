"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";

const PublicCommandPalette = dynamic(
  () => import("@/components/public-command-palette").then((module) => module.PublicCommandPalette),
  { ssr: false }
);

export function CommandPaletteShell({ isStaff }: { isStaff: boolean }) {
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
        <PublicCommandPalette open={isPublicOpen} onClose={() => setIsPublicOpen(false)} staffMode={isStaff} />
      )}
    </>
  );
}

