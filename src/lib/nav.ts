import {
  LayoutDashboard,
  BookOpen,
  Library,
  CreditCard,
  Mic,
  Settings,
  Bookmark,
  Sparkles,
  User as UserIcon,
  Bell,
  Receipt,
  BadgeCheck,
  Shield,
  type LucideIcon,
} from "@/lib/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true the link is visible but non-interactive (used for guest previews). */
  disabled?: boolean;
};

/** Guest-facing app navigation — Card Library only (legacy shell default). */
export const GUEST_NAV: NavItem[] = [
  { href: "/cards", label: "Card Library", icon: Library },
];

/**
 * Guest in-app routes under `/guest/*` — matches Sophionix guest dashboard Figma
 * (Dashboard + Card Library enabled; other items locked until signup).
 */
export const GUEST_APP_NAV: NavItem[] = [
  { href: "/guest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/guest/journal", label: "Journal", icon: BookOpen, disabled: true },
  { href: "/guest/cards", label: "Card Library", icon: Library, disabled: true },
  { href: "/guest/billing", label: "Subscriptions", icon: CreditCard, disabled: true },
  { href: "/guest/recordings", label: "My Recordings", icon: Mic, disabled: true },
  { href: "/guest/settings", label: "Settings", icon: Settings, disabled: true },
  { href: "/guest/saved", label: "Saved Cards", icon: Bookmark, disabled: true },
];

/** User-facing app navigation (left sidebar in AppShell). */
export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/cards", label: "Card Library", icon: Library },
  { href: "/billing", label: "Subscriptions", icon: CreditCard },
  { href: "/recordings", label: "My Recordings", icon: Mic },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/saved", label: "Saved Cards", icon: Bookmark },
];

/** Admin operator navigation (left sidebar in AdminShell). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UserIcon },
  { href: "/admin/content", label: "Content", icon: Library },
  { href: "/admin/scheduler", label: "Scheduler", icon: Sparkles },
  { href: "/admin/campaigns", label: "Campaigns", icon: Bell },
  { href: "/admin/billing", label: "Billing & Webhooks", icon: Receipt },
  { href: "/admin/coupons", label: "Coupons", icon: BadgeCheck },
  { href: "/admin/analytics", label: "Analytics", icon: LayoutDashboard },
  { href: "/admin/audit", label: "Audit Log", icon: Shield },
  { href: "/admin/settings", label: "System", icon: Settings },
];
