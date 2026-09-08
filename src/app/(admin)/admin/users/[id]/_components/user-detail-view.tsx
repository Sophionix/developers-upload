"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  BookOpen,
  Layers,
  Heart,
  Smartphone,
  Mail,
  Clock,
  Shield,
  User,
} from "@/lib/ui/icons";
import type { AdminUserDetailDto } from "@/lib/dto/admin-user";
import type { AdminUserStatsDto } from "@/server/actions/admin/users";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ROLE_VARIANT = {
  SUPER_ADMIN: "destructive",
  CONTENT_MANAGER: "accent",
  USER: "muted",
} as const;

const STATUS_VARIANT = {
  ACTIVE: "success",
  DEACTIVATED: "warning",
  PENDING_DELETION: "destructive",
} as const;

interface Props {
  user: AdminUserDetailDto;
  stats: AdminUserStatsDto;
}

export function UserDetailView({ user, stats }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={user.fullName || user.email}
        description="User profile details"
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/users", label: "Users" },
          { label: user.fullName || user.email },
        ]}
      />

      {/* User info + stats grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={User} label="Full Name" value={user.fullName || "—"} />
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow
                icon={Shield}
                label="Role"
                value={
                  <Badge variant={ROLE_VARIANT[user.role] ?? "muted"}>
                    {user.role.replace(/_/g, " ")}
                  </Badge>
                }
              />
              <InfoRow
                icon={Shield}
                label="Status"
                value={
                  <Badge variant={STATUS_VARIANT[user.status] ?? "muted"}>
                    {user.status.replace(/_/g, " ")}
                  </Badge>
                }
              />
              <InfoRow icon={Clock} label="Joined" value={fmtDate(user.createdAt)} />
              <InfoRow icon={Clock} label="Last Login" value={fmtDate(user.lastLoginAt)} />
              <InfoRow icon={Clock} label="Email Verified" value={fmtDate(user.emailVerifiedAt)} />
              <InfoRow icon={Shield} label="2FA Enabled" value={user.totpEnabled ? "Yes" : "No"} />
              <InfoRow icon={Shield} label="Onboarding" value={user.hasCompletedOnboarding ? "Complete" : "Pending"} />
              <InfoRow icon={Clock} label="Terms Accepted" value={fmtDate(user.consentTermsAt)} />
              {user.timezone ? (
                <InfoRow icon={Clock} label="Timezone" value={user.timezone} />
              ) : null}
              {user.lastLoginIp ? (
                <InfoRow icon={Shield} label="Last Login IP" value={user.lastLoginIp} />
              ) : null}
              {user.stripeCustomerId ? (
                <InfoRow icon={Shield} label="Stripe Customer" value={user.stripeCustomerId} />
              ) : null}
            </div>

            {/* Subscription */}
            {user.subscriptionTier ? (
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Subscription:</span>
                <Badge variant="accent">{user.subscriptionTier}</Badge>
                <Badge variant={user.subscriptionStatus === "ACTIVE" ? "success" : "muted"}>
                  {user.subscriptionStatus}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="flex flex-col gap-4">
          <StatCard
            icon={BookOpen}
            label="Journal Entries"
            value={stats.totalJournalEntries}
          />
          <StatCard
            icon={Layers}
            label="Card Draws"
            value={stats.totalCardDraws}
          />
          <StatCard
            icon={Heart}
            label="Saved Cards"
            value={stats.totalSavedCards}
          />
        </div>
      </div>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No registered devices.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Platform</th>
                    <th className="pb-2 font-medium">Device ID</th>
                    <th className="pb-2 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.devices.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 text-foreground">
                        <span className="flex items-center gap-2">
                          <Smartphone className="size-4 text-muted-foreground" />
                          {d.platform ?? "Unknown"}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {d.deviceId ?? "—"}
                      </td>
                      <td className="py-2 text-foreground">
                        {timeAgo(d.lastSeenAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-2xl text-foreground">
            {value.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
