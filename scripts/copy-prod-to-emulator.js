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
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

// 本番Firebase初期化
const prodApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
}, "production");

const prodDb = prodApp.firestore();

// エミュレーターFirebase初期化
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const emulatorApp = admin.initializeApp({
  projectId: "corevo-e1a8b",
}, "emulator");

const emulatorDb = emulatorApp.firestore();

async function copyCollection(collectionPath) {
  console.log(`\n📦 Copying collection: ${collectionPath}`);

  const snapshot = await prodDb.collection(collectionPath).get();
  console.log(`   Found ${snapshot.size} documents`);

  const batch = emulatorDb.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const ref = emulatorDb.collection(collectionPath).doc(doc.id);
    batch.set(ref, doc.data());
    count++;

    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`   Written ${count} documents...`);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`   ✅ Copied ${count} documents`);
}

async function copySubcollection(parentPath, subcollectionName) {
  console.log(`\n📦 Copying subcollection: ${parentPath}/*/${subcollectionName}`);

  const parentSnapshot = await prodDb.collection(parentPath).get();
  let totalCount = 0;

  for (const parentDoc of parentSnapshot.docs) {
    const subcollectionPath = `${parentPath}/${parentDoc.id}/${subcollectionName}`;
    const snapshot = await prodDb.collection(subcollectionPath).get();

    if (snapshot.size === 0) continue;

    const batch = emulatorDb.batch();

    for (const doc of snapshot.docs) {
      const ref = emulatorDb.collection(subcollectionPath).doc(doc.id);
      batch.set(ref, doc.data());
      totalCount++;
    }

    await batch.commit();
  }

  console.log(`   ✅ Copied ${totalCount} documents`);
}

async function main() {
  console.log("🚀 Starting data copy from Production Firestore to Emulator\n");
  console.log("=" .repeat(60));

  try {
    // トップレベルコレクション
    await copyCollection("organizations");
    await copyCollection("tenants");
    await copyCollection("users");

    // テナントのサブコレクション
    await copySubcollection("tenants", "customers");
    await copySubcollection("tenants", "services");
    await copySubcollection("tenants", "appointments");
    await copySubcollection("tenants", "staffMembers");
    await copySubcollection("tenants", "shifts");
    await copySubcollection("tenants", "records");
    await copySubcollection("tenants", "metrics");
    await copySubcollection("tenants", "kpiTargets");
    await copySubcollection("tenants", "aiSuggestions");
    await copySubcollection("tenants", "messages");

    console.log("\n" + "=".repeat(60));
    console.log("✅ Data copy completed successfully!");
    console.log("\n🔍 View data in Emulator UI: http://127.0.0.1:4000/firestore");

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
