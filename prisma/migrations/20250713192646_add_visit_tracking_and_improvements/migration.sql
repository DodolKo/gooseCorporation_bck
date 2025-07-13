/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `GooseCorpStaff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uniqueId]` on the table `GooseCorpUser` will be added. If there are existing duplicate values, this will fail.
  - The required column `uniqueId` was added to the `GooseCorpUser` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('INSIDE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "VisitAction" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'RETURN');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitReason" ADD VALUE 'DELIVERY';
ALTER TYPE "VisitReason" ADD VALUE 'MAINTENANCE';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "GooseCorpFormation" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "instructor" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxAttendees" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GooseCorpStaff" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT;

-- AlterTable
ALTER TABLE "GooseCorpUser" ADD COLUMN     "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "checkOutTime" TIMESTAMP(3),
ADD COLUMN     "company" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "VisitStatus" NOT NULL DEFAULT 'INSIDE',
ADD COLUMN     "uniqueId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "visitorId" INTEGER NOT NULL,
    "action" "VisitAction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    "staffId" INTEGER,
    "formationId" INTEGER,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GooseCorpStaff_email_key" ON "GooseCorpStaff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GooseCorpUser_uniqueId_key" ON "GooseCorpUser"("uniqueId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "GooseCorpUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "GooseCorpStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "GooseCorpFormation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
