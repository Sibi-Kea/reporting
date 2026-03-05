import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/options";

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

