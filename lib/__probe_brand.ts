import type { AdminIdentity } from "@/lib/admin/session";

export const forgedA = {
  adminId: "00000000-0000-0000-0000-000000000000",
  role: "owner" as const,
  email: "attacker@example.com",
} as AdminIdentity;

export const forgedB = {} as unknown as AdminIdentity;
export const forgedC = JSON.parse("{}") as AdminIdentity;
export const forgedD: AdminIdentity = { ...forgedA, adminId: "x" };
