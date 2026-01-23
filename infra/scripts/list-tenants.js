#!/usr/bin/env node

/**
 * List all tenants
 * Usage: node list-tenants.js
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

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

async function listTenants() {
  console.log("=== All Tenants ===\n");

  try {
    const tenantsSnapshot = await db.collection("tenants").get();

    if (tenantsSnapshot.empty) {
      console.log("No tenants found.");
      return;
    }

    tenantsSnapshot.forEach((doc) => {
      const tenant = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${tenant.name}`);
      console.log(`Plan: ${tenant.plan}`);
      console.log(`Status: ${tenant.status}`);
      console.log("---");
    });

    console.log(`\nTotal: ${tenantsSnapshot.size} tenant(s)`);
  } catch (error) {
    console.error("Error listing tenants:", error);
    process.exit(1);
  }
}

listTenants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
