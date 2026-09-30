"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ClientAccessProfile = {
  authenticated: boolean;
  allowlisted: boolean;
  admin: boolean;
  reportStaff: boolean;
  canManageLinks: boolean;
  canManageReports: boolean;
};

const AccessContext = createContext<ClientAccessProfile | null>(null);

export function AccessProvider({ profile, children }: { profile: ClientAccessProfile; children: ReactNode }) {
  return <AccessContext.Provider value={profile}>{children}</AccessContext.Provider>;
}

export function useAccessProfile(): ClientAccessProfile {
  const profile = useContext(AccessContext);
  if (!profile) {
    throw new Error("useAccessProfile must be used inside AccessProvider");
  }
  return profile;
}
