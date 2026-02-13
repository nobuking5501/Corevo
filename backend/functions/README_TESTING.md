# Testing Setup Guide

このドキュメントは、Firebase Functions のテスト環境をセットアップする手順を説明します。

## 📦 必要なパッケージのインストール

```bash
cd backend/functions
npm install --save-dev jest @types/jest ts-jest firebase-functions-test
```

## ⚙️ package.json にスクリプト追加

`backend/functions/package.json` の `scripts` セクションに以下を追加：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## 🚀 テストの実行

```bash
# すべてのテストを実行
npm test

# 監視モード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジレポート付き
npm run test:coverage
```

## 📁 テストファイルの構成

```
backend/functions/src/
├── __tests__/
│   ├── setup.ts              # Jest セットアップ（モック設定等）
│   └── customers.test.ts     # サンプルテスト
├── api/
│   └── customers.ts          # テスト対象API
└── jest.config.js            # Jest 設定
```

## ✏️ テストの書き方

### 基本パターン

```typescript
import { createCustomer } from '../api/customers';

describe('Customers API', () => {
  it('should create a customer with valid data', async () => {
    const mockRequest = {
      auth: {
        uid: 'test-user-id',
        token: {
          tenantIds: ['tenant-123'],
          roles: { 'tenant-123': 'staff' },
        },
      },
      data: {
        tenantId: 'tenant-123',
        name: '山田太郎',
        email: 'yamada@example.com',
      },
    };

    const result = await createCustomer(mockRequest as any);
    
    expect(result.success).toBe(true);
    expect(result.customerId).toBeDefined();
  });
});
```

## 🔧 Firebase Emulator でのテスト

より本格的なテストには、Firebase Emulator を使用します：

```bash
# Emulator を起動
firebase emulators:start

# 別ターミナルでテスト実行
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
npm test
```

## 📋 テストすべき項目

### すべてのAPIで共通
- ✅ 認証チェック（requireAuth）
- ✅ テナントアクセス権チェック（requireTenantAccess）
- ✅ 入力バリデーション（Zod schema）
- ✅ エラーハンドリング

### customers API
- ✅ 顧客作成（createCustomer）
- ✅ 顧客更新（updateCustomer）
- ✅ 顧客削除（deleteCustomer）
- ✅ 顧客取得（getCustomer）
- ✅ 顧客一覧（getCustomers）
- ✅ 顧客検索（searchCustomers）
- ✅ 重複チェック（email, phone）

### sales API
- ✅ 売上作成
- ✅ 顧客タイプ判定（new / existing）
- ✅ 金額計算

### charts API
- ✅ カルテ作成
- ✅ カルテ取得
- ✅ 写真アップロード

## 🎯 次のステップ

1. パッケージをインストール
2. サンプルテスト（customers.test.ts）を確認
3. 実際のテストケースを実装
4. 他のAPI（sales, charts, appointments）のテストを追加
5. カバレッジを確認し、80%以上を目指す

## 📚 参考資料

- [Jest Documentation](https://jestjs.io/)
- [Firebase Functions Test SDK](https://firebase.google.com/docs/functions/unit-testing)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
