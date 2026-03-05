import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, set, startOfMonth, subDays, subMonths } from "date-fns";

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.memberLtvStatus.deleteMany();
  await prisma.financeTransaction.deleteMany();
  await prisma.homecellReportItem.deleteMany();
  await prisma.homecellReport.deleteMany();
  await prisma.leaderAttendanceSelfReport.deleteMany();
  await prisma.attendanceEntry.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.service.deleteMany();
  await prisma.memberNote.deleteMany();
  await prisma.visitor.deleteMany();
  await prisma.member.deleteMany();
  await prisma.department.deleteMany();
  await prisma.structureLeader.deleteMany();
  await prisma.homecell.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.region.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.church.deleteMany();
}

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const superAdmin = await prisma.user.create({
    data: {
      name: "System Super Admin",
      email: "superadmin@churchflow.com",
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  const staffUsers = await Promise.all(
    [
      { name: "Pastor Samuel Reed", email: "pastor@gracecentral.com", role: Role.PASTOR },
      { name: "Overseer Lydia Mensah", email: "overseer1@gracecentral.com", role: Role.OVERSEER },
      { name: "Overseer Mark Ellis", email: "overseer2@gracecentral.com", role: Role.OVERSEER },
      { name: "Supervisor David Cole", email: "supervisor1@gracecentral.com", role: Role.SUPERVISOR },
      { name: "Supervisor Sarah Holt", email: "supervisor2@gracecentral.com", role: Role.SUPERVISOR },
      { name: "Coordinator Ruth Klein", email: "coordinator1@gracecentral.com", role: Role.COORDINATOR },
      { name: "Coordinator Peter Lang", email: "coordinator2@gracecentral.com", role: Role.COORDINATOR },
      { name: "Leader Joy Taylor", email: "leader1@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Michael Dean", email: "leader2@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Anita Wells", email: "leader3@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Kelvin Ross", email: "leader4@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Overseer Felix Grant", email: "overseer3@gracecentral.com", role: Role.OVERSEER },
      { name: "Supervisor Nia Brooks", email: "supervisor3@gracecentral.com", role: Role.SUPERVISOR },
      { name: "Supervisor Leo Finch", email: "supervisor4@gracecentral.com", role: Role.SUPERVISOR },
      { name: "Coordinator Faith Young", email: "coordinator3@gracecentral.com", role: Role.COORDINATOR },
      { name: "Coordinator Aaron Mills", email: "coordinator4@gracecentral.com", role: Role.COORDINATOR },
      { name: "Leader Gloria West", email: "leader5@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Caleb Hart", email: "leader6@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Diana Cole", email: "leader7@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Leader Joel Simon", email: "leader8@gracecentral.com", role: Role.HOMECELL_LEADER },
      { name: "Admin Grace Nelson", email: "admin@gracecentral.com", role: Role.CHURCH_ADMIN },
      { name: "Finance Naomi Hill", email: "finance@gracecentral.com", role: Role.FINANCE_ADMIN },
    ].map((user) =>
      prisma.user.create({
        data: {
          ...user,
          passwordHash,
          isActive: true,
        },
      }),
    ),
  );

  const [
    pastor,
    overseerOne,
    overseerTwo,
    supervisorOne,
    supervisorTwo,
    coordinatorOne,
    coordinatorTwo,
    leaderOne,
    leaderTwo,
    leaderThree,
    leaderFour,
    overseerThree,
    supervisorThree,
    supervisorFour,
    coordinatorThree,
    coordinatorFour,
    leaderFive,
    leaderSix,
    leaderSeven,
    leaderEight,
    churchAdmin,
    financeAdmin,
  ] = staffUsers;

  const church = await prisma.church.create({
    data: {
      name: "Christian Revival Church (CRC)",
      slug: "crc",
      email: "hello@crc.church",
      phone: "+1-555-0100",
      address: "100 Revival Avenue, Springfield",
      pastorId: pastor.id,
      createdById: superAdmin.id,
    },
  });

  await prisma.user.updateMany({
    where: { id: { in: [superAdmin.id, ...staffUsers.map((user) => user.id)] } },
    data: { churchId: church.id },
  });

  const northRegion = await prisma.region.create({
    data: {
      churchId: church.id,
      name: "North Region",
      leaderId: overseerOne.id,
    },
  });

  const southRegion = await prisma.region.create({
    data: {
      churchId: church.id,
      name: "South Region",
      leaderId: overseerThree.id,
    },
  });

  const zoneA = await prisma.zone.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      name: "Zone A",
      leaderId: pastor.id,
    },
  });

  const zoneB = await prisma.zone.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      name: "Zone B",
      leaderId: supervisorOne.id,
    },
  });

  const zoneC = await prisma.zone.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      name: "Zone C",
      leaderId: supervisorThree.id,
    },
  });

  const zoneD = await prisma.zone.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      name: "Zone D",
      leaderId: supervisorFour.id,
    },
  });

  const homecellAlpha = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      name: "Homecell Alpha",
      leaderId: leaderOne.id,
      meetingDay: "Wednesday",
      meetingTime: "18:30",
    },
  });

  const homecellBeta = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneB.id,
      name: "Homecell Beta",
      leaderId: leaderTwo.id,
      meetingDay: "Friday",
      meetingTime: "19:00",
    },
  });

  const homecellGamma = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      name: "Homecell Gamma",
      leaderId: leaderThree.id,
      meetingDay: "Thursday",
      meetingTime: "18:00",
    },
  });

  const homecellDelta = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneB.id,
      name: "Homecell Delta",
      leaderId: leaderFour.id,
      meetingDay: "Saturday",
      meetingTime: "16:30",
    },
  });

  const homecellEpsilon = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      name: "Homecell Epsilon",
      leaderId: leaderFive.id,
      meetingDay: "Tuesday",
      meetingTime: "19:00",
    },
  });

  const homecellZeta = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      name: "Homecell Zeta",
      leaderId: leaderSix.id,
      meetingDay: "Thursday",
      meetingTime: "19:30",
    },
  });

  const homecellEta = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneD.id,
      name: "Homecell Eta",
      leaderId: leaderSeven.id,
      meetingDay: "Wednesday",
      meetingTime: "18:00",
    },
  });

  const homecellTheta = await prisma.homecell.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneD.id,
      name: "Homecell Theta",
      leaderId: leaderEight.id,
      meetingDay: "Friday",
      meetingTime: "18:30",
    },
  });

  const zoneAOverseerOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: overseerOne.id,
      role: Role.OVERSEER,
    },
  });

  const zoneAOverseerTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: overseerTwo.id,
      role: Role.OVERSEER,
    },
  });

  const zoneASupervisorOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: supervisorOne.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneAOverseerOne.id,
    },
  });

  const zoneASupervisorTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: supervisorTwo.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneAOverseerTwo.id,
    },
  });

  const zoneACoordinatorOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: coordinatorOne.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneASupervisorOne.id,
    },
  });

  const zoneACoordinatorTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneA.id,
      userId: coordinatorTwo.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneASupervisorTwo.id,
    },
  });

  const zoneBOverseer = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneB.id,
      userId: overseerTwo.id,
      role: Role.OVERSEER,
    },
  });

  const zoneBSupervisor = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneB.id,
      userId: supervisorOne.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneBOverseer.id,
    },
  });

  const zoneBCoordinator = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: northRegion.id,
      zoneId: zoneB.id,
      userId: coordinatorOne.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneBSupervisor.id,
    },
  });

  const zoneCOverseerOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: overseerThree.id,
      role: Role.OVERSEER,
    },
  });

  const zoneCOverseerTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: overseerTwo.id,
      role: Role.OVERSEER,
    },
  });

  const zoneCSupervisorOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: supervisorThree.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneCOverseerOne.id,
    },
  });

  const zoneCSupervisorTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: supervisorFour.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneCOverseerTwo.id,
    },
  });

  const zoneCCoordinatorOne = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: coordinatorThree.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneCSupervisorOne.id,
    },
  });

  const zoneCCoordinatorTwo = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneC.id,
      userId: coordinatorFour.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneCSupervisorTwo.id,
    },
  });

  const zoneDOverseer = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneD.id,
      userId: overseerThree.id,
      role: Role.OVERSEER,
    },
  });

  const zoneDSupervisor = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneD.id,
      userId: supervisorFour.id,
      role: Role.SUPERVISOR,
      parentLeaderId: zoneDOverseer.id,
    },
  });

  const zoneDCoordinator = await prisma.structureLeader.create({
    data: {
      churchId: church.id,
      regionId: southRegion.id,
      zoneId: zoneD.id,
      userId: coordinatorFour.id,
      role: Role.COORDINATOR,
      parentLeaderId: zoneDSupervisor.id,
    },
  });

  await prisma.structureLeader.createMany({
    data: [
      {
        churchId: church.id,
        regionId: northRegion.id,
        zoneId: zoneA.id,
        homecellId: homecellAlpha.id,
        userId: leaderOne.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneACoordinatorOne.id,
      },
      {
        churchId: church.id,
        regionId: northRegion.id,
        zoneId: zoneA.id,
        homecellId: homecellGamma.id,
        userId: leaderThree.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneACoordinatorTwo.id,
      },
      {
        churchId: church.id,
        regionId: northRegion.id,
        zoneId: zoneB.id,
        homecellId: homecellBeta.id,
        userId: leaderTwo.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneBCoordinator.id,
      },
      {
        churchId: church.id,
        regionId: northRegion.id,
        zoneId: zoneB.id,
        homecellId: homecellDelta.id,
        userId: leaderFour.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneBCoordinator.id,
      },
      {
        churchId: church.id,
        regionId: southRegion.id,
        zoneId: zoneC.id,
        homecellId: homecellEpsilon.id,
        userId: leaderFive.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneCCoordinatorOne.id,
      },
      {
        churchId: church.id,
        regionId: southRegion.id,
        zoneId: zoneC.id,
        homecellId: homecellZeta.id,
        userId: leaderSix.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneCCoordinatorTwo.id,
      },
      {
        churchId: church.id,
        regionId: southRegion.id,
        zoneId: zoneD.id,
        homecellId: homecellEta.id,
        userId: leaderSeven.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneDCoordinator.id,
      },
      {
        churchId: church.id,
        regionId: southRegion.id,
        zoneId: zoneD.id,
        homecellId: homecellTheta.id,
        userId: leaderEight.id,
        role: Role.HOMECELL_LEADER,
        parentLeaderId: zoneDCoordinator.id,
      },
    ],
  });

  const [choirDepartment, mediaDepartment] = await Promise.all([
    prisma.department.create({
      data: {
        churchId: church.id,
        name: "Choir",
      },
    }),
    prisma.department.create({
      data: {
        churchId: church.id,
        name: "Media",
      },
    }),
  ]);

  const memberSeeds = [
    ["Aisha", "Green", "FEMALE"],
    ["James", "Miller", "MALE"],
    ["Sofia", "Peters", "FEMALE"],
    ["Daniel", "Ford", "MALE"],
    ["Ethan", "Scott", "MALE"],
    ["Olivia", "Bennett", "FEMALE"],
    ["Lucas", "Carter", "MALE"],
    ["Mia", "Harper", "FEMALE"],
    ["Noah", "Floyd", "MALE"],
    ["Ava", "Banks", "FEMALE"],
    ["Liam", "Powell", "MALE"],
    ["Emma", "Stone", "FEMALE"],
    ["Henry", "Lewis", "MALE"],
    ["Nora", "Pierce", "FEMALE"],
    ["Caleb", "Young", "MALE"],
    ["Ivy", "Campbell", "FEMALE"],
    ["Owen", "King", "MALE"],
    ["Grace", "Diaz", "FEMALE"],
  ] as const;

  const members = await Promise.all(
    memberSeeds.map(([firstName, lastName, gender], index) =>
      prisma.member.create({
        data: {
          churchId: church.id,
          regionId: index % 4 < 2 ? northRegion.id : southRegion.id,
          zoneId: index % 4 === 0 ? zoneA.id : index % 4 === 1 ? zoneB.id : index % 4 === 2 ? zoneC.id : zoneD.id,
          homecellId:
            index % 8 === 0
              ? homecellAlpha.id
              : index % 8 === 1
                ? homecellBeta.id
                : index % 8 === 2
                  ? homecellGamma.id
                  : index % 8 === 3
                    ? homecellDelta.id
                    : index % 8 === 4
                      ? homecellEpsilon.id
                      : index % 8 === 5
                        ? homecellZeta.id
                        : index % 8 === 6
                          ? homecellEta.id
                          : homecellTheta.id,
          departmentId: index % 3 === 0 ? choirDepartment.id : mediaDepartment.id,
          firstName,
          lastName,
          gender,
          dateOfBirth: subDays(new Date(), 365 * (20 + (index % 22))),
          phone: `+1-555-01${String(index).padStart(2, "0")}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.com`,
          address: `${100 + index} Maple Street`,
          maritalStatus: index % 4 === 0 ? "MARRIED" : "SINGLE",
          occupation: index % 2 === 0 ? "Professional" : "Business Owner",
          dateJoined: subMonths(new Date(), index % 8),
          salvationStatus: true,
          baptismStatus: index % 2 === 0,
          membershipStatus: index % 7 === 0 ? "INACTIVE" : "ACTIVE",
          emergencyContactName: "Family Contact",
          emergencyContactPhone: "+1-555-9999",
        },
      }),
    ),
  );

  const sundayServices = Array.from({ length: 4 }).flatMap((_, index) => {
    const sundayDate = subDays(new Date(), index * 7);
    return [
      {
        title: "Sunday AM1",
        serviceType: "SUNDAY" as const,
        eventDate: set(sundayDate, { hours: 7, minutes: 0, seconds: 0, milliseconds: 0 }),
      },
      {
        title: "Sunday AM2",
        serviceType: "SUNDAY" as const,
        eventDate: set(sundayDate, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 }),
      },
      {
        title: "Sunday PM",
        serviceType: "SUNDAY" as const,
        eventDate: set(sundayDate, { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 }),
      },
    ];
  });

  const midweekServices = Array.from({ length: 4 }).map((_, index) => ({
    title: "Midweek Service",
    serviceType: "MIDWEEK" as const,
    eventDate: set(subDays(new Date(), index * 7 + 3), {
      hours: 18,
      minutes: 30,
      seconds: 0,
      milliseconds: 0,
    }),
  }));

  const services = await Promise.all(
    [...sundayServices, ...midweekServices].map((service) =>
      prisma.service.create({
        data: {
          churchId: church.id,
          title: service.title,
          serviceType: service.serviceType,
          eventDate: service.eventDate,
          createdById: churchAdmin.id,
        },
      }),
    ),
  );

  for (const [serviceIndex, service] of services.entries()) {
    const attendance = await prisma.attendanceRecord.create({
      data: {
        churchId: church.id,
        serviceId: service.id,
        markedById: supervisorOne.id,
      },
    });

    await prisma.attendanceEntry.createMany({
      data: members
        .filter((member) => !member.isDeleted)
        .map((member, memberIndex) => {
          const isPresent = (serviceIndex + memberIndex) % 5 !== 0;
          return {
            churchId: church.id,
            attendanceId: attendance.id,
            memberId: member.id,
            status: isPresent ? "PRESENT" : "ABSENT",
            absentReason: isPresent ? null : "Work",
            absentNote: isPresent ? null : "Shift conflict",
          };
        }),
    });
  }

  const reportWeeks = [0, 1, 2, 3];
  for (const weekOffset of reportWeeks) {
    const weekStart = startOfMonth(subMonths(new Date(), 0));
    const adjustedStart = addDays(weekStart, weekOffset * 7);
    const adjustedEnd = addDays(adjustedStart, 6);

    for (const homecell of [
      homecellAlpha,
      homecellBeta,
      homecellGamma,
      homecellDelta,
      homecellEpsilon,
      homecellZeta,
      homecellEta,
      homecellTheta,
    ]) {
      const homecellMembers = members.filter((member) => member.homecellId === homecell.id);
      const presentCount = Math.max(homecellMembers.length - (weekOffset % 3), 0);

      const report = await prisma.homecellReport.create({
        data: {
          churchId: church.id,
          homecellId: homecell.id,
          submittedById: homecell.leaderId ?? leaderOne.id,
          weekStartDate: adjustedStart,
          weekEndDate: adjustedEnd,
          totalMembers: homecellMembers.length,
          membersPresent: presentCount,
          membersAbsent: homecellMembers.length - presentCount,
          visitors: 2 + (weekOffset % 2),
          firstTimeVisitors: 1,
          prayerRequests: "Prayers for families and careers.",
          offeringCollected: new Prisma.Decimal(120 + weekOffset * 10),
          isLocked: weekOffset < 2,
        },
      });

      await prisma.homecellReportItem.createMany({
        data: homecellMembers.map((member, index) => ({
          churchId: church.id,
          reportId: report.id,
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`,
          present: index < presentCount,
          absenceReason: index < presentCount ? null : "Work",
          absenceNote: index < presentCount ? null : "Unavailable",
        })),
    });
  }

  const leadershipSelfReporters = [
    { userId: overseerOne.id, role: Role.OVERSEER },
    { userId: supervisorOne.id, role: Role.SUPERVISOR },
    { userId: coordinatorOne.id, role: Role.COORDINATOR },
    { userId: churchAdmin.id, role: Role.CHURCH_ADMIN },
  ];

  for (const [serviceIndex, service] of services.slice(0, 8).entries()) {
    await prisma.leaderAttendanceSelfReport.createMany({
      data: leadershipSelfReporters.map((reporter, reporterIndex) => ({
        churchId: church.id,
        serviceId: service.id,
        reporterUserId: reporter.userId,
        reporterRole: reporter.role,
        status: (serviceIndex + reporterIndex) % 4 === 0 ? "ABSENT" : "PRESENT",
        note:
          (serviceIndex + reporterIndex) % 4 === 0
            ? "Submitted self report: leadership duty conflict."
            : "Submitted self report: present and monitoring structure attendance.",
      })),
      skipDuplicates: true,
    });
  }
  }

  await prisma.visitor.createMany({
    data: Array.from({ length: 10 }).map((_, index) => ({
      churchId: church.id,
      firstName: `Visitor${index + 1}`,
      lastName: "Sample",
      phone: `+1-444-02${String(index).padStart(2, "0")}`,
      invitedBy: index % 2 === 0 ? "Member referral" : "Community outreach",
      firstTime: index % 3 !== 0,
      firstVisitDate: subDays(new Date(), index * 5),
      followUpStatus:
        index % 4 === 0
          ? "PENDING"
          : index % 4 === 1
            ? "CONTACTED"
            : index % 4 === 2
              ? "SCHEDULED"
              : "COMPLETED",
      convertedToMember: index % 5 === 0,
      notes: "Follow-up needed within 48 hours.",
    })),
  });

  await prisma.financeTransaction.createMany({
    data: members.slice(0, 14).flatMap((member, index) =>
      Array.from({ length: 4 }).map((_, monthOffset) => ({
        churchId: church.id,
        memberId: member.id,
        serviceId: services[monthOffset % services.length].id,
        capturedById: financeAdmin.id,
        financeType: monthOffset % 2 === 0 ? "TITHE" : "OFFERING",
        amount: new Prisma.Decimal(60 + index * 5 + monthOffset * 3),
        paymentMethod: monthOffset % 2 === 0 ? "TRANSFER" : "CASH",
        transactionDate: subMonths(new Date(), monthOffset),
        note: "Seeded transaction",
      })),
    ),
  });

  const currentMonthStart = startOfMonth(new Date());
  await prisma.memberLtvStatus.createMany({
    data: members.map((member, index) => ({
      churchId: church.id,
      memberId: member.id,
      monthStartDate: currentMonthStart,
      isLeader: Boolean(member.homecellId && index % 6 === 0),
      isTither: index % 3 === 0,
      isVolunteer: Boolean(member.departmentId),
      attendanceRate: 65 + (index % 30),
      badgeCount: (index % 3 === 0 ? 1 : 0) + (index % 6 === 0 ? 1 : 0) + 1,
    })),
  });

  await prisma.notification.createMany({
    data: [
      {
        churchId: church.id,
        userId: pastor.id,
        type: "ALERT",
        title: "Follow-up pending",
        message: "5 visitors still need follow-up this week.",
        actionUrl: "/dashboard/visitors",
      },
      {
        churchId: church.id,
        userId: supervisorOne.id,
        type: "REMINDER",
        title: "Homecell report due",
        message: "Homecell Alpha report is due by Sunday evening.",
        actionUrl: "/dashboard/homecells/reports",
      },
      {
        churchId: church.id,
        userId: financeAdmin.id,
        type: "SYSTEM",
        title: "Monthly finance export",
        message: "Finance reconciliation can now be exported.",
        actionUrl: "/dashboard/exports",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Super Admin:", superAdmin.email, "Password: Password123!");
  console.log("Pastor:", pastor.email, "Password: Password123!");
  console.log("Finance:", financeAdmin.email, "Password: Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
