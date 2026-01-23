"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireTenantAccess = requireTenantAccess;
exports.requireOrganizationAccess = requireOrganizationAccess;
exports.setCustomClaims = setCustomClaims;
exports.getUserCustomClaims = getUserCustomClaims;
exports.getUserTenantIds = getUserTenantIds;
exports.getUserOrganizationId = getUserOrganizationId;
exports.addUserToTenantClaims = addUserToTenantClaims;
exports.removeUserFromTenantClaims = removeUserFromTenantClaims;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
function requireAuth(context) {
    if (!context.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
}
async function requireTenantAccess(context, tenantId) {
    const tenantIds = context.auth.token.tenantIds;
    if (!tenantIds || !tenantIds.includes(tenantId)) {
        throw new https_1.HttpsError("permission-denied", "User does not have access to this tenant");
    }
}
async function requireOrganizationAccess(context, organizationId) {
    const userOrgId = context.auth.token.organizationId;
    if (userOrgId !== organizationId) {
        throw new https_1.HttpsError("permission-denied", "User does not have access to this organization");
    }
}
/**
 * Set Custom Claims for multi-tenant multi-organization support
 */
async function setCustomClaims(uid, claims) {
    await admin.auth().setCustomUserClaims(uid, claims);
}
/**
 * Get user's custom claims
 */
async function getUserCustomClaims(uid) {
    const user = await admin.auth().getUser(uid);
    return (user.customClaims || {});
}
/**
 * Get user's tenant IDs (backward compatibility)
 */
async function getUserTenantIds(uid) {
    const claims = await getUserCustomClaims(uid);
    return claims.tenantIds || [];
}
/**
 * Get user's organization ID
 */
async function getUserOrganizationId(uid) {
    const claims = await getUserCustomClaims(uid);
    return claims.organizationId || null;
}
/**
 * Add user to tenant with role
 */
async function addUserToTenantClaims(uid, tenantId, role) {
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
async function removeUserFromTenantClaims(uid, tenantId) {
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
//# sourceMappingURL=middleware.js.map