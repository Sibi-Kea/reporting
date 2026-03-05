-- CreateTable
CREATE TABLE "StructureLeader" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "regionId" TEXT,
    "zoneId" TEXT,
    "homecellId" TEXT,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "parentLeaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureLeader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructureLeader_churchId_role_idx" ON "StructureLeader"("churchId", "role");

-- CreateIndex
CREATE INDEX "StructureLeader_churchId_regionId_idx" ON "StructureLeader"("churchId", "regionId");

-- CreateIndex
CREATE INDEX "StructureLeader_churchId_zoneId_idx" ON "StructureLeader"("churchId", "zoneId");

-- CreateIndex
CREATE INDEX "StructureLeader_churchId_homecellId_idx" ON "StructureLeader"("churchId", "homecellId");

-- CreateIndex
CREATE INDEX "StructureLeader_parentLeaderId_idx" ON "StructureLeader"("parentLeaderId");

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_homecellId_fkey" FOREIGN KEY ("homecellId") REFERENCES "Homecell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureLeader" ADD CONSTRAINT "StructureLeader_parentLeaderId_fkey" FOREIGN KEY ("parentLeaderId") REFERENCES "StructureLeader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
