export class RateLimitedError extends Error {
  readonly code = "RATE_LIMITED" as const;
  constructor(message = "rate_limited") {
    super(message);
    this.name = "RateLimitedError";
  }
}

export class EntitlementRequiredError extends Error {
  readonly code = "ENTITLEMENT_REQUIRED" as const;
  readonly status = 402;
  constructor(message = "entitlement_required") {
    super(message);
    this.name = "EntitlementRequiredError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404;
  constructor(message = "not_found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly code = "CONFLICT" as const;
  readonly status = 409;
  constructor(message = "conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;
  readonly status = 400;
  constructor(message = "validation_error") {
    super(message);
    this.name = "ValidationError";
  }
}

export class InvalidPasswordError extends Error {
  readonly code = "INVALID_PASSWORD" as const;
  constructor() {
    super("invalid_password");
    this.name = "InvalidPasswordError";
  }
}

export class PasswordMismatchError extends Error {
  readonly code = "PASSWORD_MISMATCH" as const;
  constructor() {
    super("password_mismatch");
    this.name = "PasswordMismatchError";
  }
}

export class InvalidUploadError extends Error {
  readonly code = "INVALID_UPLOAD" as const;
  constructor(message = "invalid_upload") {
    super(message);
    this.name = "InvalidUploadError";
  }
}

export class DeletionStateError extends Error {
  readonly code = "DELETION_STATE_ERROR" as const;
  constructor(message = "deletion_state_error") {
    super(message);
    this.name = "DeletionStateError";
  }
}

export class StorageNotConfiguredError extends Error {
  readonly code = "STORAGE_NOT_CONFIGURED" as const;
  readonly status = 503;
  constructor(message = "storage_not_configured") {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}
