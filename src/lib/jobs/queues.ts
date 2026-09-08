export const QUEUE_NAMES = {
  notifications: "notifications",
  stripeSync: "stripe-sync",
  rollup: "rollup",
  exports: "exports",
  scheduledExports: "scheduled-exports",
  purge: "purge",
  storageCleanup: "storage-cleanup",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
