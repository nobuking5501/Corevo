# CLAUDE.md - Claude エージェント行動指針

## はじめに

このドキュメントは、Claude Code エージェントが**Corevoプロジェクト**で作業する際の基本ルールを定義します。

Corevoは美容サロン経営支援SaaSであり、マルチテナント・前計算主義・承認制AIを特徴とします。

---

## 最優先原則

### 1. `/core` を最優先で参照すること

すべての作業において、`/core` ディレクトリ内のドキュメントを**最優先**で参照してください。

```
/core/
├── 00_concept.md       # プロジェクトコンセプト・アーキテクチャ方針
├── 01_agent_role.md    # エージェントの役割・権限・責任範囲
├── 02_rules.md         # コーディング規約・開発ルール
├── 03_domain.md        # ビジネスドメイン・KPI定義
├── 04_flow.md          # 開発フロー・タスク管理
└── 05_decisions.md     # 意思決定記録（Legacy変更は必須）
```

**タスク開始時の確認順序**:
1. `01_agent_role.md` - 自分の権限内か？
2. `03_domain.md` - ドメイン知識確認
3. `02_rules.md` - コーディング規約確認
4. `04_flow.md` - 作業フロー確認
5. `05_decisions.md` - 過去の決定確認

---

## Legacy コードの定義

### 2. git tag legacy-baseline 以前のコードは legacy と定義

- **Legacyとは**: コミットハッシュ `27c257a4f69fe3c509afb3eb3b29b477d3e7a570` 以前のすべてのコード
- **該当ファイル**: 251ファイル、53,468行
- **該当ディレクトリ**:
  - `apps/web/src/` （一部）
  - `backend/functions/src/` （一部）
  - `GAS/`
  - `docs/` （既存ファイルのみ）
  - その他既存ファイル

**判別方法**:
```bash
# ファイルがlegacyかどうか確認
git log --oneline --all legacy-baseline -- <file_path>
# 結果が表示されれば legacy、表示されなければ新規
```

---

## Legacy コードへの対応

### 3. legacy は原則変更しない

**基本方針**: 既存機能の維持を最優先とし、やむを得ない場合を除き変更しない

#### 例外: 変更が許可される場合

| ケース | 対応 | 記録 |
|--------|------|------|
| **Critical/High バグ** | 即座に修正可能 | 05_decisions.md に記録 |
| **セキュリティ脆弱性** | 即座に修正可能 | 05_decisions.md に記録 |
| **Medium バグ** | 人間に相談後、修正 | 05_decisions.md に記録 |
| **機能追加** | 新規ファイルで実装を検討 | 変更時のみ記録 |

#### 代替手段の検討

Legacy変更を避けるための戦略：
1. **新規ファイルで実装**: 既存コードを拡張ではなく新規作成
2. **ラッパー関数**: Legacyをラップして新機能追加
3. **並行実装**: Legacyを残したまま新版を作成

**例**:
```typescript
// ❌ Legacy変更
// apps/web/src/app/appointments/page.tsx を直接修正

// ✅ 新規作成
// apps/web/src/app/appointments-v2/page.tsx を作成し、
// 段階的に移行
```

### 4. legacy を修正する場合は 05_decisions.md に理由を記録

Legacy変更時は **必ず** `/core/05_decisions.md` に記録してください。

**記録テンプレート**:
```markdown
## [2026-01-23] Legacy修正: [タイトル]

### 状況・背景
[なぜ修正が必要だったか]

### 検討した選択肢
1. **案A: 新規実装で回避**
   - メリット: Legacyを保護
   - デメリット: [...]

2. **案B: Legacy修正**
   - メリット: [...]
   - デメリット: リスクあり

### 決定内容
案Bを採用し、Legacyを修正

### 理由
[なぜ修正を選んだか]

### 影響範囲
- 変更ファイル: apps/web/src/app/appointments/page.tsx:120-145
- 影響するコンポーネント: 予約管理機能
- ユーザーへの影響: バグ修正のため、ポジティブ

### 代替案を選ばなかった理由
新規実装では既存の予約データと整合性が取れないため

### 今後の課題
テストコードの追加が必要
```

---

## 新規実装

### 5. 新規実装は core に準拠する

すべての新規コード・機能は `/core` の定義に準拠してください。

#### 実装前チェックリスト

```markdown
- [ ] 00_concept.md のアーキテクチャ方針に合致？
- [ ] 02_rules.md のコーディング規約を遵守？
- [ ] 03_domain.md のビジネスルールを理解？
- [ ] 04_flow.md の開発フローに従う？
```

#### 実装パターン

**Firebase Functions API**:
```typescript
// ✅ 標準パターン（02_rules.md 参照）
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const schema = z.object({
  tenantId: z.string(),
  // ...
});

export const myFunction = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);
    const data = schema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    // ビジネスロジック

    return { success: true };
  }
);
```

**Next.js ページ**:
```typescript
// ✅ 標準パターン
"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

export default function MyPage() {
  const { currentTenantId } = useAuthStore();
  const [data, setData] = useState([]);

  useEffect(() => {
    // データ取得
  }, [currentTenantId]);

  return <div>...</div>;
}
```

---

## 作業フロー

### 標準フロー（04_flow.md 参照）

```
1. タスク受領
   ↓
2. /core 確認
   ↓
3. 既存コード調査
   ↓
4. Legacy変更必要？
   Yes → 人間に相談
   No  → 実装
   ↓
5. 自己レビュー
   ↓
6. 報告（変更内容、影響範囲、テスト方法）
```

### 質問が必要な状況

以下の場合は人間に確認してください：

```
✋ 確認が必要な状況:
1. Legacy変更が必要（Medium以下のバグ）
2. 複数の実装方法があり、トレードオフが存在
3. Breaking Change になる可能性
4. セキュリティに影響を与える可能性
5. ビジネスロジックの解釈が不明確
6. 新しい外部ライブラリの追加
```

**質問テンプレート**（01_agent_role.md 参照）:
```markdown
## 判断が必要な事項

### 状況
[...]

### 選択肢
1. 案A: [...] - メリット/デメリット
2. 案B: [...] - メリット/デメリット

### 推奨
案Aを推奨します。理由: [...]

### 質問
どちらで進めますか？
```

---

## プロジェクト固有の重要事項

### マルチテナント完全分離

```typescript
// ✅ 必ず tenantId を検証
await requireTenantAccess(request, tenantId);

// ✅ すべてのクエリで tenantId を指定
db.collection(`tenants/${tenantId}/customers`)
```

### 前計算主義

```typescript
// ❌ ダッシュボードで生データ集計
const appointments = await db.collection(`tenants/${tenantId}/appointments`).get();
const total = appointments.docs.reduce((sum, doc) => sum + doc.data().total, 0);

// ✅ 前計算済みメトリクスを参照
const metrics = await db.collection(`tenants/${tenantId}/metrics`)
  .where("period", "==", "daily")
  .where("date", "==", today)
  .limit(1)
  .get();
const total = metrics.docs[0].data().revenue;
```

### 承認制AI

```typescript
// ✅ AI提案は ai_suggestions に保存
await db.collection(`tenants/${tenantId}/ai_suggestions`).add({
  customerId,
  messageBody,
  reason,
  approved: false, // 人間の承認待ち
});

// ❌ 直接 messages に保存して送信
// これは禁止
```

### TypeScript Strict Mode

```typescript
// ✅ 型を明示
const customerId: string = "cust_123";

// ❌ any は禁止
const data: any = response.data;

// ✅ unknown + 型ガード
const data: unknown = response.data;
if (isValidData(data)) {
  // 安全に使用
}
```

---

## 禁止事項

### エージェントが実行してはいけないこと

1. **本番環境への直接操作**
   - Firebase Console での設定変更
   - 本番データベースの直接操作
   - 本番環境へのデプロイ

2. **ビジネス判断**
   - KPI目標値の変更
   - 料金プランの変更
   - ビジネスロジックの根本的な変更

3. **破壊的変更（相談なし）**
   - 既存APIのBreaking Change
   - データベーススキーマの互換性のない変更
   - 認証・認可ロジックの変更

---

## 報告スタイル

### 簡潔・事実ベース

```markdown
✅ 良い例:
顧客検索にフリガナ検索を追加しました。

変更ファイル:
- backend/functions/src/api/customers.ts:45-67
- apps/web/src/app/customers/page.tsx:120-145

テスト: Emulatorで動作確認済み

❌ 悪い例:
素晴らしい顧客検索機能を実装しました！
これでユーザー体験が大幅に向上するでしょう！
```

---

## 成功の定義

### エージェントとして成功とは

1. **人間の時間を節約**: 実装作業を効率化
2. **品質を維持**: バグを出さない、型安全性を保つ
3. **学習を促進**: コードを通じて知識を共有
4. **判断をサポート**: 選択肢と推奨を提示

### 避けるべき失敗

1. **過剰な自律**: 相談すべき時に独断で進める
2. **不十分な報告**: 変更内容が不明確
3. **過剰な提案**: 求められていないリファクタ
4. **評価的表現**: 「素晴らしい」「最高」等の主観

---

## クイックリファレンス

### よく使うコマンド

```bash
# Legacy確認
git log --oneline legacy-baseline -- <file>

# Core参照
cat core/01_agent_role.md
cat core/02_rules.md
cat core/03_domain.md

# 型定義確認
cat apps/web/src/types/index.ts

# API一覧確認
cat backend/functions/src/index.ts
```

### よく使うパターン

```typescript
// Firebase Functions
{ region: "asia-northeast1", cors: true }

// Zod バリデーション
const schema = z.object({ tenantId: z.string() });

// エラーハンドリング
throw new HttpsError("permission-denied", "...");

// Firestore パス
`tenants/${tenantId}/customers`

// Timestamp
admin.firestore.FieldValue.serverTimestamp()
```

---

## さいごに

このドキュメントと `/core` の内容を常に参照し、効率的かつ高品質な開発を進めてください。

迷ったら質問し、Legacy変更は必ず記録してください。

---

**最終更新**: 2026-01-23
**プロジェクト**: Corevo - 美容サロン経営OS
**Git Tag**: legacy-baseline (27c257a4f69fe3c509afb3eb3b29b477d3e7a570)
