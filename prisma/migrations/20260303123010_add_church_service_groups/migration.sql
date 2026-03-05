-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "attendanceEveningServiceLabels" TEXT[] DEFAULT ARRAY['South PM']::TEXT[],
ADD COLUMN     "attendanceMorningServiceLabels" TEXT[] DEFAULT ARRAY['North AM1', 'South AM', 'South AM2']::TEXT[],
ADD COLUMN     "attendanceOnlineServiceLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];
