/**
 * Session phase derived from the auth provider.
 *
 * `loading`, `anonymous` and `signed_in` cannot overlap. Profile fields
 * (org, role) are filled before `loading` flips to false, except for a
 * token refresh of the same user, which keeps the current profile on screen.
 */

export const APP_ROLES = ["hq_admin", "group_admin", "agent"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function parseRole(value: unknown): AppRole | null {
  return value === "hq_admin" || value === "group_admin" || value === "agent" ? value : null;
}

export function isHqRole(value: unknown): boolean {
  return value === "hq_admin";
}

export type AuthPhase = "loading" | "anonymous" | "signed_in";

export function deriveAuthPhase(loading: boolean, hasUser: boolean): AuthPhase {
  if (loading) return "loading";
  return hasUser ? "signed_in" : "anonymous";
}

export const ORG_TYPES = ["hq", "selling_group"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export function parseOrgType(value: unknown): OrgType | null {
  return value === "hq" || value === "selling_group" ? value : null;
}
