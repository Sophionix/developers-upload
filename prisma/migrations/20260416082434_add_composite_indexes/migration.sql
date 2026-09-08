-- DropIndex
DROP INDEX `User_createdAt_idx` ON `User`;

-- CreateIndex
CREATE INDEX `Card_isActive_sortOrder_id_idx` ON `Card`(`isActive`, `sortOrder`, `id`);

-- CreateIndex
CREATE INDEX `User_createdAt_id_idx` ON `User`(`createdAt`, `id`);
