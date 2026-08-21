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

    const initIntercom = () => {
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
          // Retrieve the signed JWT for Intercom Identity Verification
          fetch("/api/intercom-token")
            .then((res) => {
              if (!res.ok) throw new Error("Failed to fetch Intercom token");
              return res.json();
            })
            .then(({ token }) => {
              const email = user.emailAddresses[0]?.emailAddress || "";
              const name = user.fullName || user.username || "";
              const createdAt = user.createdAt ? Math.floor(new Date(user.createdAt).getTime() / 1000) : undefined;

              Intercom({
                app_id: appId,
                intercom_user_jwt: token,
                user_id: user.id,
                name,
                email,
                created_at: createdAt,
                hide_default_launcher: false,
              });
            })
            .catch((e) => {
              console.error("Failed to initialize Intercom session:", e);
            });
        } else {
          // For anonymous visitors, boot Intercom but hide the launcher (banners/messages are still visible)
          Intercom({
            app_id: appId,
            hide_default_launcher: true,
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
    };

    if ("requestIdleCallback" in window) {
      const handle = (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(initIntercom);
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
        }
      };
    } else {
      const timer = setTimeout(initIntercom, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoaded]);

  return null;
}
