#!/usr/bin/env node

/**
 * Seed script for creating demo tenant with sample data
 * Usage: npm run seed
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || "./service-account-key.json";

try {
  const serviceAccountData = JSON.parse(readFileSync(serviceAccount, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountData),
  });
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  console.log("Please provide service account JSON file or set FIREBASE_SERVICE_ACCOUNT env var");
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

async function seedTenant() {
  console.log("Starting seed process...");

  try {
    // Create demo user
    const email = "owner@demo.corevo.test";
    const password = "demo1234";
    let user;

    try {
      user = await auth.getUserByEmail(email);
      console.log("Demo user already exists:", user.uid);
    } catch {
      user = await auth.createUser({
        email,
        password,
        displayName: "デモ オーナー",
      });
      console.log("Created demo user:", user.uid);
    }

    // Create tenant
    const tenantRef = await db.collection("tenants").add({
      name: "デモサロン",
      plan: "trial",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tenantId = tenantRef.id;
    console.log("Created tenant:", tenantId);

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, { tenantIds: [tenantId] });
    console.log("Set custom claims for user");

    // Create owner user doc
    await db.collection(`tenants/${tenantId}/users`).doc(user.uid).set({
      tenantId,
      email,
      displayName: "デモ オーナー",
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
        aiAutoSuggest: true,
        lineIntegration: false,
        advancedAnalytics: true,
      },
      billingStatus: {
        plan: "trial",
        periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create staff
    const staffRef = await db.collection(`tenants/${tenantId}/users`).add({
      tenantId,
      email: "staff@demo.corevo.test",
      displayName: "スタッフ 太郎",
      role: "staff",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const staffId = staffRef.id;

    // Create services
    const services = [
      { name: "カット", price: 5000, durationMinutes: 60, marginCoefficient: 0.7, promotionPriority: 8 },
      { name: "カラー", price: 8000, durationMinutes: 90, marginCoefficient: 0.6, promotionPriority: 9 },
      { name: "パーマ", price: 10000, durationMinutes: 120, marginCoefficient: 0.65, promotionPriority: 7 },
      { name: "トリートメント", price: 3000, durationMinutes: 30, marginCoefficient: 0.8, promotionPriority: 6 },
    ];

    const serviceIds = [];
    for (const service of services) {
      const serviceRef = await db.collection(`tenants/${tenantId}/services`).add({
        tenantId,
        ...service,
        tags: [],
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      serviceIds.push(serviceRef.id);
      console.log(`Created service: ${service.name}`);
    }

    // Create customers
    const customers = [
      { name: "山田 花子", kana: "ヤマダ ハナコ", email: "hanako@example.com", visitInterval: 30 },
      { name: "佐藤 美咲", kana: "サトウ ミサキ", email: "misaki@example.com", visitInterval: 45 },
      { name: "鈴木 あゆみ", kana: "スズキ アユミ", email: "ayumi@example.com", visitInterval: 60 },
    ];

    const customerIds = [];
    for (const customer of customers) {
      const customerRef = await db.collection(`tenants/${tenantId}/customers`).add({
        tenantId,
        ...customer,
        phone: "090-0000-0000",
        consent: { marketing: true, photoUsage: true },
        preferences: [],
        tags: [],
        lastVisit: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      customerIds.push(customerRef.id);
      console.log(`Created customer: ${customer.name}`);
    }

    // Create sample appointments (last 7 days)
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      date.setHours(10, 0, 0, 0);

      const customerId = customerIds[i % customerIds.length];
      const serviceId = serviceIds[i % serviceIds.length];

      await db.collection(`tenants/${tenantId}/appointments`).add({
        tenantId,
        customerId,
        staffId,
        serviceId,
        startAt: date,
        endAt: new Date(date.getTime() + 60 * 60 * 1000),
        status: "completed",
        notes: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    console.log("Created sample appointments");

    // Create sample metrics
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      await db.collection(`tenants/${tenantId}/metrics`).add({
        tenantId,
        period: "daily",
        date: dateStr,
        revenue: 15000 + Math.random() * 10000,
        appointmentCount: 3 + Math.floor(Math.random() * 5),
        customerCount: 3,
        noshowRate: 0.05,
        byStaff: { [staffId]: { revenue: 15000, count: 3 } },
        byService: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    console.log("Created sample metrics");

    // Create sample forecast
    await db.collection(`tenants/${tenantId}/forecasts`).add({
      tenantId,
      targetMonth: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
      predictedRevenue: 500000,
      confidenceLower: 400000,
      confidenceUpper: 600000,
      methodology: "Moving average with trend analysis",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create sample insights
    await db.collection(`tenants/${tenantId}/insights`).add({
      tenantId,
      type: "opportunity",
      title: "売上が好調です",
      description: "直近7日間の売上が先週比で15%増加しています。",
      actionable: "この調子でプロモーションを継続しましょう。",
      priority: 8,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create sample AI suggestions
    await db.collection(`tenants/${tenantId}/ai_suggestions`).add({
      tenantId,
      customerId: customerIds[0],
      messageBody: "山田 花子様、こんにちは！前回のご来店から40日が経ちました。次回のご予約はいかがでしょうか？",
      reason: "来店間隔: 40日（目安: 30日）",
      scheduledAt: new Date(),
      approved: false,
      priority: 7,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n=== Seed completed successfully! ===");
    console.log("\nTest Login Credentials:");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("Tenant ID:", tenantId);
    console.log("\nYou can now start the web app and log in with these credentials.");
  } catch (error) {
    console.error("Error during seed:", error);
    process.exit(1);
  }
}

seedTenant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
