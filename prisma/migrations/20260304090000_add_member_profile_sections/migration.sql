-- Add new membership profiling fields for discipleship, baptism, and involvement tracking
ALTER TABLE "Member"
  ADD COLUMN "holySpiritBaptismStatus" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jimJohn316Status" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jimSgtStatus" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jimDiscStatus" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jimNltStatus" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "involvementNotes" TEXT;
