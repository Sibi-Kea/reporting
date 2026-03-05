ALTER TABLE "Church"
ADD COLUMN "attendanceServiceLabels" TEXT[] NOT NULL DEFAULT ARRAY['North AM1', 'South AM', 'South AM2', 'South PM']::TEXT[];
