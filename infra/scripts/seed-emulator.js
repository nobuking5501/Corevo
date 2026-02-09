#!/usr/bin/env node

/**
 * Seed script for Firebase Emulator
 * Creates test user and tenant data in the emulator
 * Usage: node infra/scripts/seed-emulator.js
 */

import admin from "firebase-admin";

// Connect to Emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

// Initialize Firebase Admin for Emulator
admin.initializeApp({
  projectId: "corevo-e1a8b", // プロジェクトIDは.env.localから取得
});

const db = admin.firestore();
const auth = admin.auth();

async function seedEmulator() {
  console.log("🌱 Starting Emulator seed process...");

  try {
    // Create Platform Admin user
    const adminEmail = "nobuking5501@gmail.com";
    const adminPassword = "kitamura55";
    let adminUser;

    try {
      adminUser = await auth.getUserByEmail(adminEmail);
      console.log("✓ Platform Admin user already exists:", adminUser.uid);
    } catch {
      adminUser = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: "北村管理者",
      });
      console.log("✓ Created Platform Admin user:", adminUser.uid);
    }

    // Create Platform Admin user document with isPlatformAdmin flag
    await db.collection("users").doc(adminUser.uid).set({
      email: adminEmail,
      displayName: "北村管理者",
      isPlatformAdmin: true, // Platform Admin権限
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✓ Created Platform Admin user document with isPlatformAdmin: true");

    // Create test user (北村グループ用)
    const email = "test@example.com";
    const password = "test1234";
    let user;

    try {
      user = await auth.getUserByEmail(email);
      console.log("✓ Test user already exists:", user.uid);
    } catch {
      user = await auth.createUser({
        email,
        password,
        displayName: "テストユーザー",
      });
      console.log("✓ Created test user:", user.uid);
    }

    // Create multiple organizations for Platform Admin
    const organizations = [
      {
        id: "mJpTLpaDMX5iXno477KX",
        name: "北村グループ",
        plan: "pro",
        status: "active",
        maxTenants: 10,
        contactEmail: "contact@kitamura-group.test",
        ownerId: user.uid,
      },
      {
        id: "org_abc123xyz",
        name: "東京美容サロン株式会社",
        plan: "enterprise",
        status: "active",
        maxTenants: null, // unlimited
        contactEmail: "info@tokyo-beauty.test",
        ownerId: user.uid,
      },
      {
        id: "org_def456uvw",
        name: "大阪エステグループ",
        plan: "basic",
        status: "active",
        maxTenants: 3,
        contactEmail: "osaka@este-group.test",
        ownerId: user.uid,
      },
      {
        id: "org_ghi789rst",
        name: "福岡ビューティー",
        plan: "trial",
        status: "trial",
        maxTenants: 1,
        contactEmail: "fukuoka@beauty.test",
        ownerId: user.uid,
      },
    ];

    const createdOrganizations = [];
    for (const org of organizations) {
      const orgRef = db.collection("organizations").doc(org.id);
      await orgRef.set({
        name: org.name,
        plan: org.plan,
        status: org.status,
        maxTenants: org.maxTenants,
        contactEmail: org.contactEmail,
        ownerId: org.ownerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      createdOrganizations.push({ id: org.id, name: org.name });
      console.log(`✓ Created organization: ${org.name}`);
    }

    // Create tenants for each organization
    const tenants = [
      // 北村グループの店舗
      {
        id: "GF7SqEGHlfe5pyPGeymg",
        organizationId: "mJpTLpaDMX5iXno477KX",
        name: "北村サロン本店",
        slug: "kitamura-salon-honten",
      },
      {
        id: "tenant_kitamura_shibuya",
        organizationId: "mJpTLpaDMX5iXno477KX",
        name: "北村サロン渋谷店",
        slug: "kitamura-salon-shibuya",
      },
      // 東京美容サロンの店舗
      {
        id: "tenant_tokyo_shinjuku",
        organizationId: "org_abc123xyz",
        name: "東京美容サロン新宿店",
        slug: "tokyo-beauty-shinjuku",
      },
      {
        id: "tenant_tokyo_ginza",
        organizationId: "org_abc123xyz",
        name: "東京美容サロン銀座店",
        slug: "tokyo-beauty-ginza",
      },
      {
        id: "tenant_tokyo_ikebukuro",
        organizationId: "org_abc123xyz",
        name: "東京美容サロン池袋店",
        slug: "tokyo-beauty-ikebukuro",
      },
      // 大阪エステグループの店舗
      {
        id: "tenant_osaka_umeda",
        organizationId: "org_def456uvw",
        name: "大阪エステ梅田店",
        slug: "osaka-este-umeda",
      },
      {
        id: "tenant_osaka_namba",
        organizationId: "org_def456uvw",
        name: "大阪エステなんば店",
        slug: "osaka-este-namba",
      },
      // 福岡ビューティーの店舗
      {
        id: "tenant_fukuoka_tenjin",
        organizationId: "org_ghi789rst",
        name: "福岡ビューティー天神店",
        slug: "fukuoka-beauty-tenjin",
      },
    ];

    const createdTenants = [];
    for (const tenant of tenants) {
      const tenantRef = db.collection("tenants").doc(tenant.id);
      await tenantRef.set({
        organizationId: tenant.organizationId,
        name: tenant.name,
        slug: tenant.slug,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      createdTenants.push({ id: tenant.id, name: tenant.name, organizationId: tenant.organizationId });
      console.log(`✓ Created tenant: ${tenant.name}`);
    }

    // Use first tenant for test user
    const organizationId = "mJpTLpaDMX5iXno477KX";
    const tenantId = "GF7SqEGHlfe5pyPGeymg";

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, {
      organizationId,
      tenantIds: [tenantId],
      roles: { [tenantId]: "owner" },
    });
    console.log("✓ Set custom claims for user");

    // Create user doc
    await db.collection("users").doc(user.uid).set({
      organizationId,
      tenantIds: [tenantId],
      email,
      displayName: "テストユーザー",
      roles: { [tenantId]: "owner" },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✓ Created user document");

    // Create settings
    await db.collection(`tenants/${tenantId}/settings`).doc("main").set({
      tenantId,
      businessHours: {
        monday: { open: "09:00", close: "20:00" },
        tuesday: { open: "09:00", close: "20:00" },
        wednesday: { open: "09:00", close: "20:00" },
        thursday: { open: "09:00", close: "20:00" },
        friday: { open: "09:00", close: "20:00" },
        saturday: { open: "09:00", close: "18:00" },
        sunday: { open: "10:00", close: "18:00" },
      },
      salonIndustryType: "beauty_salon",
      featureFlags: {
        aiAutoSuggest: true,
        lineIntegration: true,
        advancedAnalytics: true,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✓ Created settings");

    // Create staff members
    const staff = [
      { name: "田中 美咲", email: "tanaka@kitamura-salon.test", role: "manager" },
      { name: "佐藤 花子", email: "sato@kitamura-salon.test", role: "staff" },
      { name: "鈴木 太郎", email: "suzuki@kitamura-salon.test", role: "staff" },
    ];

    const staffIds = [];
    for (const member of staff) {
      const staffRef = await db.collection(`tenants/${tenantId}/staff_members`).add({
        tenantId,
        name: member.name,
        email: member.email,
        role: member.role,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      staffIds.push(staffRef.id);
      console.log(`✓ Created staff: ${member.name}`);
    }

    // Create services
    const services = [
      { name: "全身脱毛", price: 25000, durationMinutes: 90, category: "全身", marginCoefficient: 0.75, promotionPriority: 10, setDiscountEligible: true },
      { name: "VIO脱毛", price: 12000, durationMinutes: 45, category: "VIO", marginCoefficient: 0.8, promotionPriority: 9, setDiscountEligible: true },
      { name: "顔脱毛", price: 8000, durationMinutes: 30, category: "顔", marginCoefficient: 0.75, promotionPriority: 8, setDiscountEligible: true },
      { name: "腕脱毛", price: 10000, durationMinutes: 40, category: "腕", marginCoefficient: 0.7, promotionPriority: 7, setDiscountEligible: true },
      { name: "脚脱毛", price: 15000, durationMinutes: 60, category: "脚", marginCoefficient: 0.7, promotionPriority: 7, setDiscountEligible: true },
    ];

    const serviceIds = [];
    for (const service of services) {
      const serviceRef = await db.collection(`tenants/${tenantId}/services`).add({
        tenantId,
        ...service,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      serviceIds.push(serviceRef.id);
      console.log(`✓ Created service: ${service.name}`);
    }

    // Create customers and appointments for each tenant
    const customerNames = [
      { name: "山田 花子", kana: "ヤマダ ハナコ", email: "hanako.yamada@example.com", phone: "090-1234-5678", gender: "female" },
      { name: "佐藤 美咲", kana: "サトウ ミサキ", email: "misaki.sato@example.com", phone: "090-2345-6789", gender: "female" },
      { name: "鈴木 あゆみ", kana: "スズキ アユミ", email: "ayumi.suzuki@example.com", phone: "090-3456-7890", gender: "female" },
      { name: "高橋 真由美", kana: "タカハシ マユミ", email: "mayumi.takahashi@example.com", phone: "090-4567-8901", gender: "female" },
      { name: "渡辺 由美子", kana: "ワタナベ ユミコ", email: "yumiko.watanabe@example.com", phone: "090-5678-9012", gender: "female" },
      { name: "伊藤 さくら", kana: "イトウ サクラ", email: "sakura.ito@example.com", phone: "090-6789-0123", gender: "female" },
      { name: "中村 愛", kana: "ナカムラ アイ", email: "ai.nakamura@example.com", phone: "090-7890-1234", gender: "female" },
      { name: "小林 麻衣", kana: "コバヤシ マイ", email: "mai.kobayashi@example.com", phone: "090-8901-2345", gender: "female" },
    ];

    let totalCustomers = 0;
    let totalAppointments = 0;

    // Create customers and appointments for the first tenant (detailed data for test user)
    const customerIds = [];
    for (const customer of customerNames.slice(0, 5)) {
      const customerRef = await db.collection(`tenants/${tenantId}/customers`).add({
        tenantId,
        ...customer,
        consent: { marketing: true, photoUsage: true },
        tags: [],
        lastVisit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        visitInterval: 30 + Math.floor(Math.random() * 30),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      customerIds.push(customerRef.id);
      totalCustomers++;
    }
    console.log(`✓ Created ${customerIds.length} customers for ${tenantId}`);

    // Create appointments for first tenant
    for (let i = 0; i < 14; i++) {
      const numAppointments = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numAppointments; j++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        date.setHours(10 + j * 3, 0, 0, 0);

        const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
        const serviceIndex = Math.floor(Math.random() * serviceIds.length);
        const serviceId = serviceIds[serviceIndex];
        const service = services[serviceIndex];
        const staffId = staffIds[Math.floor(Math.random() * staffIds.length)];

        // Calculate pricing
        const subtotal = service.price;
        const discount = 0; // Single service, no discount
        const total = subtotal - discount;

        await db.collection(`tenants/${tenantId}/appointments`).add({
          tenantId,
          customerId,
          staffId,
          serviceIds: [serviceId],
          startAt: date,
          endAt: new Date(date.getTime() + 60 * 60 * 1000),
          status: i === 0 ? "scheduled" : "completed",
          notes: "",
          pricing: {
            subtotal,
            discount,
            total,
            eligibleCount: service.setDiscountEligible ? 1 : 0,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        totalAppointments++;
      }
    }
    console.log(`✓ Created ${totalAppointments} appointments for ${tenantId}`);

    // Create sample data for other tenants (lighter data for Platform Admin stats)
    for (const tenant of createdTenants.slice(1)) {
      const numCustomers = Math.floor(Math.random() * 5) + 3; // 3-7 customers per tenant
      const tenantCustomerIds = [];

      for (let i = 0; i < numCustomers; i++) {
        const customer = customerNames[i % customerNames.length];
        const customerRef = await db.collection(`tenants/${tenant.id}/customers`).add({
          tenantId: tenant.id,
          name: customer.name,
          kana: customer.kana,
          email: `${tenant.id}_${i}@example.com`,
          phone: customer.phone,
          gender: customer.gender,
          consent: { marketing: true, photoUsage: true },
          tags: [],
          lastVisit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          visitInterval: 30 + Math.floor(Math.random() * 30),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tenantCustomerIds.push(customerRef.id);
        totalCustomers++;
      }

      // Create appointments for this tenant
      const numAppointments = Math.floor(Math.random() * 10) + 5; // 5-14 appointments
      for (let i = 0; i < numAppointments; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        date.setHours(10 + (i % 8), 0, 0, 0);

        const customerId = tenantCustomerIds[Math.floor(Math.random() * tenantCustomerIds.length)];

        // Use random price for sample appointments
        const samplePrice = [8000, 10000, 12000, 15000, 25000][Math.floor(Math.random() * 5)];
        const subtotal = samplePrice;
        const discount = 0;
        const total = subtotal;

        await db.collection(`tenants/${tenant.id}/appointments`).add({
          tenantId: tenant.id,
          customerId,
          staffId: "sample_staff",
          serviceIds: ["sample_service"],
          startAt: date,
          endAt: new Date(date.getTime() + 60 * 60 * 1000),
          status: daysAgo === 0 ? "scheduled" : "completed",
          notes: "",
          pricing: {
            subtotal,
            discount,
            total,
            eligibleCount: 1,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        totalAppointments++;
      }

      console.log(`✓ Created ${numCustomers} customers and ${numAppointments} appointments for ${tenant.name}`);
    }

    console.log(`\n📊 Total Platform Stats:`);
    console.log(`   Organizations: ${createdOrganizations.length}`);
    console.log(`   Tenants: ${createdTenants.length}`);
    console.log(`   Customers: ${totalCustomers}`);
    console.log(`   Appointments: ${totalAppointments}`);

    console.log("\n✅ Emulator seed completed successfully!");
    console.log("\n👤 Platform Admin Login:");
    console.log("   Email:    ", adminEmail);
    console.log("   Password: ", adminPassword);
    console.log("   Role:     Platform Admin (総合管理画面アクセス可能)");
    console.log("\n📋 Test User Login:");
    console.log("   Email:    ", email);
    console.log("   Password: ", password);
    console.log("\n🏢 Organization:");
    console.log("   Name:     北村グループ");
    console.log("   ID:       ", organizationId);
    console.log("\n🏪 Tenant:");
    console.log("   Name:     北村サロン");
    console.log("   ID:       ", tenantId);
    console.log("\n🌐 Access the app at: http://localhost:3006");

  } catch (error) {
    console.error("❌ Error during seed:", error);
    process.exit(1);
  }
}

seedEmulator()
  .then(() => {
    console.log("\n✨ You can now log in to the app!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
