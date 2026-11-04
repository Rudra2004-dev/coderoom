-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "finalCode" TEXT,
ADD COLUMN     "finalLanguage" TEXT;

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "correctness" INTEGER NOT NULL,
    "codeQuality" INTEGER NOT NULL,
    "efficiency" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scorecard_roomId_key" ON "Scorecard"("roomId");

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
