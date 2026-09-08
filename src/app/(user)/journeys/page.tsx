"use client";

import * as React from "react";
import Image from "next/image";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/cn";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Sparkles,
  Play,
  CheckCircle2,
  Lock,
  Loader2,
  Layers,
  Calendar,
} from "@/lib/ui/icons";
import {
  listJourneys,
  getJourney,
  enrollInJourney,
  getEnrollmentProgress,
  advanceJourneyDay,
} from "@/server/actions/journeys";
import type { JourneyListDto, JourneyDetailDto, EnrollmentProgressDto } from "@/lib/dto/journey";

type ViewMode = "list" | "detail";

function JourneyCard({
  journey,
  onClick,
}: {
  journey: JourneyListDto;
  onClick: () => void;
}) {
  const isPremium = journey.accessType === "PREMIUM";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex overflow-hidden rounded-lg border border-white/10 bg-card text-left transition-transform hover:scale-[1.01]"
    >
      <div className="relative h-40 w-36 shrink-0 overflow-hidden bg-surface">
        {journey.thumbnailUrl ? (
          <Image
            src={journey.thumbnailUrl}
            alt={journey.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-brand-grad">
            <Compass className="size-8 text-white/60" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg text-foreground">
              {journey.title}
            </h3>
            {isPremium ? (
              <span className="rounded-pill bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                Premium
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {journey.description}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {journey.durationDays} days
          </span>
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            Daily card + prompt
          </span>
        </div>
      </div>
      <div className="flex items-center pr-4">
        <ChevronRight className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
    </button>
  );
}

function DayTimeline({
  detail,
  progress,
  onAdvance,
  advancing,
}: {
  detail: JourneyDetailDto;
  progress: EnrollmentProgressDto | null;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const currentDay = progress?.currentDay ?? 0;
  const isCompleted = !!progress?.completedAt;

  return (
    <div className="flex flex-col gap-3">
      {detail.days.map((day) => {
        const isDone = currentDay > day.dayIndex;
        const isCurrent = currentDay === day.dayIndex && !isCompleted;
        const isLocked = !progress || currentDay < day.dayIndex;

        return (
          <div
            key={day.id}
            className={cn(
              "flex items-start gap-4 rounded-lg border p-4 transition-colors",
              isCurrent
                ? "border-accent/50 bg-accent/5"
                : isDone
                  ? "border-success/30 bg-success/5"
                  : "border-white/10 bg-surface",
            )}
          >
            {/* Day indicator */}
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                isDone
                  ? "bg-success text-white"
                  : isCurrent
                    ? "bg-accent text-black"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="size-5" />
              ) : isLocked ? (
                <Lock className="size-4" />
              ) : (
                day.dayIndex
              )}
            </div>

            {/* Day content */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">
                Day {day.dayIndex}
              </p>
              {day.quote ? (
                <p className="text-xs italic text-muted-foreground">
                  &ldquo;{day.quote}&rdquo;
                </p>
              ) : null}
              {day.promptText && (isDone || isCurrent) ? (
                <p className="text-sm text-muted-foreground">
                  {day.promptText}
                </p>
              ) : null}
              {isCurrent ? (
                <Button
                  variant="brand"
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={onAdvance}
                  disabled={advancing}
                >
                  {advancing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Complete Day {day.dayIndex}
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GuidedJourneysPage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [journeys, setJourneys] = React.useState<JourneyListDto[]>([]);
  const [activeJourney, setActiveJourney] =
    React.useState<JourneyDetailDto | null>(null);
  const [progress, setProgress] =
    React.useState<EnrollmentProgressDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [enrolling, setEnrolling] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  React.useEffect(() => {
    listJourneys({}).then((res) => {
      setJourneys(res.items);
      setLoading(false);
    });
  }, []);

  const openJourney = React.useCallback(async (journey: JourneyListDto) => {
    setLoading(true);
    setViewMode("detail");
    try {
      const [detail, enrollment] = await Promise.allSettled([
        getJourney({ id: journey.id }),
        getEnrollmentProgress({ journeyId: journey.id }),
      ]);
      if (detail.status === "fulfilled") setActiveJourney(detail.value);
      if (enrollment.status === "fulfilled") setProgress(enrollment.value);
    } finally {
      setLoading(false);
    }
  }, []);

  const goBackToList = React.useCallback(() => {
    setViewMode("list");
    setActiveJourney(null);
    setProgress(null);
  }, []);

  const handleEnroll = React.useCallback(async () => {
    if (!activeJourney || enrolling) return;
    setEnrolling(true);
    try {
      const result = await enrollInJourney({
        journeyId: activeJourney.id,
      });
      setProgress(result);
    } catch {
      // entitlement error — silent
    } finally {
      setEnrolling(false);
    }
  }, [activeJourney, enrolling]);

  const handleAdvance = React.useCallback(async () => {
    if (!activeJourney || advancing) return;
    setAdvancing(true);
    try {
      const result = await advanceJourneyDay({
        journeyId: activeJourney.id,
      });
      setProgress(result);
    } catch {
      // rate-limited or error
    } finally {
      setAdvancing(false);
    }
  }, [activeJourney, advancing]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          viewMode === "list"
            ? "Guided Journeys"
            : activeJourney?.title ?? "Journey"
        }
      />

      {viewMode === "detail" ? (
        <Button variant="ghost" size="sm" onClick={goBackToList} className="w-fit">
          <ChevronLeft className="size-4" />
          All Journeys
        </Button>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : viewMode === "list" ? (
        journeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Compass className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No guided journeys available yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {journeys.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onClick={() => openJourney(journey)}
              />
            ))}
          </div>
        )
      ) : activeJourney ? (
        <div className="flex flex-col gap-6">
          {/* Journey header */}
          <div className="flex gap-6 rounded-lg border border-white/10 bg-card p-6">
            <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-md bg-surface">
              {activeJourney.thumbnailUrl ? (
                <Image
                  src={activeJourney.thumbnailUrl}
                  alt={activeJourney.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-brand-grad">
                  <Compass className="size-6 text-white/60" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {activeJourney.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{activeJourney.durationDays} days</span>
                <span>{activeJourney.days.length} sessions</span>
                {activeJourney.accessType === "PREMIUM" ? (
                  <span className="rounded-pill bg-accent/20 px-2 py-0.5 font-bold uppercase text-accent">
                    Premium
                  </span>
                ) : null}
              </div>

              {/* Enrollment status */}
              {progress ? (
                <div className="flex items-center gap-3">
                  {progress.completedAt ? (
                    <span className="flex items-center gap-1 text-sm font-semibold text-success">
                      <CheckCircle2 className="size-4" />
                      Completed
                    </span>
                  ) : (
                    <>
                      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-muted">
                        <div
                          className="h-full rounded-pill bg-accent transition-all"
                          style={{
                            width: `${Math.round((progress.currentDay / progress.durationDays) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Day {progress.currentDay} / {progress.durationDays}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  variant="brand"
                  size="sm"
                  className="mt-1 w-fit"
                  onClick={handleEnroll}
                  disabled={enrolling}
                >
                  {enrolling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Begin Journey
                </Button>
              )}
            </div>
          </div>

          {/* Day timeline */}
          <DayTimeline
            detail={activeJourney}
            progress={progress}
            onAdvance={handleAdvance}
            advancing={advancing}
          />
        </div>
      ) : null}
    </div>
  );
}
