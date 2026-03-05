-- CreateTable
CREATE TABLE "LeaderAttendanceSelfReport" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reporterRole" "Role" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderAttendanceSelfReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderAttendanceSelfReport_churchId_reporterRole_createdAt_idx" ON "LeaderAttendanceSelfReport"("churchId", "reporterRole", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderAttendanceSelfReport_churchId_serviceId_reporterUserI_key" ON "LeaderAttendanceSelfReport"("churchId", "serviceId", "reporterUserId");

-- AddForeignKey
ALTER TABLE "LeaderAttendanceSelfReport" ADD CONSTRAINT "LeaderAttendanceSelfReport_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderAttendanceSelfReport" ADD CONSTRAINT "LeaderAttendanceSelfReport_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderAttendanceSelfReport" ADD CONSTRAINT "LeaderAttendanceSelfReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
