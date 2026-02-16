#!/usr/bin/env node

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and parse .env.local manually
const envPath = join(__dirname, "../apps/web/.env.local");
const envContent = readFileSync(envPath, "utf8");
const envVars = {};

envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

// Initialize production Firebase
const prodApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = prodApp.firestore();

async function checkData() {
  console.log("🔍 本番Firebaseのデータを確認中...\n");
  console.log("=" .repeat(60));

  try {
    // Check tenants
    const tenants = await db.collection("tenants").get();
    console.log(`\n📦 Tenants: ${tenants.size}件`);

    for (const tenantDoc of tenants.docs) {
      const tenantData = tenantDoc.data();
      console.log(`\n  - ${tenantDoc.id}: ${tenantData.name}`);

      // Check subcollections for this tenant
      const customers = await db.collection(`tenants/${tenantDoc.id}/customers`).get();
      const appointments = await db.collection(`tenants/${tenantDoc.id}/appointments`).get();
      const services = await db.collection(`tenants/${tenantDoc.id}/services`).get();
      const metrics = await db.collection(`tenants/${tenantDoc.id}/metrics`).get();
      const staffMembers = await db.collection(`tenants/${tenantDoc.id}/staffMembers`).get();

      console.log(`    - Customers: ${customers.size}件`);
      console.log(`    - Appointments: ${appointments.size}件`);
      console.log(`    - Services: ${services.size}件`);
      console.log(`    - Metrics: ${metrics.size}件`);
      console.log(`    - Staff Members: ${staffMembers.size}件`);

      // Show some appointment details if available
      if (appointments.size > 0) {
        console.log(`\n    📅 Appointments (最新5件):`);
        appointments.docs.slice(0, 5).forEach(doc => {
          const data = doc.data();
          console.log(`      - ${doc.id}:`);
          console.log(`        Status: ${data.status}`);
          console.log(`        Start: ${data.startAt?.toDate?.()}`);
        });
      }

      // Show some metrics details if available
      if (metrics.size > 0) {
        console.log(`\n    📊 Metrics (最新5件):`);
        metrics.docs.slice(0, 5).forEach(doc => {
          const data = doc.data();
          console.log(`      - ${data.period}/${data.date}: Revenue ${data.revenue}, Appointments ${data.appointmentCount}`);
        });
      }
    }

    console.log("\n" + "=".repeat(60));

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkData();
