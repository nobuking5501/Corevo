const admin = require('firebase-admin');

// Emulator に接続
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-project' });

async function createTestUser() {
  try {
    const userRecord = await admin.auth().createUser({
      email: 'test@example.com',
      password: 'test1234',
      displayName: 'Test User',
    });
    
    console.log('✅ Test user created:', userRecord.uid);
    console.log('Email: test@example.com');
    console.log('Password: test1234');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();
