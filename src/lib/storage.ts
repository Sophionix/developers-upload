// Storage facade. Backed by AWS S3 + CloudFront (see src/lib/s3.ts).
//
// This module keeps a stable interface so existing callers (upload-url routes,
// profile/voice-note actions) don't change when the backend moves. New code can
// import from "@/lib/s3" directly for S3-specific helpers (publicUrl, putObject,
// getObjectBody).
export {
  isStorageConfigured,
  StorageNotConfiguredError,
  issueUploadUrl,
  issueDownloadUrl,
  readObjectMetadata,
  deleteObject,
  putObject,
  getObjectBody,
  objectExists,
  publicUrl,
  type UploadUrlArgs,
  type UploadUrlResult,
  type ObjectMetadata,
  type ObjectBodyResult,
} from "@/lib/s3";
