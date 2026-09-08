"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AuthRightColumn,
  AvatarPicker,
  PillInput,
  PillSelect,
  PillSelectItem,
  PhoneInput,
  StepIndicator,
} from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Calendar, Clock, Loader2, Sparkles, User } from "@/lib/ui/icons";
import { getProfile, updateProfile } from "@/server/actions/profile";
import { completeOnboarding } from "@/server/actions/preferences";
import { COUNTRY_OPTIONS, getStateOptions, getDialCode } from "@/lib/data/geo";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
];

const TONES = [
  { value: "FRIENDLY", label: "Friendly & Warm", desc: "Gentle, encouraging language" },
  { value: "NEUTRAL", label: "Neutral & Calm", desc: "Balanced, straightforward tone" },
  { value: "MOTIVATIONAL", label: "Motivational", desc: "Uplifting, action-oriented" },
];

const REMINDER_HOURS = [
  { value: "6", label: "6:00 AM" },
  { value: "8", label: "8:00 AM" },
  { value: "10", label: "10:00 AM" },
  { value: "12", label: "12:00 PM" },
  { value: "18", label: "6:00 PM" },
  { value: "20", label: "8:00 PM" },
  { value: "22", label: "10:00 PM" },
];

function PillDateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-pill border border-white/10 bg-surface pl-5 pr-2 transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40"
      onClick={() => {
        try {
          inputRef.current?.showPicker();
        } catch {
          inputRef.current?.focus();
        }
      }}
    >
      <span className={`flex-1 text-base ${value ? "text-foreground" : "text-muted-foreground"}`}>
        {value || placeholder}
      </span>
      <span aria-hidden className="grid size-10 shrink-0 place-items-center">
        <Calendar className="size-5 text-primary" />
      </span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-label={placeholder}
      />
    </div>
  );
}

function ToneCard({
  label,
  desc,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-primary bg-primary/10"
          : "border-white/10 bg-surface hover:border-white/20"
      }`}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [pending, startTransition] = React.useTransition();

  // Step 1: Profile
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [_avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [state, setState] = React.useState("");
  const [dialCode, setDialCode] = React.useState("+1");
  const [phone, setPhone] = React.useState("");

  // Step 2: Preferences
  const [tone, setTone] = React.useState("NEUTRAL");
  const [reminderHour, setReminderHour] = React.useState("");
  const [remindersEnabled, setRemindersEnabled] = React.useState(true);

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

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        if (profile.fullName) setFullName(profile.fullName);
        if (profile.avatarUrl) setAvatar(profile.avatarUrl);
        if (profile.dateOfBirth) {
          const d = new Date(profile.dateOfBirth);
          if (!Number.isNaN(d.getTime())) {
            setDob(d.toISOString().slice(0, 10));
          }
        }
        if (profile.gender) setGender(profile.gender);
        if (profile.country) setCountry(profile.country);
        if (profile.state) setState(profile.state);
        if (profile.phone) {
          const match = profile.phone.match(/^(\+\d{1,4})\s*(.*)$/);
          if (match && match[1]) {
            setDialCode(match[1]);
            setPhone(match[2] ?? "");
          } else {
            setPhone(profile.phone);
          }
        }
      } catch {
        // not signed in or fetch failed — leave fields empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    startTransition(async () => {
      try {
        await updateProfile({
          fullName: fullName.trim(),
          ...(dob ? { dateOfBirth: dob } : {}),
          ...(gender ? { gender: gender as "male" | "female" | "other" | "prefer_not" } : {}),
          ...(country ? { country } : {}),
          ...(state ? { state } : {}),
          ...(phone.trim() ? { phone: `${dialCode} ${phone.trim()}` } : {}),
        });
        setStep(1);
      } catch {
        toast.error("Failed to save profile.");
      }
    });
  };

  const handleSkipProfile = () => {
    if (!fullName.trim()) {
      toast.error("Please enter your name to continue.");
      return;
    }
    startTransition(async () => {
      try {
        await updateProfile({ fullName: fullName.trim() });
        setStep(1);
      } catch {
        toast.error("Failed to save profile.");
      }
    });
  };

  const handleComplete = () => {
    startTransition(async () => {
      try {
        await completeOnboarding({
          tone: tone as "FRIENDLY" | "NEUTRAL" | "MOTIVATIONAL",
          remindersEnabled,
          ...(reminderHour ? { dailyCardAtHour: parseInt(reminderHour, 10) } : {}),
        });
        toast.success("Welcome aboard!");
        router.push("/dashboard");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <AuthRightColumn
      trailing={
        step === 0 ? (
          <button
            type="button"
            onClick={handleSkipProfile}
            disabled={pending}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now
          </button>
        ) : undefined
      }
      footer={<StepIndicator total={2} current={step} />}
    >
      {step === 0 ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl leading-[1.1] text-foreground lg:text-5xl">
              Create Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Tell us a bit about yourself
            </p>
          </div>

          <AvatarPicker
            value={avatar}
            onChange={(file, preview) => {
              setAvatarFile(file);
              setAvatar(preview);
            }}
          />

          <form className="flex flex-col gap-3" onSubmit={handleProfileSubmit}>
            <PillInput
              icon={User}
              type="text"
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter Full Name"
              aria-label="Full name"
            />

            <div className="grid grid-cols-2 gap-3">
              <PillDateInput
                placeholder="Date Of Birth"
                value={dob}
                onChange={setDob}
              />
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

            <div className="grid grid-cols-2 gap-3">
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
              <PillSelect
                placeholder={
                  country && stateOptions.length === 0
                    ? "No states"
                    : "State"
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
              className="mt-1 h-14 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl leading-[1.1] text-foreground lg:text-5xl">
              <Sparkles className="mb-1 mr-2 inline-block size-8 text-primary" />
              Personalize
            </h1>
            <p className="text-sm text-muted-foreground">
              Set your preferences — you can change these anytime
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              How should we talk to you?
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TONES.map((t) => (
                <ToneCard
                  key={t.value}
                  label={t.label}
                  desc={t.desc}
                  selected={tone === t.value}
                  onSelect={() => setTone(t.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Daily card reminder
              </label>
              <button
                type="button"
                onClick={() => setRemindersEnabled(!remindersEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  remindersEnabled ? "bg-primary" : "bg-muted"
                }`}
                role="switch"
                aria-checked={remindersEnabled}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${
                    remindersEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {remindersEnabled ? (
              <PillSelect
                icon={Clock}
                placeholder="Pick a time"
                value={reminderHour}
                onValueChange={setReminderHour}
              >
                {REMINDER_HOURS.map((h) => (
                  <PillSelectItem key={h.value} value={h.value}>
                    {h.label}
                  </PillSelectItem>
                ))}
              </PillSelect>
            ) : null}
          </div>

          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={handleComplete}
            className="h-14 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Get Started
          </Button>
        </div>
      )}
    </AuthRightColumn>
  );
}
