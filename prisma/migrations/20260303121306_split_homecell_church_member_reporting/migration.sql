-- AlterTable
ALTER TABLE "HomecellReportItem" ADD COLUMN     "churchAbsenceNote" TEXT,
ADD COLUMN     "churchAbsenceReason" TEXT,
ADD COLUMN     "churchAttendedLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "churchPresent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homecellAbsenceNote" TEXT,
ADD COLUMN     "homecellAbsenceReason" TEXT,
ADD COLUMN     "homecellPresent" BOOLEAN NOT NULL DEFAULT true;
