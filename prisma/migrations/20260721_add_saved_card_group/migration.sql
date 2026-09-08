-- AlterTable
ALTER TABLE `SavedCard` ADD COLUMN `savedGroupId` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `SavedCard_userId_savedGroupId_idx` ON `SavedCard`(`userId`, `savedGroupId`);
