/**
 * Firebase Web App Configuration取得スクリプト
 *
 * 実行方法:
 * node get-firebase-config.js
 */

const https = require('https');
const fs = require('fs');

// Service Accountファイルを読み込む
const serviceAccount = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));
const projectId = serviceAccount.project_id;

console.log(`Firebase Project ID: ${projectId}`);
console.log('\n========================================');
console.log('Firebase Web App Configuration');
console.log('========================================\n');

// 既知の情報から推測できる設定値を出力
console.log('以下の値を apps/web/.env.local にコピーしてください:\n');

console.log(`NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}`);
console.log(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com`);
console.log(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${projectId}.appspot.com`);
console.log('NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase ConsoleのProject Settings > General > Your appsから取得>');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase ConsoleのProject Settings > General > Your appsから取得>');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<Firebase ConsoleのProject Settings > Cloud Messagingから取得>');

console.log('\n========================================');
console.log('Firebase Consoleで確認する手順:');
console.log('========================================\n');
console.log('1. https://console.firebase.google.com/ にアクセス');
console.log(`2. プロジェクト "${projectId}" を選択`);
console.log('3. 左上の歯車アイコン > Project settings');
console.log('4. "General" タブ > "Your apps" セクション');
console.log('5. Webアプリ(</>アイコン)が無ければ追加');
console.log('6. "SDK setup and configuration" > "Config" を選択');
console.log('7. firebaseConfig オブジェクトの値をコピー\n');
