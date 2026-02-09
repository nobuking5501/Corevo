#!/usr/bin/env node

import admin from "firebase-admin";

// エミュレーターに接続
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = admin.initializeApp({
  projectId: "corevo-e1a8b",
});

async function checkTenants() {
  console.log("📋 Emulator内のテナント一覧\n");
  console.log("=".repeat(80));

  try {
    const tenantsSnapshot = await app.firestore().collection("tenants").get();

    if (tenantsSnapshot.empty) {
      console.log("ℹ️  テナントが見つかりません");
    } else {
      console.log(`✅ ${tenantsSnapshot.docs.length}件のテナントが見つかりました\n`);

      for (const doc of tenantsSnapshot.docs) {
        const data = doc.data();
        console.log(`🏢 テナント: ${data.name}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   組織ID: ${data.organizationId || "(なし)"}`);
        console.log("-".repeat(80));
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkTenants();
