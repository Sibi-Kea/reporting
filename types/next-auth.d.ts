import { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      churchId: string | null;
    };
  }

  interface User {
    role: Role;
    churchId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    churchId?: string | null;
  }
}
