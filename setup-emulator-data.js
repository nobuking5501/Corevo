const admin = require('firebase-admin');

// Emulator に接続
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-project' });

const db = admin.firestore();
const auth = admin.auth();

async function setupTestData() {
  try {
    console.log('🚀 Setting up test data...\n');

    // 1. テストユーザーを作成
    let user;
    try {
      user = await auth.getUserByEmail('test@example.com');
      console.log('✅ User already exists:', user.uid);
    } catch (error) {
      user = await auth.createUser({
        email: 'test@example.com',
        password: 'test1234',
        displayName: 'Test User',
      });
      console.log('✅ User created:', user.uid);
    }

    // 2. テナントを作成
    const tenantId = 'tenant_demo';
    const tenantRef = db.collection('tenants').doc(tenantId);
    
    await tenantRef.set({
      id: tenantId,
      name: 'デモサロン',
      plan: 'basic',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Tenant created:', tenantId);

    // 3. ユーザーをテナントに追加
    const userRef = db.collection(`tenants/${tenantId}/users`).doc(user.uid);
    await userRef.set({
      id: user.uid,
      tenantId: tenantId,
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'owner',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ User added to tenant');

    // 4. Custom Claims を設定
    await auth.setCustomUserClaims(user.uid, {
      tenantIds: [tenantId],
      roles: {
        [tenantId]: 'owner'
      }
    });
    console.log('✅ Custom claims set');

    // 5. Settings を作成
    await db.collection(`tenants/${tenantId}/settings`).doc('main').set({
      id: 'main',
      tenantId: tenantId,
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
        plan: 'basic',
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Settings created');

    // 6. サンプルサービスを作成
    const servicesRef = db.collection(`tenants/${tenantId}/services`);
    await servicesRef.add({
      tenantId: tenantId,
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
    console.log('✅ Sample service created');

    console.log('\n🎉 Setup complete!\n');
    console.log('Login credentials:');
    console.log('  Email: test@example.com');
    console.log('  Password: test1234');
    console.log('\nAccess: http://localhost:3006\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupTestData();
