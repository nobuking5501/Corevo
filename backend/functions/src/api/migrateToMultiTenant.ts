import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * 既存のテナントデータを新しいマルチテナント構造に移行する関数
 *
 * ⚠️ 開発環境専用 - 本番環境では実行しないでください！
 *
 * 呼び出し方法:
 * const migrate = httpsCallable(functions, "migrateToMultiTenant");
 * const result = await migrate({ dryRun: false });
 */
export const migrateToMultiTenant = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    // ⚠️ WARNING: This is a data migration function - use with caution!

    const dryRun = request.data?.dryRun !== false; // デフォルトはtrue
    const db = admin.firestore();
    const auth = admin.auth();

    const logs: string[] = [];
    const log = (message: string) => {
      console.log(message);
      logs.push(message);
    };

    try {
      log("🚀 Starting migration to multi-tenant structure...");
      if (dryRun) {
        log("⚠️  DRY RUN MODE - No changes will be made");
      }

      // 1. Get all existing tenants
      const tenantsSnapshot = await db.collection("tenants").get();
      log(`📋 Found ${tenantsSnapshot.size} tenants to migrate`);

      if (tenantsSnapshot.empty) {
        log("⚠️  No tenants found. Nothing to migrate.");
        return { success: true, logs, migrated: 0 };
      }

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data();

        try {
          log(`\n📦 Processing tenant: ${tenantData.name} (${tenantId})`);

          // Skip if already migrated (has organizationId)
          if (tenantData.organizationId) {
            log(`   ✅ Already migrated, skipping...`);
            skippedCount++;
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
            log(`   ⚠️  No owner found, skipping...`);
            errorCount++;
            continue;
          }

          log(`   👤 Owner: ${ownerName} (${ownerId})`);

          if (dryRun) {
            log(`   🔍 Would create organization and update data (DRY RUN)`);
            successCount++;
            continue;
          }

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

          log(`   🏢 Created organization: ${organizationName}`);

          // 4. Generate slug if not exists
          const slug = tenantData.slug || await generateUniqueSlug(tenantData.name, db);

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

          log(`   🏪 Created tenant reference in organization`);

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

              log(`   👥 Updated user: ${userData.email || userId} (${userData.role})`);
            } catch (error: any) {
              log(`   ⚠️  Could not update claims for user ${userId}: ${error.message}`);
            }
          }

          log(`   ✅ Migration completed for ${tenantData.name}`);
          successCount++;
        } catch (error: any) {
          log(`   ❌ Error migrating tenant ${tenantId}: ${error.message}`);
          errorCount++;
        }
      }

      log("\n" + "=".repeat(50));
      log(`\n✨ Migration ${dryRun ? 'analysis' : 'complete'}!`);
      log(`   ✅ Success: ${successCount} tenants`);
      log(`   ⏭️  Skipped: ${skippedCount} tenants (already migrated)`);
      log(`   ❌ Errors: ${errorCount} tenants`);
      log("\n" + "=".repeat(50));

      return {
        success: true,
        logs,
        migrated: successCount,
        skipped: skippedCount,
        errors: errorCount,
        dryRun,
      };
    } catch (error: any) {
      log(`\n❌ Fatal error during migration: ${error.message}`);
      throw new HttpsError("internal", `Migration failed: ${error.message}`);
    }
  }
);

async function generateUniqueSlug(
  baseName: string,
  db: admin.firestore.Firestore
): Promise<string> {
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
