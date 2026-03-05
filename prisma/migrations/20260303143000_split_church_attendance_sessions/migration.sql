ALTER TABLE "HomecellReportItem"
ADD COLUMN     "churchMorningPresent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "churchMorningAttendedLabel" TEXT,
ADD COLUMN     "churchMorningAbsenceReason" TEXT,
ADD COLUMN     "churchMorningAbsenceNote" TEXT,
ADD COLUMN     "churchEveningPresent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "churchEveningAttendedLabel" TEXT,
ADD COLUMN     "churchEveningAbsenceReason" TEXT,
ADD COLUMN     "churchEveningAbsenceNote" TEXT;

UPDATE "HomecellReportItem"
SET
  "churchMorningPresent" = COALESCE("churchPresent", true),
  "churchEveningPresent" = COALESCE("churchPresent", true),
  "churchMorningAttendedLabel" = CASE
    WHEN COALESCE(array_length("churchAttendedLabels", 1), 0) >= 1 THEN "churchAttendedLabels"[1]
    ELSE NULL
  END,
  "churchEveningAttendedLabel" = CASE
    WHEN COALESCE(array_length("churchAttendedLabels", 1), 0) >= 2 THEN "churchAttendedLabels"[2]
    ELSE NULL
  END,
  "churchMorningAbsenceReason" = CASE
    WHEN COALESCE("churchPresent", true) THEN NULL
    ELSE "churchAbsenceReason"
  END,
  "churchMorningAbsenceNote" = CASE
    WHEN COALESCE("churchPresent", true) THEN NULL
    ELSE "churchAbsenceNote"
  END,
  "churchEveningAbsenceReason" = CASE
    WHEN COALESCE("churchPresent", true) THEN NULL
    ELSE "churchAbsenceReason"
  END,
  "churchEveningAbsenceNote" = CASE
    WHEN COALESCE("churchPresent", true) THEN NULL
    ELSE "churchAbsenceNote"
  END;
