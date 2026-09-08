"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthRightColumn } from "./auth-right-column";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import { ArrowLeft, ArrowRight } from "@/lib/ui/icons";

import laptopImg from "../../../../public/slides/laptop.png";

const DECK_CARDS = [
  "/cards/22-third-eye.png",
  "/cards/05-halo.png",
  "/cards/16-bear-hug.png",
] as const;

const SLIDES = [
  {
    title: "Your Space for Reflection Begins",
    body:
      "Sophionix is a transformative 37 card journey designed to bridge the gap between the masculine and the feminine. This system is designed specifically to bring in more feminine inner influence to counterweight the heavy masculinized physical world that demands all our energy. It's time for boundaries, peace and reconciliation between opposites for the collective goal of harmonious living. The dualities exist to work perfectly together, not to be at odds with. Wholeness starts as your core. Sophionix addresses this by reminding you that your outer world is a reflection of your inner one. If you're conflicted inside, then that's what you will experience outside. If you are healed, you have already figured this out and are well on your way to transforming your relationship in all area's of your life.",
    img: laptopImg
  },
  {
    title: "A Card for Every Moment",
    body:
      "Each card invites you to slow down, observe, and reflect. Let thoughtful visuals and gentle prompts lead you toward deeper understanding and emotional clarity.",
    img: null
  },
  {
    title: "A Daily Practice of Coming Home",
    body:
      "Draw a daily card, capture a voice note, and build a gentle habit of returning to what you truly feel.",
    img: null
  },
] as const;

export function SplashCarousel() {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);

  const complete = React.useCallback(() => {
    router.push("/welcome");
  }, [router]);

  const back = () => setIndex((i) => Math.max(0, i - 1));

  const next = () => {
    if (index === SLIDES.length - 1) {
      complete();
      return;
    }
    setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
  };

  return (
    <AuthRightColumn
      leading={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Previous slide"
          disabled={index === 0}
          onClick={back}
        >
          <ArrowLeft className="size-4" />
        </Button>
      }
      trailing={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Next slide"
          onClick={next}
        >
          <ArrowRight className="size-4" />
        </Button>
      }
      footer={
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center gap-2"
            role="tablist"
            aria-label="Onboarding slides"
          >
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-pill transition-all duration-(--duration-standard) ease-brand",
                  i === index ? "w-8 bg-primary" : "w-4 bg-muted",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={complete}
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Skip
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-6">
        {/* Carousel track — fills all available height */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-(--duration-slow) ease-brand"
            style={{ transform: `translateX(-${index * 100}%)` }}
            aria-live="polite"
          >
            {SLIDES.map((slide, i) => (
              <article
                key={i}
                aria-hidden={i !== index}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDES.length}`}
                className="flex h-full w-full shrink-0 flex-col gap-3 pr-2 lg:gap-5"
              >
                {/* Text block — shrinks when space is tight */}
                <div className="flex shrink flex-col gap-1.5 lg:gap-4">
                  <h1 className="font-display text-[clamp(1.25rem,3.5vh,3.75rem)] leading-[1.1] text-foreground">
                    {slide.title}
                  </h1>
                  <p className="line-clamp-3 max-w-lg text-balance text-sm text-muted-foreground lg:line-clamp-none lg:text-base">{slide.body}</p>
                  <span aria-hidden className="h-0.5 w-16 rounded-pill bg-brand-grad" />
                </div>

                {/* Image — takes all remaining height */}
                <div className="relative min-h-0 flex-1 basis-0">
                  {slide.img ? (
                    <Image
                      src={slide.img}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 42rem, (min-width: 1024px) 32rem, 100vw"
                      className="rounded-lg object-contain object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end justify-center gap-2">
                      {DECK_CARDS.map((src, cardIndex) => (
                        <div
                          key={src}
                          className={cn(
                            "relative aspect-2/3 w-1/3 shadow-lg",
                            cardIndex === 1 ? "h-full" : "h-[80%]",
                          )}
                        >
                          <Image
                            src={src}
                            alt=""
                            fill
                            sizes="200px"
                            className="object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AuthRightColumn>
  );
}
