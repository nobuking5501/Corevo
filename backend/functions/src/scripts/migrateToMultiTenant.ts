import * as admin from "firebase-admin";

/**
 * 既存のテナントデータを新しいマルチテナント構造に移行するスクリプト
 *
 * 実行方法:
 * npx ts-node src/scripts/migrateToMultiTenant.ts
 */

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

interface OldTenantData {
  name: string;
  createdAt: any;
  ownerId?: string;
  plan?: string;
  status?: string;
  slug?: string;
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = baseName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .collection("tenants")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (existing.empty) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function migrateToMultiTenant() {
  console.log("🚀 Starting migration to multi-tenant structure...\n");

  try {
    // 1. Get all existing tenants
    const tenantsSnapshot = await db.collection("tenants").get();
    console.log(`📋 Found ${tenantsSnapshot.size} tenants to migrate\n`);

    if (tenantsSnapshot.empty) {
      console.log("⚠️  No tenants found. Nothing to migrate.");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data() as OldTenantData;

      try {
        console.log(`\n📦 Processing tenant: ${tenantData.name} (${tenantId})`);

        // Skip if already migrated (has organizationId)
        if ((tenantData as any).organizationId) {
          console.log(`   ✅ Already migrated, skipping...`);
          successCount++;
          continue;
        }

        // 2. Get owner from tenant's users collection
        const usersSnapshot = await db
          .collection(`tenants/${tenantId}/users`)
          .where("role", "==", "owner")
          .limit(1)
          .get();

        let ownerId = tenantData.ownerId;
        let ownerEmail = "owner@example.com";
        let ownerName = "オーナー";

        if (!usersSnapshot.empty) {
          const ownerDoc = usersSnapshot.docs[0];
          ownerId = ownerDoc.id;
          const ownerData = ownerDoc.data();
          ownerEmail = ownerData.email || ownerEmail;
          ownerName = ownerData.displayName || ownerData.name || ownerName;
        }

        if (!ownerId) {
          console.log(`   ⚠️  No owner found, skipping...`);
          errorCount++;
          continue;
        }

        console.log(`   👤 Owner: ${ownerName} (${ownerId})`);

        // 3. Create organization
        const organizationId = `org_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const organizationName = `${tenantData.name} - 組織`;

        await db.collection("organizations").doc(organizationId).set({
          name: organizationName,
          ownerId,
          plan: tenantData.plan || "trial",
          status: tenantData.status || "active",
          createdAt: tenantData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   🏢 Created organization: ${organizationName}`);

        // 4. Generate slug if not exists
        const slug = tenantData.slug || (await generateUniqueSlug(tenantData.name));

        // 5. Update global tenant reference with organizationId
        await db.collection("tenants").doc(tenantId).update({
          organizationId,
          slug,
          name: tenantData.name,
          status: tenantData.status || "active",
        });

        // 6. Create tenant reference under organization
        await db
          .collection(`organizations/${organizationId}/tenants`)
          .doc(tenantId)
          .set({
            organizationId,
            name: tenantData.name,
            slug,
            status: tenantData.status || "active",
            createdAt: tenantData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log(`   🏪 Created tenant reference in organization`);

        // 7. Update all users in tenant with organizationId
        const allUsersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
        const roles: Record<string, string> = {};

        for (const userDoc of allUsersSnapshot.docs) {
          const userId = userDoc.id;
          const userData = userDoc.data();

          await db
            .collection(`tenants/${tenantId}/users`)
            .doc(userId)
            .update({
              organizationId,
              tenantId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          roles[tenantId] = userData.role || "staff";

          // Update custom claims
          try {
            await auth.setCustomUserClaims(userId, {
              organizationId,
              tenantIds: [tenantId],
              roles,
            });

            console.log(`   👥 Updated user: ${userData.email || userId} (${userData.role})`);
          } catch (error) {
            console.log(`   ⚠️  Could not update claims for user ${userId}:`, error);
          }
        }

        console.log(`   ✅ Migration completed for ${tenantData.name}`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error migrating tenant ${tenantId}:`, error);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`\n✨ Migration complete!`);
    console.log(`   ✅ Success: ${successCount} tenants`);
    console.log(`   ❌ Errors: ${errorCount} tenants`);
    console.log("\n" + "=".repeat(50));
  } catch (error) {
    console.error("\n❌ Fatal error during migration:", error);
    throw error;
  }
}

// Run migration
migrateToMultiTenant()
  .then(() => {
    console.log("\n🎉 Migration script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration script failed:", error);
    process.exit(1);
  });
