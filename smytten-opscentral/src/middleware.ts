import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccess, defaultPathForRole } from "@/lib/rbac";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role;
    const path = req.nextUrl.pathname;

    // "/" sends each role to its home dashboard.
    if (path === "/") {
      const url = req.nextUrl.clone();
      url.pathname = defaultPathForRole(role);
      return NextResponse.redirect(url);
    }

    // Role-based section gating. Unauthorised access bounces to the role home.
    if (role && !canAccess(role, path)) {
      const url = req.nextUrl.clone();
      url.pathname = defaultPathForRole(role);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Protect everything except the login page, NextAuth endpoints, and static
// assets. API routes do their own session checks (see lib/session.ts).
export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
