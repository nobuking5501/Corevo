#!/usr/bin/env node

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and parse .env.local manually
const envPath = join(__dirname, "../apps/web/.env.local");
const envContent = readFileSync(envPath, "utf8");
const envVars = {};

envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

async function main() {
  console.log("🔄 パスワードをtest1234に設定してユーザーを再作成\n");
  console.log("=".repeat(80) + "\n");

  let prodUsers = [];

  // ステップ1: 本番Firebaseからユーザーを取得
  {
    console.log("📥 本番Firebaseからユーザーを取得中...\n");

    const prodApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
        privateKey: envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    }, "production-fetch-2");

    const listUsersResult = await prodApp.auth().listUsers(1000);
    prodUsers = listUsersResult.users;

    console.log(`✅ ${prodUsers.length}人のユーザーを取得しました\n`);

    await prodApp.delete();
  }

  // ステップ2: エミュレーターの既存ユーザーを削除して再作成
  {
    console.log("🗑️  エミュレーターの既存ユーザーを削除中...\n");

    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

    const emulatorApp = admin.initializeApp({
      projectId: "corevo-e1a8b",
    }, "emulator-reset");

    // 既存ユーザーを削除
    for (const user of prodUsers) {
      try {
        await emulatorApp.auth().deleteUser(user.uid);
        await emulatorApp.firestore().collection("users").doc(user.uid).delete();
        console.log(`✅ 削除: ${user.email}`);
      } catch (error) {
        // ユーザーが存在しない場合はスキップ
      }
    }

    console.log("\n📤 パスワード test1234 でユーザーを再作成中...\n");

    // 新しいパスワードで再作成
    for (const user of prodUsers) {
      try {
        console.log(`処理中: ${user.email}`);

        // ユーザー作成
        const createRequest = {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          photoURL: user.photoURL,
          disabled: user.disabled,
          password: "test1234", // 新しいパスワード
        };

        await emulatorApp.auth().createUser(createRequest);
        console.log(`   ✓ ユーザーを作成しました (パスワード: test1234)`);

        // カスタムクレームをコピー
        if (user.customClaims && Object.keys(user.customClaims).length > 0) {
          await emulatorApp.auth().setCustomUserClaims(user.uid, user.customClaims);
          console.log(`   ✓ カスタムクレームを設定しました`);
        }

        // Firestoreにユーザードキュメントを作成
        await emulatorApp.firestore().collection("users").doc(user.uid).set({
          email: user.email,
          isPlatformAdmin: user.customClaims?.isPlatformAdmin || false,
          tenantIds: user.customClaims?.tenantIds || [],
          organizationId: user.customClaims?.organizationId || null,
          roles: user.customClaims?.roles || {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✓ Firestoreドキュメントを作成しました`);
        console.log(`   ✅ 完了\n`);

      } catch (error) {
        console.error(`   ❌ ${user.email} の作成に失敗:`, error.message);
      }
    }
  }

  console.log("=".repeat(80));
  console.log("✅ ユーザーの再作成が完了しました！");
  console.log("\n📋 ログイン情報:");

  for (const user of prodUsers) {
    console.log(`   ${user.email} / test1234`);
  }

  console.log("\n🌐 http://localhost:3006 でログインしてください");

  process.exit(0);
}

main().catch(error => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
