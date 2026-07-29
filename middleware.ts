import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccessProfile } from "@/lib/access";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  if (!userId) return;

  const pathname = req.nextUrl.pathname;

  // Never block the auth / error pages themselves.
  if (pathname.startsWith("/access-denied") || pathname.startsWith("/sign-in")) return;

  // Only perform the (potentially costly) access-profile lookup for routes that
  // actually require staff privileges. All other authenticated paths are allowed
  // to pass through; individual API routes perform their own auth checks.
  //
  // NOTE: /api/admin/settings and /api/admin/policies are intentionally included
  // here as a defence-in-depth measure — their route handlers also verify access,
  // but the middleware provides an early rejection before any handler logic runs.
  const requiresStaff =
    pathname.startsWith("/site/link-manager") ||
    pathname.startsWith("/site/users") ||
    pathname.startsWith("/api/links") ||
    pathname.startsWith("/api/link-folders") ||
    pathname.startsWith("/api/admin/users") ||
    pathname.startsWith("/api/admin/settings") ||
    pathname.startsWith("/api/admin/policies");

  if (!requiresStaff) return;

  // getAccessProfile uses a short-lived in-process cache so repeated calls
  // within the same serverless instance (middleware + layout + API route) are
  // collapsed into a single Clerk API round trip.
  const access = await getAccessProfile(userId);
  const allowed = access.canManageLinks;

  if (!allowed) {
    if (pathname.startsWith("/api")) {
      return new Response("Forbidden", { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/access-denied";
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
