"use client";

import Link from "next/link";
import { AuthRightColumn } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/lib/ui/icons";

export default function PrivacyPolicyPage() {
  return (
    <AuthRightColumn
      align="top"
      trailing={
        <Button asChild variant="outline" size="icon-sm" aria-label="Continue to Create Profile">
          <Link href="/profile">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl leading-[1.1] text-foreground lg:text-5xl">
          Privacy Policy
        </h1>

        <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Lorem ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam tortor taciti aenean luctus nullam enim, dui
            praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent malesuada maecenas arcu curae, porta
            pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum. Egestas tortor blandit vestibulum tempus dignissim
            cras placerat, ligula ridiculus sollicitudin interdum quisque facilisis, suscipit tempor justo tristique et mattis.Lorem
            ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam tortor taciti aenean luctus nullam enim, dui
            praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent malesuada maecenas arcu curae, porta
            pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum.
          </p>

          <p>
            Nisi imperdiet donec nascetur feugiat massa vehicula elementum nullam purus morbi, sagittis et penatibus taciti vitae
            lobortis facilisis maecenas gravida, venenatis sed pellentesque suspendisse socios magna class nibh volutpat.
            Sodales leo arcu ornare eget torquent dictumst, id morbi fringilla ultricies suscipit, nulla sapien a aliquet tempor.
            Tristique non eros a felis quam convallis nascetur montes auctor hendrerit, mollis metus sodales ligula magnis
            condimentum et arcu nam. Lorem ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam tortor taciti
            aenean luctus nullam enim, dui praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent malesuada
            maecenas arcu curae, porta pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum.
          </p>

          <p>
            Lorem ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam tortor taciti aenean luctus nullam enim, dui
            praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent malesuada maecenas arcu curae, porta
            pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum. Lorem ipsum dolor sit amet consectetur adipiscing
            elit odio, mattis quam tortor taciti aenean luctus nullam enim, dui praesent ad dapibus tempus natoque a. Rhoncus
            praesent massa torquent malesuada maecenas arcu curae, porta pulvinar potenti at mus sem, vel purus proin eleifend
            nisi dictum.
          </p>

          <p>
            Tristique non eros a felis quam convallis montes auctor hendrerit, mollis metus sodales ligula magnis
            condimentum et arcu nam.Lorem ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam tortor taciti
            aenean luctus nullam enim, dui praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent malesuada
            maecenas arcu curae, porta pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum. Lorem ipsum dolor sit
            amet consectetur adipiscing elit odio, mattis quam tortor taciti aenean luctus nullam enim, dui praesent ad dapibus
            tempus natoque a. Rhoncus praesent massa torquent malesuada maecenas arcu curae, porta pulvinar potenti at mus
            sem, vel purus proin eleifend nisi dictum. Lorem ipsum dolor sit amet consectetur adipiscing elit odio, mattis quam
            tortor taciti aenean luctus nullam enim, dui praesent ad dapibus tempus natoque a. Rhoncus praesent massa torquent
            malesuada maecenas arcu curae, porta pulvinar potenti at mus sem, vel purus proin eleifend nisi dictum.
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="h-14 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
        >
          <Link href="/profile">Continue</Link>
        </Button>
      </div>
    </AuthRightColumn>
  );
}
