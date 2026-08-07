"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Intercom, { shutdown, update } from "@intercom/messenger-js-sdk";

export function IntercomProvider() {
  const { user, isLoaded } = useUser();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;

    const appId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
    if (!appId) {
      console.warn(
        "Intercom App ID is missing. Please set NEXT_PUBLIC_INTERCOM_APP_ID in your environment variables."
      );
      return;
    }

    const currentUserId = user?.id || null;

    // Check if user authentication session state has changed
    if (prevUserIdRef.current !== currentUserId) {
      if (prevUserIdRef.current !== undefined) {
        // Shutdown previous session to clear old user data
        try {
          shutdown();
        } catch (e) {
          console.error("Intercom shutdown error:", e);
        }
      }

      if (user) {
        // Extract authenticated session details
        const email = user.emailAddresses[0]?.emailAddress || "";
        const name = user.fullName || user.username || "";
        const createdAt = user.createdAt ? Math.floor(new Date(user.createdAt).getTime() / 1000) : undefined;

        Intercom({
          app_id: appId,
          user_id: user.id,
          name,
          email,
          created_at: createdAt,
        });
      } else {
        // Handle anonymous visitor session
        Intercom({
          app_id: appId,
        });
      }

      prevUserIdRef.current = currentUserId;
    } else {
      // Refresh messenger on URL/routing updates
      try {
        update({});
      } catch (e) {
        console.error("Intercom update error:", e);
      }
    }
  }, [user, isLoaded]);

  return null;
}
