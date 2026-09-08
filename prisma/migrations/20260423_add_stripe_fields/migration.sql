-- AlterTable
ALTER TABLE `GuestSession` ADD COLUMN `stripeCustomerId` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `failureReason` VARCHAR(255) NULL,
    ADD COLUMN `stripeCustomerId` VARCHAR(64) NULL,
    ADD COLUMN `stripeStatus` VARCHAR(40) NULL,
    ADD COLUMN `type` ENUM('SUBSCRIPTION', 'CARD_UNLOCK', 'REFUND') NULL;

-- CreateIndex
CREATE UNIQUE INDEX `GuestSession_stripeCustomerId_key` ON `GuestSession`(`stripeCustomerId`);

-- CreateIndex
CREATE INDEX `Payment_guestSessionId_createdAt_idx` ON `Payment`(`guestSessionId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Payment_stripeCustomerId_idx` ON `Payment`(`stripeCustomerId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_guestSessionId_fkey` FOREIGN KEY (`guestSessionId`) REFERENCES `GuestSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
