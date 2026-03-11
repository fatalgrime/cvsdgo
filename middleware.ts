import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccessProfile } from "@/lib/access";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  if (!userId) return;

  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/access-denied") || pathname.startsWith("/sign-in")) return;

  const requiresStaff =
    pathname.startsWith("/site/link-manager") ||
    pathname.startsWith("/site/users") ||
    pathname.startsWith("/api/links") ||
    pathname.startsWith("/api/link-folders") ||
    pathname.startsWith("/api/admin/users");

  if (!requiresStaff) return;

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
