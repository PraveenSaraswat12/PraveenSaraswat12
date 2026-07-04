// Type-only import from the standalone enums module keeps this file
// Edge-safe (it is imported by middleware) — no Prisma runtime is pulled in.
import type { Role } from "@/generated/prisma/enums";

// Where each role lands after login / when hitting "/".
export const ROLE_HOME: Record<Role, string> = {
  OPS_EXEC: "/dashboard",
  OPS_LEAD: "/leadership",
  FINANCE: "/finance",
  VENDOR: "/vendor",
};

// Route-prefix → roles allowed. Anything not listed is allowed to any
// authenticated user (e.g. "/", "/account"). Keep this file free of React /
// icon imports so it is safe to import from Edge middleware.
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: ["OPS_EXEC", "OPS_LEAD", "FINANCE"] },
  { prefix: "/leadership", roles: ["OPS_LEAD"] },
  { prefix: "/finance", roles: ["FINANCE", "OPS_LEAD"] },
  { prefix: "/vendor", roles: ["VENDOR", "OPS_LEAD"] },
  { prefix: "/uploads", roles: ["OPS_EXEC", "OPS_LEAD"] },
  { prefix: "/email", roles: ["OPS_EXEC", "OPS_LEAD", "FINANCE"] },
];

export function routeMatch(path: string) {
  return ROUTE_ACCESS.find(
    (r) => path === r.prefix || path.startsWith(r.prefix + "/")
  );
}

export function canAccess(role: Role, path: string): boolean {
  const match = routeMatch(path);
  if (!match) return true;
  return match.roles.includes(role);
}

export function defaultPathForRole(role: Role | undefined): string {
  return (role && ROLE_HOME[role]) || "/dashboard";
}

export const ROLE_LABEL: Record<Role, string> = {
  OPS_EXEC: "Ops Execution",
  OPS_LEAD: "Ops Leadership",
  FINANCE: "Finance",
  VENDOR: "Vendor",
};
