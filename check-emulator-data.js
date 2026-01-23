const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-project' });

const db = admin.firestore();
const auth = admin.auth();

async function checkData() {
  try {
    console.log('🔍 Checking emulator data...\n');

    // 1. ユーザー確認
    const user = await auth.getUserByEmail('test@example.com');
    console.log('✅ User exists:', user.uid);
    
    const claims = (await auth.getUser(user.uid)).customClaims;
    console.log('📋 Custom Claims:', JSON.stringify(claims, null, 2));

    // 2. テナント確認
    const tenantsSnapshot = await db.collection('tenants').get();
    console.log('\n📁 Tenants in database:', tenantsSnapshot.size);
    tenantsSnapshot.forEach(doc => {
      console.log('  -', doc.id, ':', doc.data().name);
    });

    // 3. 特定のテナント確認
    const tenantId = 'tenant_demo';
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (tenantDoc.exists) {
      console.log('\n✅ Tenant exists:', tenantId);
      console.log('   Data:', JSON.stringify(tenantDoc.data(), null, 2));
    } else {
      console.log('\n❌ Tenant NOT found:', tenantId);
    }

    // 4. ユーザードキュメント確認
    const userDoc = await db.collection(`tenants/${tenantId}/users`).doc(user.uid).get();
    if (userDoc.exists) {
      console.log('\n✅ User document exists in tenant');
      console.log('   Data:', JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('\n❌ User document NOT found in tenant');
    }

    // 5. Settings確認
    const settingsDoc = await db.collection(`tenants/${tenantId}/settings`).doc('main').get();
    if (settingsDoc.exists) {
      console.log('\n✅ Settings exist');
    } else {
      console.log('\n❌ Settings NOT found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();
