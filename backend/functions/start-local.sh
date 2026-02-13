#!/bin/bash

echo "🚀 Corevo ローカル環境セットアップ"
echo "=================================="
echo ""

# 1. Functions のビルド
echo "📦 Step 1: Functions をビルド中..."
cd backend/functions
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Functions のビルドに失敗しました"
  exit 1
fi
cd ../..
echo "✅ Functions のビルド完了"
echo ""

# 2. Firebase Emulator の起動
echo "🔥 Step 2: Firebase Emulator を起動中..."
echo ""
echo "以下のURLでアクセスできます:"
echo "  - Emulator UI: http://localhost:4000"
echo "  - Functions: http://localhost:5001"
echo "  - Firestore: http://localhost:8080"
echo "  - Auth: http://localhost:9099"
echo ""
echo "停止するには Ctrl+C を押してください"
echo ""

firebase emulators:start
