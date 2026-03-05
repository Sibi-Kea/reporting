import { randomUUID } from "node:crypto";

type Role =
  | "SUPER_ADMIN"
  | "PASTOR"
  | "OVERSEER"
  | "SUPERVISOR"
  | "COORDINATOR"
  | "HOMECELL_LEADER"
  | "CHURCH_ADMIN"
  | "FINANCE_ADMIN";

type Permission =
  | "church:create"
  | "members:view"
  | "attendance:view"
  | "homecell_reports:view"
  | "visitors:view"
  | "finance:view"
  | "analytics:view"
  | "notifications:view"
  | "exports:run";

const BASE_URL = process.env.QA_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const PASSWORD = process.env.QA_PASSWORD || "Password123!";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "church:create",
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "finance:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  PASTOR: [
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "finance:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  OVERSEER: [
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  SUPERVISOR: [
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  COORDINATOR: [
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  HOMECELL_LEADER: ["members:view", "attendance:view", "homecell_reports:view", "visitors:view", "notifications:view"],
  CHURCH_ADMIN: [
    "members:view",
    "attendance:view",
    "homecell_reports:view",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  FINANCE_ADMIN: ["members:view", "finance:view", "analytics:view", "notifications:view", "exports:run"],
};

const ROLE_USERS: Array<{ role: Role; email: string }> = [
  { role: "SUPER_ADMIN", email: "superadmin@churchflow.com" },
  { role: "PASTOR", email: "pastor@gracecentral.com" },
  { role: "OVERSEER", email: "overseer1@gracecentral.com" },
  { role: "SUPERVISOR", email: "supervisor1@gracecentral.com" },
  { role: "COORDINATOR", email: "coordinator1@gracecentral.com" },
  { role: "HOMECELL_LEADER", email: "leader1@gracecentral.com" },
  { role: "CHURCH_ADMIN", email: "admin@gracecentral.com" },
  { role: "FINANCE_ADMIN", email: "finance@gracecentral.com" },
];

const PAGE_CHECKS: Array<{ path: string; permission?: Permission }> = [
  { path: "/dashboard" },
  { path: "/dashboard/reports", permission: "homecell_reports:view" },
  { path: "/dashboard/hierarchy", permission: "members:view" },
  { path: "/dashboard/members", permission: "members:view" },
  { path: "/dashboard/attendance", permission: "attendance:view" },
  { path: "/dashboard/homecells/reports", permission: "homecell_reports:view" },
  { path: "/dashboard/visitors", permission: "visitors:view" },
  { path: "/dashboard/finance", permission: "finance:view" },
  { path: "/dashboard/analytics", permission: "analytics:view" },
  { path: "/dashboard/notifications", permission: "notifications:view" },
  { path: "/dashboard/exports", permission: "exports:run" },
  { path: "/dashboard/admin/churches", permission: "church:create" },
];

function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function canAccessPage(user: { role: Role; email: string }, check: { path: string; permission?: Permission }) {
  return check.permission ? hasPermission(user.role, check.permission) : true;
}

class CookieJar {
  private cookies = new Map<string, string>();

  merge(setCookieHeaders: string[]) {
    for (const setCookie of setCookieHeaders) {
      const [pair] = setCookie.split(";");
      const equalsIndex = pair.indexOf("=");
      if (equalsIndex <= 0) continue;
      const key = pair.slice(0, equalsIndex).trim();
      const value = pair.slice(equalsIndex + 1).trim();
      this.cookies.set(key, value);
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

function getSetCookies(response: Response) {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

async function requestWithRetry(
  url: string,
  init: RequestInit = {},
  retries = 3,
  timeoutMs = 120_000,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  throw lastError;
}

async function login(email: string, password: string) {
  const jar = new CookieJar();

  const csrfResponse = await requestWithRetry(`${BASE_URL}/api/auth/csrf`, {
    method: "GET",
    redirect: "manual",
  });
  jar.merge(getSetCookies(csrfResponse));
  const csrfPayload = (await csrfResponse.json()) as { csrfToken: string };

  const callbackBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email,
    password,
    callbackUrl: `${BASE_URL}/dashboard`,
    json: "true",
  });

  const callbackResponse = await requestWithRetry(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    body: callbackBody.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.toHeader(),
    },
    redirect: "manual",
  });

  jar.merge(getSetCookies(callbackResponse));

  const sessionResponse = await requestWithRetry(`${BASE_URL}/api/auth/session`, {
    method: "GET",
    headers: {
      Cookie: jar.toHeader(),
    },
  });
  const session = (await sessionResponse.json()) as {
    user?: { email?: string; role?: Role };
  };

  if (session.user?.email !== email) {
    throw new Error(`Login failed for ${email}`);
  }

  return jar;
}

async function run() {
  const failures: string[] = [];
  const notes: string[] = [];

  notes.push(`Smoke check target: ${BASE_URL}`);

  for (const user of ROLE_USERS) {
    const jar = await login(user.email, PASSWORD);
    notes.push(`Login OK: ${user.role} (${user.email})`);

    for (const check of PAGE_CHECKS) {
      const expectedAllowed = canAccessPage(user, check);
      const response = await requestWithRetry(`${BASE_URL}${check.path}`, {
        method: "GET",
        headers: { Cookie: jar.toHeader() },
        redirect: "manual",
      });

      const location = response.headers.get("location") ?? "";

      if (expectedAllowed) {
        if (response.status !== 200) {
          failures.push(
            `${user.role} expected access to ${check.path}, got ${response.status} ${location}`,
          );
        }
      } else {
        const blocked = response.status >= 300 && response.status < 400 && location.includes("/dashboard");
        if (!blocked) {
          failures.push(
            `${user.role} expected blocked at ${check.path}, got ${response.status} ${location}`,
          );
        }
      }
    }
  }

  const churchAdminJar = await login("admin@gracecentral.com", PASSWORD);
  const financeAdminJar = await login("finance@gracecentral.com", PASSWORD);

  const uniqueToken = randomUUID().slice(0, 8);
  const memberPayload = {
    firstName: "Qa",
    lastName: `Member${uniqueToken}`,
    gender: "MALE",
    dateJoined: new Date().toISOString().slice(0, 10),
    salvationStatus: true,
    baptismStatus: false,
    membershipStatus: "ACTIVE",
  };

  const createMember = await requestWithRetry(`${BASE_URL}/api/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: churchAdminJar.toHeader(),
    },
    body: JSON.stringify(memberPayload),
  });

  if (createMember.status !== 201) {
    failures.push(`Members POST failed with ${createMember.status}`);
  }

  const member = (await createMember.json()) as { id: string; firstName: string };
  if (!member.id) {
    failures.push("Members POST returned no id");
  } else {
    const patchMember = await requestWithRetry(`${BASE_URL}/api/members/${member.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: churchAdminJar.toHeader(),
      },
      body: JSON.stringify({
        ...memberPayload,
        firstName: "QaUpdated",
      }),
    });
    if (patchMember.status !== 200) {
      failures.push(`Members PATCH failed with ${patchMember.status}`);
    }

    const deleteMember = await requestWithRetry(`${BASE_URL}/api/members/${member.id}`, {
      method: "DELETE",
      headers: { Cookie: churchAdminJar.toHeader() },
    });
    if (deleteMember.status !== 200) {
      failures.push(`Members DELETE failed with ${deleteMember.status}`);
    }
  }

  const visitorPayload = {
    firstName: "QaVisitor",
    lastName: "Flow",
    phone: `+1555${Date.now().toString().slice(-6)}`,
    firstTime: true,
    firstVisitDate: new Date().toISOString().slice(0, 10),
    followUpStatus: "PENDING",
    convertedToMember: false,
  };

  const createVisitor = await requestWithRetry(`${BASE_URL}/api/visitors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: churchAdminJar.toHeader(),
    },
    body: JSON.stringify(visitorPayload),
  });
  if (createVisitor.status !== 201) {
    failures.push(`Visitors POST failed with ${createVisitor.status}`);
  }
  const visitor = (await createVisitor.json()) as { id: string };
  if (visitor.id) {
    const patchVisitor = await requestWithRetry(`${BASE_URL}/api/visitors/${visitor.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: churchAdminJar.toHeader(),
      },
      body: JSON.stringify({ followUpStatus: "CONTACTED" }),
    });
    if (patchVisitor.status !== 200) {
      failures.push(`Visitors PATCH failed with ${patchVisitor.status}`);
    }

    const deleteVisitor = await requestWithRetry(`${BASE_URL}/api/visitors/${visitor.id}`, {
      method: "DELETE",
      headers: { Cookie: churchAdminJar.toHeader() },
    });
    if (deleteVisitor.status !== 200) {
      failures.push(`Visitors DELETE failed with ${deleteVisitor.status}`);
    }
  }

  const createFinance = await requestWithRetry(`${BASE_URL}/api/finance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: financeAdminJar.toHeader(),
    },
    body: JSON.stringify({
      financeType: "TITHE",
      amount: 120,
      paymentMethod: "CASH",
      transactionDate: new Date().toISOString().slice(0, 10),
      note: "QA transaction",
    }),
  });

  if (createFinance.status !== 201) {
    failures.push(`Finance POST failed with ${createFinance.status}`);
  }
  const finance = (await createFinance.json()) as { id: string };
  if (finance.id) {
    const patchFinance = await requestWithRetry(`${BASE_URL}/api/finance/${finance.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: financeAdminJar.toHeader(),
      },
      body: JSON.stringify({ note: "QA transaction updated" }),
    });
    if (patchFinance.status !== 200) {
      failures.push(`Finance PATCH failed with ${patchFinance.status}`);
    }

    const deleteFinance = await requestWithRetry(`${BASE_URL}/api/finance/${finance.id}`, {
      method: "DELETE",
      headers: { Cookie: financeAdminJar.toHeader() },
    });
    if (deleteFinance.status !== 200) {
      failures.push(`Finance DELETE failed with ${deleteFinance.status}`);
    }
  }

  const homecellJar = await login("leader1@gracecentral.com", PASSWORD);
  const financeDenied = await requestWithRetry(`${BASE_URL}/api/finance`, {
    method: "GET",
    headers: { Cookie: homecellJar.toHeader() },
    redirect: "manual",
  });
  if (financeDenied.status !== 401) {
    failures.push(`Homecell leader should get 401 on /api/finance, got ${financeDenied.status}`);
  }

  const exportDenied = await requestWithRetry(`${BASE_URL}/api/exports/members`, {
    method: "GET",
    headers: { Cookie: homecellJar.toHeader() },
    redirect: "manual",
  });
  if (exportDenied.status !== 401) {
    failures.push(
      `Homecell leader should get 401 on /api/exports/members, got ${exportDenied.status}`,
    );
  }

  if (failures.length) {
    console.error("Smoke check failures:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Smoke check passed.");
  for (const note of notes) {
    console.log(`- ${note}`);
  }
}

run().catch((error) => {
  console.error("Smoke check crashed:", error);
  process.exit(1);
});
