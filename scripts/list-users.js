#!/usr/bin/env node

import admin from "firebase-admin";

// エミュレーターに接続
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = admin.initializeApp({
  projectId: "corevo-e1a8b",
});

async function listUsers() {
  console.log("👥 Firebase Auth Emulator のユーザー一覧\n");
  console.log("=".repeat(80));

  try {
    const listUsersResult = await app.auth().listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      console.log("ℹ️  登録されているユーザーはありません");
    } else {
      console.log(`✅ ${listUsersResult.users.length}人のユーザーが見つかりました\n`);
      
      for (const user of listUsersResult.users) {
        console.log(`📧 Email: ${user.email || "(なし)"}`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   表示名: ${user.displayName || "(なし)"}`);
        console.log(`   メール確認: ${user.emailVerified ? "済" : "未"}`);
        
        // カスタムクレームを取得
        const userRecord = await app.auth().getUser(user.uid);
        if (userRecord.customClaims) {
          console.log(`   カスタムクレーム:`, JSON.stringify(userRecord.customClaims, null, 2));
        }
        
        console.log("-".repeat(80));
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

listUsers();
