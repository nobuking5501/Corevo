#!/usr/bin/env node

/**
 * Provision a new production tenant
 * Usage: node provision-tenant.js <email> <password> <tenant-name>
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const [email, password, tenantName] = process.argv.slice(2);

if (!email || !password || !tenantName) {
  console.error("Usage: node provision-tenant.js <email> <password> <tenant-name>");
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

const db = admin.firestore();
const auth = admin.auth();

async function provisionTenant() {
  console.log(`Provisioning tenant: ${tenantName}`);
  console.log(`Owner email: ${email}`);

  try {
    // Create user
    const user = await auth.createUser({
      email,
      password,
      displayName: "オーナー",
    });
    console.log("Created user:", user.uid);

    // Create tenant
    const tenantRef = await db.collection("tenants").add({
      name: tenantName,
      plan: "trial",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tenantId = tenantRef.id;
    console.log("Created tenant:", tenantId);

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, { tenantIds: [tenantId] });

    // Create owner user doc
    await db.collection(`tenants/${tenantId}/users`).doc(user.uid).set({
      tenantId,
      email,
      displayName: "オーナー",
      role: "owner",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create settings
    await db.collection(`tenants/${tenantId}/settings`).doc("main").set({
      tenantId,
      businessHours: {
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
        thursday: { open: "09:00", close: "18:00" },
        friday: { open: "09:00", close: "18:00" },
        saturday: { open: "09:00", close: "18:00" },
        sunday: null,
      },
      featureFlags: {
        aiAutoSuggest: false,
        lineIntegration: false,
        advancedAnalytics: false,
      },
      billingStatus: {
        plan: "trial",
        periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n=== Tenant provisioned successfully! ===");
    console.log("Tenant ID:", tenantId);
    console.log("Owner Email:", email);
    console.log("Trial Period: 14 days");
  } catch (error) {
    console.error("Error provisioning tenant:", error);
    process.exit(1);
  }
}

provisionTenant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
