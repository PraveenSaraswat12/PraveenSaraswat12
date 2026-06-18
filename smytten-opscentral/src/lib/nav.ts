import {
  LayoutDashboard,
  Gauge,
  Wallet,
  FileBarChart,
  Upload,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Courier Intelligence",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["OPS_EXEC", "OPS_LEAD", "FINANCE"],
  },
  {
    label: "Leadership",
    href: "/leadership",
    icon: Gauge,
    roles: ["OPS_LEAD"],
  },
  {
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    roles: ["FINANCE", "OPS_LEAD"],
  },
  {
    label: "Vendor SLA",
    href: "/vendor",
    icon: FileBarChart,
    roles: ["VENDOR", "OPS_LEAD"],
  },
  {
    label: "CSV Uploads",
    href: "/uploads",
    icon: Upload,
    roles: ["OPS_EXEC", "OPS_LEAD"],
  },
  {
    label: "Email Intelligence",
    href: "/email",
    icon: Mail,
    roles: ["OPS_EXEC", "OPS_LEAD", "FINANCE"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
