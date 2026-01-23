/**
 * テストユーザー作成スクリプト
 *
 * 開発用のテストユーザーをFirebase Authenticationに作成します
 *
 * 実行方法:
 * node create-test-user.js
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Service Accountを読み込む
const serviceAccount = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));

// Firebase Admin初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// テストユーザー情報
const TEST_USER = {
  email: 'test@corevo.dev',
  password: 'test1234',
  displayName: 'テストユーザー',
};

async function createTestUser() {
  try {
    console.log('テストユーザーを作成しています...\n');

    // ユーザーが既に存在するか確認
    let user;
    try {
      user = await admin.auth().getUserByEmail(TEST_USER.email);
      console.log('✓ ユーザーは既に存在します');
      console.log(`  UID: ${user.uid}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Created: ${user.metadata.creationTime}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // ユーザーが存在しない場合は作成
        user = await admin.auth().createUser({
          email: TEST_USER.email,
          password: TEST_USER.password,
          displayName: TEST_USER.displayName,
          emailVerified: true, // 開発用なので検証済みにする
        });

        console.log('✓ テストユーザーを作成しました');
        console.log(`  UID: ${user.uid}`);
        console.log(`  Email: ${user.email}`);
      } else {
        throw error;
      }
    }

    console.log('\n========================================');
    console.log('ログイン情報');
    console.log('========================================');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log('========================================\n');

    console.log('📝 注意:');
    console.log('このユーザーはテナントに紐付けられていません。');
    console.log('初回ログイン後、/onboarding ページでテナントを作成してください。');
    console.log('または、infra/scripts/seed-tenant.js を実行してテナント付きで作成してください。\n');

    process.exit(0);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

createTestUser();
