# 🚀 ローカル環境で確認する（クイックスタート）

## 最速で起動する方法

### 方法1: ワンコマンド起動（推奨）

```bash
./start-local.sh
```

これだけで以下が実行されます：
1. Functions のビルド
2. Firebase Emulator の起動

### 方法2: 手動起動

```bash
# 1. Functions をビルド
cd backend/functions
npm run build
cd ../..

# 2. Emulator 起動
firebase emulators:start
```

---

## 起動後のアクセス先

| サービス | URL |
|---------|-----|
| **Emulator UI** (推奨) | http://localhost:4000 |
| Functions | http://localhost:5001 |
| Firestore | http://localhost:8080 |
| Auth | http://localhost:9099 |

---

## APIをテストする

### 方法1: ブラウザでテスト（最も簡単）

1. `test-api.html` をブラウザで開く
2. 各ボタンをクリックしてAPIをテスト

**注意**: `test-api.html` の `PROJECT_ID` を実際のプロジェクトIDに置き換えてください

### 方法2: Emulator UI でテスト

1. http://localhost:4000 にアクセス
2. 左メニューの「Functions」をクリック
3. 関数を選択して「Run function」

### 方法3: curl でテスト

```bash
# 顧客作成
curl -X POST http://localhost:5001/YOUR_PROJECT_ID/asia-northeast1/createCustomer \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "name": "山田太郎",
      "email": "yamada@example.com"
    }
  }'
```

---

## 今回の改善内容を確認

### ✅ 1. 顧客管理API（新規作成）

以下のAPIが使用可能です：
- `createCustomer` - 顧客作成
- `updateCustomer` - 顧客更新
- `deleteCustomer` - 顧客削除
- `getCustomer` - 顧客取得
- `getCustomers` - 顧客一覧
- `searchCustomers` - 顧客検索

### ✅ 2. 分析API（リファクタリング済み）

以下のAPIが正常に動作します：
- `getSalesAnalysis` - 売上分析
- `getExpenseAnalysis` - 経費分析
- `getAdAnalysis` - 広告分析

### ✅ 3. Firestore Security Rules（本番用）

`firestore.rules.production` が作成されています。
本番デプロイ時に使用してください。

### ✅ 4. テスト環境

`backend/functions/src/__tests__/` にテストの土台が構築されています。

---

## トラブルシューティング

### Emulator が起動しない

```bash
# ポートを確認
lsof -i :4000
lsof -i :5001

# Firebase ツールを更新
npm install -g firebase-tools
```

### Functions の読み込みが遅い

初回起動時は時間がかかります（30秒〜1分程度）。
2回目以降は高速になります。

### ビルドエラーが出る

```bash
# 依存関係を再インストール
cd backend/functions
rm -rf node_modules
npm install
npm run build
```

---

## 停止方法

Emulator 実行中のターミナルで `Ctrl+C` を押す

---

## 詳細なガイド

詳しい確認方法は `LOCAL_VERIFICATION.md` を参照してください。

---

**作成日**: 2026-01-24
