/**
 * Firebase接続テストスクリプト
 * Firebaseの設定が正しいか、Firestoreが有効化されているかを確認
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

const db = admin.firestore();

async function testFirebaseConnection() {
  console.log('🔍 Firebase接続テスト開始...\n');

  try {
    // 1. Authentication テスト
    console.log('1️⃣ Authentication テスト');
    try {
      const users = await admin.auth().listUsers(1);
      console.log('   ✅ Authentication: 正常');
      console.log(`   ユーザー数: ${users.users.length > 0 ? '1人以上' : '0人'}\n`);
    } catch (error) {
      console.log('   ❌ Authentication エラー:', error.message, '\n');
    }

    // 2. Firestore テスト
    console.log('2️⃣ Firestore テスト');
    try {
      // テスト用のドキュメントを作成
      const testDocRef = db.collection('_test').doc('connection_test');
      await testDocRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: 'Connection test'
      });
      console.log('   ✅ Firestore書き込み: 成功');

      // 読み取りテスト
      const doc = await testDocRef.get();
      if (doc.exists) {
        console.log('   ✅ Firestore読み取り: 成功');
        console.log('   データ:', doc.data());
      }

      // テストドキュメントを削除
      await testDocRef.delete();
      console.log('   ✅ Firestoreクリーンアップ: 成功\n');

    } catch (error) {
      console.log('   ❌ Firestoreエラー:', error.message);
      if (error.code === 9) {
        console.log('   💡 原因: Firestoreが有効化されていません');
        console.log('   📝 対処: Firebase Consoleで Firestore Database を作成してください');
        console.log('   🔗 https://console.firebase.google.com/project/corevo-e1a8b/firestore\n');
      }
      console.log();
    }

    // 3. Storage テスト
    console.log('3️⃣ Storage テスト');
    try {
      const bucket = admin.storage().bucket();
      const [exists] = await bucket.exists();
      if (exists) {
        console.log('   ✅ Storage: 正常');
      } else {
        console.log('   ⚠️  Storage Bucket が見つかりません');
      }
    } catch (error) {
      console.log('   ❌ Storage エラー:', error.message);
      if (error.code === 404 || error.message.includes('bucket')) {
        console.log('   💡 原因: Firebase Storageが有効化されていません');
        console.log('   📝 対処: Firebase Consoleで Storage を有効化してください');
        console.log('   🔗 https://console.firebase.google.com/project/corevo-e1a8b/storage\n');
      }
    }

    console.log('========================================');
    console.log('テスト完了');
    console.log('========================================\n');

  } catch (error) {
    console.error('予期しないエラー:', error);
  } finally {
    process.exit(0);
  }
}

testFirebaseConnection();
