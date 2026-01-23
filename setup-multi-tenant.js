const admin = require('firebase-admin');

// Emulator に接続
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-project' });

const db = admin.firestore();
const auth = admin.auth();

async function setupMultiTenantData() {
  try {
    console.log('🚀 Setting up multi-tenant data...\n');

    // 1. 既存ユーザーを取得または作成
    let user;
    try {
      user = await auth.getUserByEmail('test@example.com');
      console.log('✅ User exists:', user.uid);
    } catch (error) {
      user = await auth.createUser({
        email: 'test@example.com',
        password: 'test1234',
        displayName: 'Test User',
      });
      console.log('✅ User created:', user.uid);
    }

    // 2. 組織（クライアント企業）を作成
    const organizationId = 'org_beauty_group';
    const orgRef = db.collection('organizations').doc(organizationId);
    
    await orgRef.set({
      id: organizationId,
      name: '美容グループABC',
      plan: 'pro',
      status: 'active',
      ownerId: user.uid,
      settings: {
        branding: {
          logo: '',
          primaryColor: '#3B82F6'
        }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Organization created:', organizationId);

    // 3. 複数のテナント（店舗）を作成
    const tenants = [
      {
        id: 'tenant_tokyo',
        name: '東京店',
        slug: 'tokyo',
        storeCode: 'TKY001',
        address: '東京都渋谷区1-1-1',
        phone: '03-1234-5678',
      },
      {
        id: 'tenant_osaka',
        name: '大阪店',
        slug: 'osaka',
        storeCode: 'OSK001',
        address: '大阪府大阪市北区2-2-2',
        phone: '06-9876-5432',
      },
      {
        id: 'tenant_nagoya',
        name: '名古屋店',
        slug: 'nagoya',
        storeCode: 'NGY001',
        address: '愛知県名古屋市中区3-3-3',
        phone: '052-3456-7890',
      }
    ];

    const tenantIds = [];
    const roles = {};

    for (const tenant of tenants) {
      // テナント作成
      const tenantRef = db.collection('tenants').doc(tenant.id);
      await tenantRef.set({
        id: tenant.id,
        organizationId: organizationId,
        name: tenant.name,
        slug: tenant.slug,
        storeCode: tenant.storeCode,
        address: tenant.address,
        phone: tenant.phone,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

      tenantIds.push(tenant.id);
      roles[tenant.id] = 'owner';

      // ユーザーをテナントに追加
      const userRef = db.collection(`tenants/${tenant.id}/users`).doc(user.uid);
      await userRef.set({
        id: user.uid,
        tenantId: tenant.id,
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'owner',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Settings を作成
      await db.collection(`tenants/${tenant.id}/settings`).doc('main').set({
        id: 'main',
        tenantId: tenant.id,
        businessHours: {
          monday: { open: '10:00', close: '20:00' },
          tuesday: { open: '10:00', close: '20:00' },
          wednesday: { open: '10:00', close: '20:00' },
          thursday: { open: '10:00', close: '20:00' },
          friday: { open: '10:00', close: '20:00' },
          saturday: { open: '10:00', close: '18:00' },
          sunday: null
        },
        featureFlags: {
          aiAutoSuggest: true,
          lineIntegration: false,
          advancedAnalytics: true
        },
        billingStatus: {
          plan: 'pro',
          periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // サンプルサービスを作成
      const servicesRef = db.collection(`tenants/${tenant.id}/services`);
      await servicesRef.add({
        tenantId: tenant.id,
        name: '全身脱毛',
        price: 150000,
        durationMinutes: 90,
        marginCoefficient: 0.7,
        promotionPriority: 5,
        tags: ['人気', '全身'],
        active: true,
        category: '全身',
        setDiscountEligible: true,
        sortOrder: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`  └─ User, Settings, Service added to ${tenant.name}`);
    }

    // 4. Custom Claims を設定
    await auth.setCustomUserClaims(user.uid, {
      organizationId: organizationId,
      tenantIds: tenantIds,
      roles: roles
    });
    console.log('\n✅ Custom claims set');
    console.log('   organizationId:', organizationId);
    console.log('   tenantIds:', tenantIds);
    console.log('   roles:', roles);

    console.log('\n🎉 Multi-tenant setup complete!\n');
    console.log('Login credentials:');
    console.log('  Email: test@example.com');
    console.log('  Password: test1234');
    console.log('\nTenants:');
    tenants.forEach(t => console.log(`  - ${t.name} (${t.id})`));
    console.log('\nAccess: http://localhost:3006\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupMultiTenantData();
