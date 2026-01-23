import * as admin from "firebase-admin";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export type UserRole = "owner" | "manager" | "staff" | "accountant";

export interface CustomClaims {
  organizationId?: string;
  tenantIds?: string[];
  roles?: Record<string, UserRole>;
}

export interface AuthenticatedContext extends CallableRequest {
  auth: NonNullable<CallableRequest["auth"]>;
}

export function requireAuth(context: CallableRequest): asserts context is AuthenticatedContext {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
}

export async function requireTenantAccess(
  context: AuthenticatedContext,
  tenantId: string
): Promise<void> {
  const tenantIds = context.auth.token.tenantIds as string[] | undefined;

  if (!tenantIds || !tenantIds.includes(tenantId)) {
    throw new HttpsError("permission-denied", "User does not have access to this tenant");
  }
}

export async function requireOrganizationAccess(
  context: AuthenticatedContext,
  organizationId: string
): Promise<void> {
  const userOrgId = context.auth.token.organizationId as string | undefined;

  if (userOrgId !== organizationId) {
    throw new HttpsError("permission-denied", "User does not have access to this organization");
  }
}

/**
 * Set Custom Claims for multi-tenant multi-organization support
 */
export async function setCustomClaims(
  uid: string,
  claims: {
    organizationId: string;
    tenantIds: string[];
    roles: Record<string, UserRole>;
  }
): Promise<void> {
  await admin.auth().setCustomUserClaims(uid, claims);
}

/**
 * Get user's custom claims
 */
export async function getUserCustomClaims(uid: string): Promise<CustomClaims> {
  const user = await admin.auth().getUser(uid);
  return (user.customClaims || {}) as CustomClaims;
}

/**
 * Get user's tenant IDs (backward compatibility)
 */
export async function getUserTenantIds(uid: string): Promise<string[]> {
  const claims = await getUserCustomClaims(uid);
  return claims.tenantIds || [];
}

/**
 * Get user's organization ID
 */
export async function getUserOrganizationId(uid: string): Promise<string | null> {
  const claims = await getUserCustomClaims(uid);
  return claims.organizationId || null;
}

/**
 * Add user to tenant with role
 */
export async function addUserToTenantClaims(
  uid: string,
  tenantId: string,
  role: UserRole
): Promise<void> {
  const claims = await getUserCustomClaims(uid);
  const tenantIds = claims.tenantIds || [];
  const roles = claims.roles || {};

  if (!tenantIds.includes(tenantId)) {
    tenantIds.push(tenantId);
  }

  roles[tenantId] = role;

  await admin.auth().setCustomUserClaims(uid, {
    ...claims,
    tenantIds,
    roles,
  });
}

/**
 * Remove user from tenant
 */
export async function removeUserFromTenantClaims(
  uid: string,
  tenantId: string
): Promise<void> {
  const claims = await getUserCustomClaims(uid);
  const tenantIds = (claims.tenantIds || []).filter((id) => id !== tenantId);
  const roles = { ...(claims.roles || {}) };
  delete roles[tenantId];

  await admin.auth().setCustomUserClaims(uid, {
    ...claims,
    tenantIds,
    roles,
  });
}
