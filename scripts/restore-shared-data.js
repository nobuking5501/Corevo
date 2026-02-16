#!/usr/bin/env node

/**
 * Restore shared emulator data
 * Copies baseline emulator data from emulator-data-shared to emulator-data
 * Usage: npm run emulator:restore-shared
 */

import { existsSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const sharedDataDir = join(rootDir, "emulator-data-shared");
const emulatorDataDir = join(rootDir, "emulator-data");

console.log("📦 Restoring shared emulator data...\n");
console.log("=" .repeat(60));

// Check if shared data exists
if (!existsSync(sharedDataDir)) {
  console.error("❌ Error: emulator-data-shared/ directory not found");
  console.error("\nThis directory should contain the baseline emulator data.");
  console.error("If you are a project owner, run:");
  console.error("  npm run emulator:copy-prod");
  console.error("  npm run emulator:save-shared");
  process.exit(1);
}

// Remove existing emulator-data if it exists
if (existsSync(emulatorDataDir)) {
  console.log("🗑️  Removing existing emulator-data/");
  rmSync(emulatorDataDir, { recursive: true, force: true });
  console.log("   ✅ Removed\n");
}

// Copy shared data to emulator-data
console.log("📋 Copying emulator-data-shared/ to emulator-data/");
cpSync(sharedDataDir, emulatorDataDir, { recursive: true });
console.log("   ✅ Copied\n");

console.log("=" .repeat(60));
console.log("✅ Shared emulator data restored successfully!");
console.log("\n📋 Data includes:");
console.log("   -本番Firebaseからコピーされたデータ");
console.log("   - Organizations, Tenants, Customers, Services, etc.");
console.log("   - テストユーザー (全員パスワード: test1234)");
console.log("\n🚀 Next steps:");
console.log("   1. npm run emulator         # エミュレーターを起動");
console.log("   2. npm run dev:web          # Web開発サーバーを起動");
console.log("   3. http://localhost:3006    # ブラウザで開く");
console.log("\n👤 ログイン情報:");
console.log("   test@corevo.dev / test1234");
console.log("   test@example.com / test1234");
