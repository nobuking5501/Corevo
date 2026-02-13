# 02_rules.md - 開発ルール

## コーディング規約

### TypeScript

#### 基本方針
```typescript
// ✅ 常にstrict modeで記述
// tsconfig.json で "strict": true

// ✅ 型を明示（推論に頼りすぎない）
const customerId: string = "cust_123";
const amount: number = 10000;

// ❌ any は禁止（やむを得ない場合はコメント必須）
const data: any = response.data; // ❌

// ✅ unknown を使う
const data: unknown = response.data; // ✅
if (typeof data === "object" && data !== null) {
  // 型ガードで安全に使用
}
```

#### 命名規則

| 種類 | 規則 | 例 |
|------|------|---|
| **変数・関数** | camelCase | `customerId`, `getUserName()` |
| **型・インターフェース** | PascalCase | `Customer`, `AppointmentStatus` |
| **定数** | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_ENDPOINT` |
| **プライベート変数** | _prefix | `_internalState` |
| **コンポーネント** | PascalCase | `CustomerList.tsx` |
| **ファイル名** | kebab-case or camelCase | `customer-list.ts`, `useAuth.ts` |

#### 関数

```typescript
// ✅ 関数は小さく、単一責任
function calculateTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ✅ 早期リターンで nest を減らす
function processOrder(order: Order): Result {
  if (!order.items.length) return { success: false, error: "No items" };
  if (order.total < 0) return { success: false, error: "Invalid total" };

  // 正常系の処理
  return { success: true };
}

// ❌ 深いネスト
function processOrder(order: Order): Result {
  if (order.items.length > 0) {
    if (order.total >= 0) {
      // 正常系の処理
      return { success: true };
    }
  }
  return { success: false };
}
```

### Firebase Functions

#### API実装パターン

```typescript
// ✅ 標準パターン
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// 1. Zodスキーマで入力バリデーション
const createCustomerSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

// 2. onCall で Callable Function
export const createCustomer = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    // 3. 認証チェック
    requireAuth(request);

    // 4. バリデーション
    const data = createCustomerSchema.parse(request.data);

    // 5. 認可チェック
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // 6. ビジネスロジック
      const customerRef = await db
        .collection(`tenants/${data.tenantId}/customers`)
        .add({
          ...data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // 7. 成功レスポンス
      return { success: true, customerId: customerRef.id };

    } catch (error: any) {
      // 8. エラーハンドリング
      throw new HttpsError("internal", error.message || "Failed to create customer");
    }
  }
);
```

#### エラーハンドリング

```typescript
// ✅ HttpsError を使用
throw new HttpsError(
  "permission-denied",  // code: unauthenticated, permission-denied, not-found, internal, etc.
  "User does not have access to this tenant",  // message
  { tenantId, userId }  // details (optional)
);

// ✅ try-catch でラップ
try {
  await db.collection("...").doc(id).update({ ... });
} catch (error: any) {
  throw new HttpsError("internal", error.message || "Operation failed");
}
```

### Next.js / React

#### コンポーネント設計

```typescript
// ✅ 関数コンポーネント + TypeScript
interface CustomerCardProps {
  customer: Customer;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{customer.name}</h3>
      <button onClick={() => onEdit(customer.id)}>編集</button>
      <button onClick={() => onDelete(customer.id)}>削除</button>
    </div>
  );
}

// ❌ default export は避ける（名前の一貫性のため）
export default CustomerCard; // ❌
```

#### Hooks ルール

```typescript
// ✅ カスタムフックは use で始める
function useCustomers(tenantId: string) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // データ取得ロジック
  }, [tenantId]);

  return { customers, loading };
}

// ✅ 依存配列を正しく指定
useEffect(() => {
  fetchData(tenantId);
}, [tenantId]); // tenantId を依存配列に含める
```

### Zustand State Management

```typescript
// ✅ 標準パターン
import { create } from "zustand";

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;

  // Actions
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  loading: false,
  error: null,

  setCustomers: (customers) => set({ customers }),
  addCustomer: (customer) =>
    set((state) => ({ customers: [...state.customers, customer] })),
  updateCustomer: (id, updates) =>
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCustomer: (id) =>
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

## ファイル構成ルール

### ディレクトリ構造

```
apps/web/src/
├── app/                    # Next.js App Router ページ
│   ├── dashboard/         # ダッシュボード機能
│   ├── customers/         # 顧客管理
│   ├── settings/          # 設定
│   └── ...
├── components/            # 再利用可能コンポーネント
│   ├── ui/               # shadcn/ui コンポーネント
│   └── layout/           # レイアウトコンポーネント
├── stores/               # Zustand stores
├── types/                # 型定義
├── lib/                  # ユーティリティ関数
└── styles/               # 共通スタイル

backend/functions/src/
├── api/                  # Callable Functions
│   ├── appointments.ts
│   ├── customers.ts
│   └── ...
├── scheduled/            # Scheduled Functions
│   ├── metricsJob.ts
│   └── ...
├── utils/                # ユーティリティ
│   └── middleware.ts
└── index.ts              # エントリーポイント
```

### ファイル命名

```
✅ 良い例:
- apps/web/src/app/customers/page.tsx
- backend/functions/src/api/appointments.ts
- apps/web/src/stores/auth.ts
- apps/web/src/types/index.ts

❌ 悪い例:
- CustomerPage.tsx (App Routerでは page.tsx 固定)
- appointments-api.ts (kebab-caseとcamelCaseの混在)
```

## Git ルール

### コミットメッセージ

```
[カテゴリ] 概要（50文字以内）

詳細説明（必要なら）
- 変更理由
- 影響範囲

例:
[feat] 顧客検索にフリガナ検索を追加

- Firestoreクエリにkanaフィールドの範囲検索を追加
- UIに検索ボックスを追加
- 影響: customers API, customers page
```

**カテゴリ**:
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `style`: コードスタイル（機能変更なし）
- `test`: テスト追加・修正
- `chore`: ビルド・設定変更

### ブランチ戦略

```
main (本番環境)
  ├── develop (開発環境)
  │   ├── feature/customer-search
  │   ├── fix/appointment-bug
  │   └── refactor/types-cleanup
```

**ブランチ命名**:
- `feature/機能名`: 新機能
- `fix/バグ名`: バグ修正
- `refactor/対象名`: リファクタリング

### Legacy コード変更時の Git 運用

```bash
# 1. Legacy変更が必要な場合
git checkout -b fix/legacy-appointment-bug

# 2. 変更実施

# 3. 05_decisions.md に記録を追加
git add core/05_decisions.md
git add apps/web/src/app/appointments/page.tsx

# 4. コミット
git commit -m "[fix] Legacy: 予約キャンセルバグ修正

- appointments/page.tsx のステータス更新ロジックを修正
- 詳細: 05_decisions.md を参照"
```

## コードレビュールール

### エージェントによる自己レビュー

実装後、以下をチェック：

```markdown
## セルフレビューチェックリスト

### 型安全性
- [ ] TypeScript エラーなし
- [ ] any 型を使用していない
- [ ] Zod バリデーション実装済み

### セキュリティ
- [ ] tenantId 検証済み
- [ ] requireAuth / requireTenantAccess 実装済み
- [ ] 機密情報のログ出力なし

### パフォーマンス
- [ ] 不要なFirestore読み取りなし
- [ ] 無限ループの可能性なし
- [ ] メモリリークの可能性なし

### テスト
- [ ] Emulatorで動作確認済み
- [ ] エラーケースの確認済み

### ドキュメント
- [ ] 複雑なロジックにコメント追加
- [ ] Legacy変更時は 05_decisions.md に記録
```

### 人間によるレビューが必要なケース

- Security Rules の変更
- 認証・認可ロジックの変更
- データモデルの変更
- Breaking Change
- パフォーマンスに大きな影響を与える変更

## テストルール

### 現状

- **単体テスト**: 未実装（今後導入）
- **E2Eテスト**: 未実装（今後導入）
- **手動テスト**: Emulator で実施

### 今後のテスト方針

```typescript
// ✅ Firebase Functions の単体テスト例（今後実装）
import { createCustomer } from "../api/customers";

describe("createCustomer", () => {
  it("should create a customer", async () => {
    const result = await createCustomer({
      tenantId: "test-tenant",
      name: "山田太郎",
      email: "yamada@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.customerId).toBeDefined();
  });

  it("should fail without tenantId", async () => {
    await expect(
      createCustomer({ name: "山田太郎" })
    ).rejects.toThrow();
  });
});
```

## パフォーマンスルール

### Firestore 最適化

```typescript
// ✅ 必要最小限のフィールドのみ取得
const snapshot = await db
  .collection(`tenants/${tenantId}/customers`)
  .select("name", "email") // select で絞り込み
  .limit(10)
  .get();

// ❌ 全フィールドを取得
const snapshot = await db
  .collection(`tenants/${tenantId}/customers`)
  .get(); // 全フィールド取得は避ける

// ✅ インデックスを活用
const snapshot = await db
  .collection(`tenants/${tenantId}/appointments`)
  .where("staffId", "==", staffId)
  .where("startAt", ">=", startOfDay)
  .orderBy("startAt") // インデックス必要
  .get();
```

### Next.js 最適化

```typescript
// ✅ 動的import で Code Splitting
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <p>Loading...</p>,
  ssr: false, // クライアントサイドのみ
});

// ✅ Image最適化
import Image from "next/image";

<Image
  src={customer.photoURL}
  alt={customer.name}
  width={100}
  height={100}
  loading="lazy"
/>
```

## セキュリティルール

### 入力バリデーション

```typescript
// ✅ 必ず Zod でバリデーション
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  url: z.string().url().optional(),
});

const data = schema.parse(request.data); // エラー時は throw
```

### SQL Injection 対策（Firestoreは基本的に安全）

```typescript
// ✅ Firestoreは prepared statement 相当
await db.collection("customers").where("email", "==", email).get();

// ❌ 文字列連結は不要（Firestoreでは使わない）
```

### XSS 対策

```typescript
// ✅ React は自動でエスケープ
<div>{customer.name}</div> // 安全

// ❌ dangerouslySetInnerHTML は避ける
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // 危険
```

## 依存関係管理

### パッケージ追加ルール

```bash
# ✅ 追加前に確認
# 1. 本当に必要か？（既存ライブラリで代用できないか）
# 2. メンテナンスされているか？
# 3. ライセンスは商用利用可能か？

# ✅ 追加時は人間に相談
npm install <package>

# ✅ devDependencies と dependencies を区別
npm install -D <package>  # 開発時のみ
npm install <package>     # 本番環境でも必要
```

### バージョン管理

```json
// ✅ package.json
{
  "dependencies": {
    "next": "^14.2.18",     // メジャーバージョン固定
    "react": "^18.3.1",     // メジャーバージョン固定
    "firebase": "^10.14.1"  // メジャーバージョン固定
  }
}
```

---

**最終更新**: 2026-01-23
**次回見直し**: ルール違反が発生した時
