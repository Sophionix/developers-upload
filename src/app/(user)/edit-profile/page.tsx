"use client";

import * as React from "react";
import {
  AvatarPicker,
  PillInput,
  PillSelect,
  PillSelectItem,
  PhoneInput,
} from "@/components/features/auth";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Calendar, Loader2, Mail, User } from "@/lib/ui/icons";
import { getProfile, updateProfile } from "@/server/actions/profile";
import { COUNTRY_OPTIONS, getStateOptions, getDialCode } from "@/lib/data/geo";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export default function EditProfilePage() {
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [state, setState] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [dialCode, setDialCode] = React.useState("+1");
  const [phone, setPhone] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getProfile()
      .then((profile) => {
        setFullName(profile.fullName ?? "");
        setEmail(profile.email ?? "");
        if (profile.avatarUrl) setAvatar(profile.avatarUrl);
        if (profile.dateOfBirth)
          setDob(new Date(profile.dateOfBirth).toISOString().slice(0, 10));
        if (profile.gender) setGender(profile.gender);
        if (profile.country) setCountry(profile.country);
        if (profile.state) setState(profile.state);
        if (profile.phone) {
          const raw = profile.phone;
          const codeMatch = raw.match(/^(\+\d{1,4})\s*/);
          if (codeMatch?.[1]) {
            setDialCode(codeMatch[1]);
            setPhone(raw.slice(codeMatch[0].length));
          } else {
            setPhone(raw);
          }
        }
      })
      .catch(() => {
        toast.error("Failed to load profile.");
      })
      .finally(() => setLoading(false));
  }, []);

  const stateOptions = React.useMemo(() => getStateOptions(country), [country]);

  /**
   * Country drives both dependent fields: the state list is rebuilt (so any
   * previously picked state is no longer valid) and the phone dial code
   * follows the country. The typed national number is intentionally kept.
   */
  const handleCountryChange = (next: string) => {
    setCountry(next);
    setState("");
    const nextDial = getDialCode(next);
    if (nextDial) setDialCode(nextDial);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfile({
          ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
          ...(dob ? { dateOfBirth: dob } : {}),
          ...(gender ? { gender: gender as "male" | "female" | "other" | "prefer_not" } : {}),
          ...(country ? { country } : {}),
          ...(state ? { state } : {}),
          ...(phone.trim() ? { phone: `${dialCode} ${phone.trim()}` } : {}),
        });
        toast.success("Profile updated.");
      } catch {
        toast.error("Failed to update profile.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="size-8 animate-pulse rounded-full bg-white/5" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-white/5" />
        </div>
        <div className="flex w-full max-w-lg flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-pill bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Profile" backHref="/settings" className="pb-0" />

      {/* Form */}
      <form
        className="flex w-full max-w-lg flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <AvatarPicker
          value={avatar}
          onChange={(_file, preview) => setAvatar(preview)}
          className="justify-start"
        />

        <PillInput
          icon={User}
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="Enter Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-label="Full name"
        />

        <div className="flex gap-3">
          <div className="relative flex-1">
            <PillInput
              icon={Calendar}
              type="text"
              name="dob"
              placeholder="Date Of Birth"
              value={dob}
              onFocus={(e) => {
                e.currentTarget.type = "date";
              }}
              onBlur={(e) => {
                if (!e.currentTarget.value) e.currentTarget.type = "text";
              }}
              onChange={(e) => setDob(e.target.value)}
              aria-label="Date of birth"
            />
          </div>
          <div className="flex-1">
            <PillSelect
              icon={User}
              placeholder="Select Gender"
              value={gender}
              onValueChange={setGender}
            >
              {GENDERS.map((g) => (
                <PillSelectItem key={g.value} value={g.value}>
                  {g.label}
                </PillSelectItem>
              ))}
            </PillSelect>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <PillSelect
              placeholder="Country"
              value={country}
              onValueChange={handleCountryChange}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <PillSelectItem key={c.value} value={c.value}>
                  {c.label}
                </PillSelectItem>
              ))}
            </PillSelect>
          </div>
          <div className="flex-1">
            <PillSelect
              placeholder={
                country && stateOptions.length === 0 ? "No states" : "State"
              }
              value={state}
              onValueChange={setState}
              disabled={stateOptions.length === 0}
            >
              {stateOptions.map((s) => (
                <PillSelectItem key={s.value} value={s.value}>
                  {s.label}
                </PillSelectItem>
              ))}
            </PillSelect>
          </div>
        </div>

        <PillInput
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />

        <PhoneInput
          dialCode={dialCode}
          onDialCodeChange={setDialCode}
          phone={phone}
          onPhoneChange={setPhone}
          country={country}
        />

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-14 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
