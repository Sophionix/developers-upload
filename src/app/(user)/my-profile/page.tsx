"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/server/actions/profile";
import type { ProfileDto } from "@/server/actions/profile";

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-card px-6 pb-6 pt-8 animate-pulse">
      <div className="mb-6 flex flex-col gap-1">
        <div className="mb-2 size-20 rounded-full bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-48 rounded bg-white/10 mt-1" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between border-b border-white/10 py-3">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyProfilePage() {
  const [profile, setProfile] = React.useState<ProfileDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getProfile()
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Profile" backHref="/dashboard" className="pb-0" />

      {loading ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">Failed to load profile.</p>
      ) : (
        <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-card px-6 pb-6 pt-8">
          {/* Avatar + name */}
          <div className="mb-6 flex flex-col gap-1">
            <div className="mb-2 size-20 overflow-hidden rounded-full border-2 border-primary bg-muted">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-2xl font-bold text-muted-foreground">
                  {profile.fullName.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-base font-semibold text-foreground">
              {profile.fullName}
            </span>
            <span className="text-xs text-muted-foreground">
              {profile.email}
            </span>
          </div>

          {/* Info rows */}
          <div className="flex flex-col">
            <ProfileRow label="Full Name" value={profile.fullName} />
            <ProfileRow label="Email" value={profile.email} />
            <ProfileRow label="Timezone" value={profile.timezone ?? "\u2014"} />
            <ProfileRow label="Locale" value={profile.locale ?? "\u2014"} />
          </div>

          {/* Edit button */}
          <Button
            asChild
            size="lg"
            className="mt-6 h-14 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
          >
            <Link href="/edit-profile">Edit Profile</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
