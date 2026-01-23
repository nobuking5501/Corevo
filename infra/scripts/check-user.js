#!/usr/bin/env node

/**
 * Check user details and custom claims
 * Usage: node check-user.js <email>
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage: node check-user.js <email>");
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

async function checkUser() {
  console.log(`Checking user: ${email}\n`);

  try {
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log("=== User Authentication ===");
    console.log("UID:", user.uid);
    console.log("Email:", user.email);
    console.log("Display Name:", user.displayName || "(none)");
    console.log("Custom Claims:", JSON.stringify(user.customClaims, null, 2));

    // Check tenant assignments
    const tenantIds = user.customClaims?.tenantIds || [];
    console.log("\n=== Tenant Assignments ===");
    console.log("Tenant IDs:", tenantIds);

    if (tenantIds.length === 0) {
      console.log("\n⚠️  WARNING: User has no tenant assignments!");
      console.log("   Run: node infra/scripts/provision-tenant.js to create a tenant");
      return;
    }

    // Check each tenant
    for (const tenantId of tenantIds) {
      console.log(`\n=== Tenant: ${tenantId} ===`);

      // Get tenant doc
      const tenantDoc = await db.collection("tenants").doc(tenantId).get();
      if (!tenantDoc.exists) {
        console.log("⚠️  Tenant document not found!");
        continue;
      }

      const tenant = tenantDoc.data();
      console.log("Name:", tenant.name);
      console.log("Plan:", tenant.plan);
      console.log("Status:", tenant.status);

      // Get user doc in tenant
      const userDoc = await db.collection(`tenants/${tenantId}/users`).doc(user.uid).get();
      if (!userDoc.exists) {
        console.log("⚠️  User document not found in tenant!");
        continue;
      }

      const userData = userDoc.data();
      console.log("Role:", userData.role);
      console.log("Display Name:", userData.displayName);
    }

    console.log("\n✅ User check complete!");
  } catch (error) {
    console.error("Error checking user:", error);
    process.exit(1);
  }
}

checkUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
