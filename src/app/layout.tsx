import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Jomolhari, Roboto } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";
import { AppProviders } from "@/components/providers/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const jomolhari = Jomolhari({
  variable: "--font-jomolhari",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/** Guest topbar (Figma node 0:1208) — Roboto Medium 20px for Signup / Login. */
const robotoMedium = Roboto({
  variable: "--font-roboto-medium",
  subsets: ["latin"],
  weight: "500",
  display: "swap",
});

/** Logged-in shell — Roboto Light / Regular / Bold per Figma dashboard (0:1099). */
const robotoUi = Roboto({
  variable: "--font-roboto-ui",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sophionix — Contemplation Journal",
    template: "%s · Sophionix",
  },
  description:
    "A self-guided journal for emotional healing through contemplation cards, mindful journaling, and daily reflection.",
  applicationName: "Sophionix",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#210102",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${jomolhari.variable} ${robotoMedium.variable} ${robotoUi.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-dvh bg-background text-foreground font-sans flex flex-col">
        <AppProviders>
          {children}
          <SwRegister />
        </AppProviders>
      </body>
    </html>
  );
}
