"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerFcmToken } from "@/server/actions/preferences";

const DEVICE_ID_KEY = "sophionix_device_id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

interface UsePushNotificationsReturn {
  /** Whether the browser supports push notifications */
  isSupported: boolean;
  /** Current notification permission state */
  permission: NotificationPermission | "unsupported";
  /** Request permission and register FCM token */
  requestPermission: () => Promise<void>;
  /** Whether token registration is in progress */
  isRegistering: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [isRegistering, setIsRegistering] = useState(false);
  const registeredRef = useRef(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator;
    setIsSupported(supported); // eslint-disable-line react-hooks/set-state-in-effect
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return;
    if (registeredRef.current) return;

    try {
      setIsRegistering(true);

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      // Register the service worker
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );

      // Wait for the SW to be active
      await navigator.serviceWorker.ready;

      // Use the Firebase Messaging compat API loaded in the SW to get a token.
      // Since we don't have the firebase npm package, we load the compat SDK
      // dynamically and use it to call getToken with the SW registration.
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error("[push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set");
        return;
      }

      const firebase = await loadFirebaseCompat();
      const messaging = firebase.messaging();
      const token = await messaging.getToken({
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.error("[push] Failed to get FCM token");
        return;
      }

      await registerFcmToken({
        token,
        deviceId: getDeviceId(),
        platform: "web",
      });

      registeredRef.current = true;
    } catch (err) {
      console.error("[push] Registration failed:", err);
    } finally {
      setIsRegistering(false);
    }
  }, [isSupported]);

  return { isSupported, permission, requestPermission, isRegistering };
}

// ---------------------------------------------------------------------------
// Firebase compat dynamic loader
// ---------------------------------------------------------------------------
// We use the same compat CDN version the service worker uses, loaded as
// scripts into the main page. This avoids needing the `firebase` npm package.

interface FirebaseCompat {
  initializeApp: (config: Record<string, string>) => void;
  messaging: () => {
    getToken: (opts: {
      vapidKey: string;
      serviceWorkerRegistration: ServiceWorkerRegistration;
    }) => Promise<string>;
  };
  apps: unknown[];
}

let firebasePromise: Promise<FirebaseCompat> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function loadFirebaseCompat(): Promise<FirebaseCompat> {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    await loadScript(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    );
    await loadScript(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
    );

    const fb = (window as unknown as { firebase: FirebaseCompat }).firebase;

    // Only initialize if no app exists yet
    if (fb.apps.length === 0) {
      fb.initializeApp({
        apiKey: "AIzaSyDQZoNHxHoDpLj-iRkOb3X7PYCRrhca1yU",
        authDomain: "sophionix-4c1f4.firebaseapp.com",
        projectId: "sophionix-4c1f4",
        storageBucket: "sophionix-4c1f4.firebasestorage.app",
        messagingSenderId: "213822458978",
        appId: "1:213822458978:web:1f4fef763490c67399d53b",
      });
    }

    return fb;
  })();

  return firebasePromise;
}
