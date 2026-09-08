-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `role` ENUM('USER', 'SUPER_ADMIN', 'CONTENT_MANAGER') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'DEACTIVATED', 'PENDING_DELETION') NOT NULL DEFAULT 'ACTIVE',
    `timezone` VARCHAR(64) NULL,
    `locale` VARCHAR(10) NULL,
    `consentTermsAt` DATETIME(3) NULL,
    `hasCompletedOnboarding` BOOLEAN NOT NULL DEFAULT false,
    `stripeCustomerId` VARCHAR(64) NULL,
    `totpSecretEnc` VARCHAR(255) NULL,
    `totpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(64) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_stripeCustomerId_key`(`stripeCustomerId`),
    INDEX `User_role_status_idx`(`role`, `status`),
    INDEX `User_deletedAt_idx`(`deletedAt`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `providerAccountId` VARCHAR(255) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(32) NULL,
    `scope` VARCHAR(255) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(255) NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(255) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expires_idx`(`expires`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    INDEX `VerificationToken_expires_idx`(`expires`),
    PRIMARY KEY (`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Authenticator` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(255) NOT NULL,
    `publicKey` LONGBLOB NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,
    `transports` VARCHAR(60) NULL,
    `deviceName` VARCHAR(120) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Authenticator_credentialId_key`(`credentialId`),
    INDEX `Authenticator_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(255) NOT NULL,
    `ip` VARCHAR(64) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginAttempt_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `LoginAttempt_ip_createdAt_idx`(`ip`, `createdAt`),
    INDEX `LoginAttempt_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminTotpChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminTotpChallenge_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestSession` (
    `id` VARCHAR(191) NOT NULL,
    `cookieHash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `claimedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NULL,

    UNIQUE INDEX `GuestSession_cookieHash_key`(`cookieHash`),
    INDEX `GuestSession_email_idx`(`email`),
    INDEX `GuestSession_claimedByUserId_idx`(`claimedByUserId`),
    INDEX `GuestSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreference` (
    `userId` VARCHAR(191) NOT NULL,
    `theme` ENUM('LIGHT', 'DARK', 'AUTO') NOT NULL DEFAULT 'AUTO',
    `accentColor` VARCHAR(16) NULL,
    `tone` ENUM('FRIENDLY', 'NEUTRAL', 'MOTIVATIONAL') NOT NULL DEFAULT 'NEUTRAL',
    `dailyCardAtHour` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `userId` VARCHAR(191) NOT NULL,
    `remindersEnabled` BOOLEAN NOT NULL DEFAULT true,
    `channel` ENUM('PUSH', 'EMAIL', 'BOTH', 'NONE') NOT NULL DEFAULT 'PUSH',
    `scheduleCron` VARCHAR(64) NULL,
    `weeklyNewsletter` BOOLEAN NOT NULL DEFAULT true,
    `promotional` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FcmToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `deviceId` VARCHAR(120) NULL,
    `platform` VARCHAR(30) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FcmToken_token_key`(`token`),
    INDEX `FcmToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deck` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `coverUrl` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Deck_slug_key`(`slug`),
    INDEX `Deck_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Theme` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Theme_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Card` (
    `id` VARCHAR(191) NOT NULL,
    `deckId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `message` TEXT NOT NULL,
    `prompt` TEXT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `iconKey` VARCHAR(60) NULL,
    `accessType` ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
    `guestPreview` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Card_deckId_accessType_isActive_idx`(`deckId`, `accessType`, `isActive`),
    INDEX `Card_accessType_isActive_sortOrder_idx`(`accessType`, `isActive`, `sortOrder`),
    INDEX `Card_guestPreview_isActive_idx`(`guestPreview`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardTheme` (
    `cardId` VARCHAR(191) NOT NULL,
    `themeId` VARCHAR(191) NOT NULL,

    INDEX `CardTheme_themeId_idx`(`themeId`),
    PRIMARY KEY (`cardId`, `themeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardTag` (
    `cardId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `CardTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`cardId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalPrompt` (
    `id` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `type` ENUM('REFLECTION', 'GRATITUDE', 'AFFIRMATION', 'QUESTION') NOT NULL DEFAULT 'REFLECTION',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptTheme` (
    `promptId` VARCHAR(191) NOT NULL,
    `themeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`promptId`, `themeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptCategory` (
    `promptId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`promptId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Journey` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `durationDays` INTEGER NOT NULL,
    `accessType` ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
    `thumbnailUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Journey_slug_key`(`slug`),
    INDEX `Journey_accessType_isActive_idx`(`accessType`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JourneyDay` (
    `id` VARCHAR(191) NOT NULL,
    `journeyId` VARCHAR(191) NOT NULL,
    `dayIndex` INTEGER NOT NULL,
    `cardId` VARCHAR(191) NULL,
    `promptText` TEXT NULL,
    `quote` TEXT NULL,
    `audioUrl` VARCHAR(500) NULL,

    INDEX `JourneyDay_cardId_idx`(`cardId`),
    UNIQUE INDEX `JourneyDay_journeyId_dayIndex_key`(`journeyId`, `dayIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JourneyEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `journeyId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentDay` INTEGER NOT NULL DEFAULT 1,
    `completedAt` DATETIME(3) NULL,

    INDEX `JourneyEnrollment_userId_completedAt_idx`(`userId`, `completedAt`),
    UNIQUE INDEX `JourneyEnrollment_userId_journeyId_key`(`userId`, `journeyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledDailyCard` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `isGlobal` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ScheduledDailyCard_cardId_idx`(`cardId`),
    UNIQUE INDEX `ScheduledDailyCard_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `bodyPlain` MEDIUMTEXT NOT NULL,
    `moodCheckInId` VARCHAR(191) NULL,
    `cardId` VARCHAR(191) NULL,
    `drawId` VARCHAR(191) NULL,
    `isDraft` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JournalEntry_moodCheckInId_key`(`moodCheckInId`),
    UNIQUE INDEX `JournalEntry_drawId_key`(`drawId`),
    INDEX `JournalEntry_userId_deletedAt_createdAt_idx`(`userId`, `deletedAt`, `createdAt`),
    INDEX `JournalEntry_userId_cardId_idx`(`userId`, `cardId`),
    INDEX `JournalEntry_userId_moodCheckInId_idx`(`userId`, `moodCheckInId`),
    FULLTEXT INDEX `JournalEntry_bodyPlain_idx`(`bodyPlain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntryVersion` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalEntryVersion_entryId_createdAt_idx`(`entryId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntryTag` (
    `entryId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `JournalEntryTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`entryId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceNote` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `mimeType` VARCHAR(40) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VoiceNote_entryId_idx`(`entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoodCheckIn` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mood` ENUM('JOYFUL', 'CALM', 'GRATEFUL', 'NEUTRAL', 'TIRED', 'ANXIOUS', 'SAD', 'ANGRY', 'STRESSED', 'HOPEFUL') NOT NULL,
    `note` VARCHAR(500) NULL,
    `linkedCardId` VARCHAR(191) NULL,
    `linkedDrawId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MoodCheckIn_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `MoodCheckIn_mood_createdAt_idx`(`mood`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardDraw` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardDraw_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `CardDraw_cardId_createdAt_idx`(`cardId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavedCard` (
    `userId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SavedCard_cardId_idx`(`cardId`),
    PRIMARY KEY (`userId`, `cardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PricingPlan` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `priceCents` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `intervalMonths` INTEGER NOT NULL,
    `trialDays` INTEGER NOT NULL DEFAULT 0,
    `features` JSON NOT NULL,
    `visibility` ENUM('PUBLIC', 'INTERNAL', 'TEST_ONLY') NOT NULL DEFAULT 'PUBLIC',
    `stripePriceId` VARCHAR(64) NULL,
    `stripeProductId` VARCHAR(64) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PricingPlan_slug_key`(`slug`),
    UNIQUE INDEX `PricingPlan_stripePriceId_key`(`stripePriceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `tier` ENUM('FREE', 'TRIAL', 'PREMIUM') NOT NULL DEFAULT 'FREE',
    `status` ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE') NOT NULL DEFAULT 'ACTIVE',
    `stripeSubscriptionId` VARCHAR(64) NULL,
    `trialStart` DATETIME(3) NULL,
    `trialEnd` DATETIME(3) NULL,
    `currentPeriodStart` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `canceledAt` DATETIME(3) NULL,
    `grantedByAdminId` VARCHAR(191) NULL,
    `grantExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_userId_key`(`userId`),
    UNIQUE INDEX `Subscription_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    INDEX `Subscription_tier_status_idx`(`tier`, `status`),
    INDEX `Subscription_currentPeriodEnd_idx`(`currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `type` ENUM('PERCENTAGE', 'FLAT') NOT NULL,
    `percentOff` INTEGER NULL,
    `amountOffCents` INTEGER NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `maxRedemptions` INTEGER NULL,
    `redeemedCount` INTEGER NOT NULL DEFAULT 0,
    `appliesToPlanId` VARCHAR(191) NULL,
    `stripeCouponId` VARCHAR(64) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Coupon_code_key`(`code`),
    UNIQUE INDEX `Coupon_stripeCouponId_key`(`stripeCouponId`),
    INDEX `Coupon_isActive_endsAt_idx`(`isActive`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CouponRedemption_userId_idx`(`userId`),
    UNIQUE INDEX `CouponRedemption_couponId_userId_key`(`couponId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardUnlock` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestSessionId` VARCHAR(191) NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `stripePaymentIntentId` VARCHAR(64) NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `unlockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CardUnlock_stripePaymentIntentId_key`(`stripePaymentIntentId`),
    INDEX `CardUnlock_cardId_status_idx`(`cardId`, `status`),
    INDEX `CardUnlock_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `CardUnlock_userId_cardId_key`(`userId`, `cardId`),
    UNIQUE INDEX `CardUnlock_guestSessionId_cardId_key`(`guestSessionId`, `cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestSessionId` VARCHAR(191) NULL,
    `cardUnlockId` VARCHAR(191) NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `stripePaymentIntentId` VARCHAR(64) NULL,
    `stripeChargeId` VARCHAR(64) NULL,
    `stripeInvoiceId` VARCHAR(64) NULL,
    `receiptUrl` VARCHAR(500) NULL,
    `rawEvent` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_cardUnlockId_key`(`cardUnlockId`),
    UNIQUE INDEX `Payment_stripePaymentIntentId_key`(`stripePaymentIntentId`),
    UNIQUE INDEX `Payment_stripeChargeId_key`(`stripeChargeId`),
    INDEX `Payment_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Payment_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StripeWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `error` TEXT NULL,

    INDEX `StripeWebhookEvent_type_receivedAt_idx`(`type`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `type` ENUM('PUSH', 'EMAIL') NOT NULL,
    `subject` VARCHAR(200) NULL,
    `title` VARCHAR(200) NULL,
    `body` TEXT NOT NULL,
    `variables` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationTemplate_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `type` ENUM('PUSH', 'EMAIL') NOT NULL,
    `segmentJson` JSON NOT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENT', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `createdByAdminId` VARCHAR(191) NOT NULL,
    `stats` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationCampaign_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PUSH', 'EMAIL') NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(120) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificationDelivery_campaignId_status_idx`(`campaignId`, `status`),
    INDEX `NotificationDelivery_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExportRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(40) NOT NULL,
    `format` ENUM('CSV', 'PDF') NOT NULL,
    `filters` JSON NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `fileUrl` VARCHAR(500) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `ExportRequest_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ExportRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataDeletionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `scheduledAt` DATETIME(3) NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `reason` VARCHAR(500) NULL,

    UNIQUE INDEX `DataDeletionRequest_userId_key`(`userId`),
    INDEX `DataDeletionRequest_scheduledAt_processedAt_idx`(`scheduledAt`, `processedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'GRANT', 'REVOKE', 'EXPORT', 'IMPORT', 'OVERRIDE') NOT NULL,
    `entity` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(30) NULL,
    `targetUserId` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AdminAuditLog_entity_entityId_createdAt_idx`(`entity`, `entityId`, `createdAt`),
    INDEX `AdminAuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `key` VARCHAR(80) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureFlag` (
    `key` VARCHAR(80) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `rolloutPct` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyUserStat` (
    `date` DATE NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `entries` INTEGER NOT NULL DEFAULT 0,
    `moodAvg` DOUBLE NULL,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT false,

    INDEX `DailyUserStat_userId_date_idx`(`userId`, `date`),
    PRIMARY KEY (`date`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyPlatformStat` (
    `date` DATE NOT NULL,
    `newSignups` INTEGER NOT NULL DEFAULT 0,
    `dau` INTEGER NOT NULL DEFAULT 0,
    `wau` INTEGER NOT NULL DEFAULT 0,
    `mau` INTEGER NOT NULL DEFAULT 0,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `entries` INTEGER NOT NULL DEFAULT 0,
    `paidConversions` INTEGER NOT NULL DEFAULT 0,
    `revenueCents` INTEGER NOT NULL DEFAULT 0,
    `churnCount` INTEGER NOT NULL DEFAULT 0,
    `moodDistribution` JSON NOT NULL,

    PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RetentionCohort` (
    `cohortDate` DATE NOT NULL,
    `dayOffset` INTEGER NOT NULL,
    `size` INTEGER NOT NULL,
    `retained` INTEGER NOT NULL,

    PRIMARY KEY (`cohortDate`, `dayOffset`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardUsageStat` (
    `date` DATE NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `saves` INTEGER NOT NULL DEFAULT 0,
    `unlocks` INTEGER NOT NULL DEFAULT 0,

    INDEX `CardUsageStat_cardId_date_idx`(`cardId`, `date`),
    PRIMARY KEY (`date`, `cardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Authenticator` ADD CONSTRAINT `Authenticator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoginAttempt` ADD CONSTRAINT `LoginAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreference` ADD CONSTRAINT `UserPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FcmToken` ADD CONSTRAINT `FcmToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_deckId_fkey` FOREIGN KEY (`deckId`) REFERENCES `Deck`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardTheme` ADD CONSTRAINT `CardTheme_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardTheme` ADD CONSTRAINT `CardTheme_themeId_fkey` FOREIGN KEY (`themeId`) REFERENCES `Theme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardTag` ADD CONSTRAINT `CardTag_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardTag` ADD CONSTRAINT `CardTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptTheme` ADD CONSTRAINT `PromptTheme_promptId_fkey` FOREIGN KEY (`promptId`) REFERENCES `JournalPrompt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptTheme` ADD CONSTRAINT `PromptTheme_themeId_fkey` FOREIGN KEY (`themeId`) REFERENCES `Theme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptCategory` ADD CONSTRAINT `PromptCategory_promptId_fkey` FOREIGN KEY (`promptId`) REFERENCES `JournalPrompt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptCategory` ADD CONSTRAINT `PromptCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JourneyDay` ADD CONSTRAINT `JourneyDay_journeyId_fkey` FOREIGN KEY (`journeyId`) REFERENCES `Journey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JourneyDay` ADD CONSTRAINT `JourneyDay_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JourneyEnrollment` ADD CONSTRAINT `JourneyEnrollment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JourneyEnrollment` ADD CONSTRAINT `JourneyEnrollment_journeyId_fkey` FOREIGN KEY (`journeyId`) REFERENCES `Journey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledDailyCard` ADD CONSTRAINT `ScheduledDailyCard_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_moodCheckInId_fkey` FOREIGN KEY (`moodCheckInId`) REFERENCES `MoodCheckIn`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_drawId_fkey` FOREIGN KEY (`drawId`) REFERENCES `CardDraw`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryVersion` ADD CONSTRAINT `JournalEntryVersion_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryTag` ADD CONSTRAINT `JournalEntryTag_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryTag` ADD CONSTRAINT `JournalEntryTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceNote` ADD CONSTRAINT `VoiceNote_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoodCheckIn` ADD CONSTRAINT `MoodCheckIn_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoodCheckIn` ADD CONSTRAINT `MoodCheckIn_linkedCardId_fkey` FOREIGN KEY (`linkedCardId`) REFERENCES `Card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoodCheckIn` ADD CONSTRAINT `MoodCheckIn_linkedDrawId_fkey` FOREIGN KEY (`linkedDrawId`) REFERENCES `CardDraw`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardDraw` ADD CONSTRAINT `CardDraw_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardDraw` ADD CONSTRAINT `CardDraw_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedCard` ADD CONSTRAINT `SavedCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedCard` ADD CONSTRAINT `SavedCard_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `PricingPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_appliesToPlanId_fkey` FOREIGN KEY (`appliesToPlanId`) REFERENCES `PricingPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardUnlock` ADD CONSTRAINT `CardUnlock_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardUnlock` ADD CONSTRAINT `CardUnlock_guestSessionId_fkey` FOREIGN KEY (`guestSessionId`) REFERENCES `GuestSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardUnlock` ADD CONSTRAINT `CardUnlock_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_cardUnlockId_fkey` FOREIGN KEY (`cardUnlockId`) REFERENCES `CardUnlock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationCampaign` ADD CONSTRAINT `NotificationCampaign_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `NotificationTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportRequest` ADD CONSTRAINT `ExportRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataDeletionRequest` ADD CONSTRAINT `DataDeletionRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
