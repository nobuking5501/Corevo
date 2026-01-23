#!/usr/bin/env node

/**
 * Assign an existing user to an existing tenant
 * Usage: node assign-user-to-tenant.js <email> <tenant-id> <role>
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const [email, tenantId, role = "owner"] = process.argv.slice(2);

if (!email || !tenantId) {
  console.error("Usage: node assign-user-to-tenant.js <email> <tenant-id> <role>");
  console.error("       role: owner | manager | staff | accountant (default: owner)");
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || "./service-account-key.json";

try {
  const serviceAccountData = JSON.parse(readFileSync(serviceAccount, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountData),
  });
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function assignUserToTenant() {
  console.log(`Assigning user to tenant`);
  console.log(`Email: ${email}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Role: ${role}\n`);

  try {
    // Get user
    const user = await auth.getUserByEmail(email);
    console.log("Found user:", user.uid);

    // Check tenant exists
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.error(`❌ Tenant ${tenantId} not found!`);
      process.exit(1);
    }
    const tenant = tenantDoc.data();
    console.log("Found tenant:", tenant.name);

    // Get existing tenantIds from custom claims
    const currentClaims = user.customClaims || {};
    const currentTenantIds = currentClaims.tenantIds || [];

    // Add new tenant if not already present
    if (!currentTenantIds.includes(tenantId)) {
      const newTenantIds = [...currentTenantIds, tenantId];
      await auth.setCustomUserClaims(user.uid, {
        ...currentClaims,
        tenantIds: newTenantIds,
      });
      console.log("✅ Updated custom claims with tenant ID");
    } else {
      console.log("ℹ️  User already has access to this tenant");
    }

    // Create/update user doc in tenant
    const userDocRef = db.collection(`tenants/${tenantId}/users`).doc(user.uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      await userDocRef.set({
        tenantId,
        email: user.email,
        displayName: user.displayName || "ユーザー",
        role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Created user document in tenant");
    } else {
      await userDocRef.update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Updated user document in tenant");
    }

    console.log("\n=== Assignment complete! ===");
    console.log("User can now log in and access this tenant.");
  } catch (error) {
    console.error("Error assigning user:", error);
    process.exit(1);
  }
}

assignUserToTenant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
