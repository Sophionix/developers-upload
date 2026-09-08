"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { AppModal } from "@/components/ui/app-modal";
import { toast } from "@/components/ui/toast";
import {
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Shield,
  Trash2,
  type LucideIcon,
} from "@/lib/ui/icons";
import { updateNotificationPrefs } from "@/server/actions/preferences";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { changePassword } from "@/server/actions/settings";
import { requestAccountDeletion } from "@/server/actions/gdpr";

type SettingsLinkItem = {
  type: "link";
  icon: LucideIcon;
  label: string;
  href: string;
};

type SettingsToggleItem = {
  type: "toggle";
  icon: LucideIcon;
  label: string;
  key: string;
};

type SettingsActionItem = {
  type: "action";
  icon: LucideIcon;
  label: string;
  actionKey: string;
};

type SettingsItem = SettingsLinkItem | SettingsToggleItem | SettingsActionItem;

const SETTINGS_ITEMS: SettingsItem[] = [
  { type: "toggle", icon: Bell, label: "Push Notifications", key: "pushNotifications" },
  { type: "link", icon: FileText, label: "Terms & Conditions", href: "/settings/terms" },
  { type: "link", icon: Shield, label: "Privacy Policy", href: "/settings/privacy" },
  { type: "link", icon: Info, label: "About App", href: "/settings/about" },
  { type: "link", icon: HelpCircle, label: "Help & Feedback", href: "/settings/help" },
  { type: "action", icon: Lock, label: "Change Password", actionKey: "changePassword" },
  { type: "action", icon: Trash2, label: "Delete Account", actionKey: "deleteAccount" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [toggles, setToggles] = React.useState<Record<string, boolean>>({
    pushNotifications: true,
  });
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    existing: "",
    newPassword: "",
    confirm: "",
  });
  const [pwPending, startPwTransition] = React.useTransition();
  const [delPending, startDelTransition] = React.useTransition();
  const { isSupported, permission, requestPermission, isRegistering } = usePushNotifications();

  function handleAction(key: string) {
    if (key === "changePassword") setShowChangePassword(true);
    if (key === "deleteAccount") setShowDeleteAccount(true);
  }

  async function handleToggle(key: string, checked: boolean) {
    setToggles((prev) => ({ ...prev, [key]: checked }));
    if (key === "pushNotifications") {
      try {
        if (checked && isSupported && permission !== "granted") {
          await requestPermission();
        }
        await updateNotificationPrefs({ remindersEnabled: checked });
      } catch {
        setToggles((prev) => ({ ...prev, [key]: !checked }));
        toast.error("Failed to update notification preference.");
      }
    }
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    startPwTransition(async () => {
      try {
        await changePassword({
          existingPassword: passwordForm.existing,
          newPassword: passwordForm.newPassword,
        });
        toast.success("Password changed successfully.");
        setShowChangePassword(false);
        setPasswordForm({ existing: "", newPassword: "", confirm: "" });
      } catch (err) {
        const code = err instanceof Error && "code" in err
          ? (err as Error & { code: string }).code
          : null;
        if (code === "INVALID_PASSWORD") {
          toast.error("Current password is incorrect.");
        } else {
          toast.error("Failed to change password.");
        }
      }
    });
  }

  function handleDeleteAccount() {
    startDelTransition(async () => {
      try {
        await requestAccountDeletion();
        toast.success("Account deletion requested. You will be logged out.");
        router.push("/login");
      } catch {
        toast.error("Failed to request account deletion.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />

      <div className="flex w-full max-w-2xl flex-col gap-3">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon;

          if (item.type === "toggle") {
            return (
              <div
                key={item.key}
                className="flex h-14 items-center gap-3 rounded-pill border border-white/10 bg-surface px-4"
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {item.label}
                </span>
                {item.key === "pushNotifications" && isRegistering ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={toggles[item.key] ?? false}
                    onCheckedChange={(checked) => handleToggle(item.key, checked)}
                  />
                )}
              </div>
            );
          }

          if (item.type === "action") {
            return (
              <button
                key={item.actionKey}
                type="button"
                onClick={() => handleAction(item.actionKey)}
                className="flex h-14 items-center gap-3 rounded-pill border border-white/10 bg-surface px-4 transition-colors hover:bg-white/10"
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-14 items-center gap-3 rounded-pill border border-white/10 bg-surface px-4 transition-colors hover:bg-white/10"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">
                {item.label}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {showChangePassword ? (
        <AppModal
          title="Change Password"
          onClose={() => setShowChangePassword(false)}
        >
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-pill border border-white/20 bg-surface px-4 py-3">
              <Lock className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="password"
                placeholder="Existing Password"
                value={passwordForm.existing}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, existing: e.target.value }))
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            <div className="flex items-center gap-3 rounded-pill border border-white/20 bg-surface px-4 py-3">
              <Lock className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="password"
                placeholder="New Password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            <div className="flex items-center gap-3 rounded-pill border border-white/20 bg-surface px-4 py-3">
              <Lock className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={pwPending}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-pill bg-btn-brand py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pwPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Change Now
            </button>
          </form>
        </AppModal>
      ) : null}

      {showDeleteAccount ? (
        <AppModal
          title="Delete"
          showClose={false}
          onClose={() => setShowDeleteAccount(false)}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-full bg-red-600 shadow-[0_0_24px_rgba(239,68,68,0.5)]">
              <Trash2 className="size-8 text-white" />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Are you sure you want to delete
              <br />
              this account?
            </p>

            <div className="flex w-full gap-3">
              <button
                type="button"
                disabled={delPending}
                onClick={handleDeleteAccount}
                className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
              >
                {delPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Delete
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteAccount(false)}
                className="flex-1 rounded-pill bg-btn-brand py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Cancel
              </button>
            </div>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}
