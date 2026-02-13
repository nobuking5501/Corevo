# ローカル環境での動作確認ガイド

このガイドでは、今回実装した改善内容をローカル環境（Firebase Emulator）で確認する手順を説明します。

## 📋 確認できる内容

1. ✅ 新規作成した顧客管理API（customers.ts）
2. ✅ リファクタリングした分析API（salesAnalysis, expenseAnalysis, adAnalysis）
3. ✅ Firebase Functions の正常動作
4. ✅ Emulator UI でのデータ確認

## 🚀 セットアップ手順

### ステップ1: Firebase Emulator の起動

```bash
# プロジェクトルートで実行
firebase emulators:start
```

**起動するEmulator:**
- Auth Emulator: http://localhost:9099
- Functions Emulator: http://localhost:5001
- Firestore Emulator: http://localhost:8080
- Storage Emulator: http://localhost:9199
- **Emulator UI**: http://localhost:4000 ← ここでデータ確認

### ステップ2: Web アプリの起動（別ターミナル）

```bash
# 別ターミナルを開く
npm run dev:web
```

**アクセス先:**
- Web アプリ: http://localhost:3006

---

## 🧪 改善内容の確認方法

### 1. 顧客管理API の動作確認

#### Emulator UI からテスト

1. http://localhost:4000 にアクセス
2. 左メニューの「Functions」をクリック
3. 「createCustomer」を選択
4. リクエストボディを入力：

```json
{
  "data": {
    "tenantId": "test-tenant-001",
    "name": "山田太郎",
    "kana": "やまだたろう",
    "email": "yamada@example.com",
    "phone": "090-1234-5678",
    "tags": ["VIP"],
    "notes": "テスト顧客",
    "consent": {
      "marketing": true,
      "photoUsage": false
    }
  }
}
```

5. 「Run function」をクリック

**期待される結果:**
```json
{
  "success": true,
  "customerId": "xxxxxxxxxx"
}
```

#### curl コマンドでテスト

```bash
# createCustomer
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/createCustomer \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "name": "佐藤花子",
      "email": "sato@example.com"
    }
  }'

# getCustomers（顧客一覧取得）
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/getCustomers \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "limit": 10
    }
  }'

# searchCustomers（顧客検索）
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/searchCustomers \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "query": "山田",
      "searchBy": "name"
    }
  }'
```

### 2. 分析API の動作確認

#### 売上分析（getSalesAnalysis）

```bash
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/getSalesAnalysis \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    }
  }'
```

**期待される結果:**
```json
{
  "success": true,
  "analysis": {
    "period": {
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    },
    "summary": {
      "totalRevenue": 0,
      "totalCount": 0,
      "averagePrice": 0
    },
    "byCourse": [],
    "byCustomerType": {...},
    "byPaymentMethod": {...},
    "byStaff": []
  }
}
```

#### 経費分析（getExpenseAnalysis）

```bash
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/getExpenseAnalysis \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "startMonth": "2026-01",
      "endMonth": "2026-01"
    }
  }'
```

#### 広告分析（getAdAnalysis）

```bash
curl -X POST http://localhost:5001/your-project-id/asia-northeast1/getAdAnalysis \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "startMonth": "2026-01",
      "endMonth": "2026-01"
    }
  }'
```

### 3. Firestore データの確認

1. http://localhost:4000 にアクセス
2. 左メニューの「Firestore」をクリック
3. 作成した顧客データを確認：
   - `tenants/test-tenant-001/customers/` 配下に顧客ドキュメントが作成されている

**確認ポイント:**
- `name`, `email`, `phone` が正しく保存されているか
- `createdAt`, `updatedAt` にタイムスタンプが設定されているか
- `consent` オブジェクトが正しく保存されているか

### 4. Web アプリからの動作確認

1. http://localhost:3006 にアクセス
2. ログイン（テストユーザーを事前作成）
3. `/customers` ページに移動
4. 顧客一覧が表示されることを確認

**確認ポイント:**
- 顧客一覧が正常に表示される
- 新規顧客作成フォームが動作する
- 顧客検索が動作する

---

## 🔧 トラブルシューティング

### エラー: "Auth Emulator not found"

**解決策:**
```bash
# Emulator を再起動
firebase emulators:start
```

### エラー: "Function not found"

**解決策:**
```bash
# Functions を再ビルド
cd backend/functions
npm run build
cd ../..
firebase emulators:start
```

### エラー: "CORS error"

**解決策:**
- Functions の `cors: true` 設定を確認（既に設定済み）
- ブラウザのキャッシュをクリア

### Emulator UI にアクセスできない

**解決策:**
```bash
# ポート 4000 が使用中か確認
lsof -i :4000

# 別のポートで起動
firebase emulators:start --ui-port 4001
```

---

## 📊 確認チェックリスト

### 顧客管理API
- [ ] createCustomer が正常に動作する
- [ ] updateCustomer が正常に動作する
- [ ] deleteCustomer が正常に動作する
- [ ] getCustomer が正常に動作する
- [ ] getCustomers が正常に動作する
- [ ] searchCustomers が正常に動作する
- [ ] 重複チェック（email）が動作する
- [ ] 重複チェック（phone）が動作する

### 分析API
- [ ] getSalesAnalysis が正常に動作する
- [ ] getExpenseAnalysis が正常に動作する
- [ ] getAdAnalysis が正常に動作する

### データ整合性
- [ ] Firestore にデータが正しく保存される
- [ ] タイムスタンプが自動設定される
- [ ] tenantId による分離が機能する

### Web アプリ
- [ ] /customers ページが正常に表示される
- [ ] 顧客作成フォームが動作する
- [ ] 顧客一覧が表示される

---

## 🎯 次のステップ

1. **本番環境へのデプロイ準備**
   ```bash
   # Security Rules を本番用に切り替え
   cp firestore.rules.production firestore.rules
   
   # デプロイ（人間の指示時のみ）
   npm run build
   firebase deploy --only functions
   ```

2. **テストの追加**
   ```bash
   cd backend/functions
   npm install --save-dev jest @types/jest ts-jest
   npm test
   ```

3. **本番データでの動作確認**
   - 既存顧客データのマイグレーション
   - 本番環境での動作テスト

---

## 📝 参考情報

### Emulator の停止

```bash
# Ctrl+C で停止
# または
firebase emulators:stop
```

### Emulator データのクリア

```bash
# すべてのデータを削除
firebase emulators:start --import=./emulator-data --export-on-exit
```

### ログの確認

```bash
# Functions のログ
firebase emulators:start --only functions --inspect-functions

# 詳細ログ
firebase emulators:start --debug
```

---

**作成日**: 2026-01-24
**最終更新**: 2026-01-24
