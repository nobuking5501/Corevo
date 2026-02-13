# 🌐 メインサイト（Webアプリ）へのアクセス

## ✅ 起動完了！

以下のサービスが起動中です：

| サービス | URL | 説明 |
|---------|-----|------|
| **📱 Webアプリ** | **http://localhost:3006** | **メインサイト（ここにアクセス）** |
| 🔥 Emulator UI | http://localhost:4000 | Firebase管理画面 |
| ⚙️ Functions | http://localhost:5001 | バックエンドAPI |
| 💾 Firestore | http://localhost:8080 | データベース |
| 🔐 Auth | http://localhost:9099 | 認証サービス |

---

## 🚀 今すぐアクセス

### メインサイトを開く

```
http://localhost:3006
```

ブラウザで上記URLを開いてください。

---

## 📋 確認できること

### 1. 新規作成した顧客管理機能

**アクセス先**: `/customers`

**確認内容**:
- ✅ 顧客一覧の表示
- ✅ 新規顧客の作成
- ✅ 顧客情報の編集
- ✅ 顧客の検索
- ✅ 顧客の削除

**操作手順**:
1. http://localhost:3006 にアクセス
2. ログイン（テストユーザーでログイン）
3. サイドバーから「顧客管理」または `/customers` に移動
4. 「新規顧客作成」ボタンをクリック
5. 以下の情報を入力：
   - 名前: 山田太郎
   - メールアドレス: yamada@example.com
   - 電話番号: 090-1234-5678
6. 「作成」をクリック

### 2. リファクタリング済みの分析機能

**アクセス先**: `/dashboard/analytics`

**確認内容**:
- ✅ 売上分析（コース別・スタッフ別）
- ✅ 経費分析（月次推移・カテゴリ別）
- ✅ 広告分析（媒体別ROI・CPA）

**注意**: 内部実装が改善されましたが、UIや機能は変更ありません

### 3. その他の既存機能

- `/dashboard` - ダッシュボード
- `/appointments` - 予約管理
- `/calendar` - カレンダー
- `/records` - カルテ管理
- `/settings` - 設定

---

## 🔧 初回アクセス時の準備

### テストユーザーの作成

Emulator UI でテストユーザーを作成します：

1. http://localhost:4000 にアクセス
2. 左メニューの「Authentication」をクリック
3. 「Add user」をクリック
4. 以下を入力：
   - Email: test@example.com
   - Password: password123
5. 「Save」をクリック

### テストテナントの作成

Emulator UI でテストテナントを作成します：

1. http://localhost:4000 にアクセス
2. 左メニューの「Firestore」をクリック
3. 「Start collection」をクリック
4. Collection ID: `tenants`
5. Document ID: `test-tenant-001`
6. 以下のフィールドを追加：
   ```
   name: "テストサロン"
   slug: "test-salon"
   status: "active"
   organizationId: "test-org-001"
   ```
7. 「Save」をクリック

---

## 🐛 トラブルシューティング

### Webアプリが表示されない

```bash
# Next.js が起動しているか確認
lsof -i :3006

# 起動していない場合は再起動
npm run dev:web
```

### "Not authenticated" エラーが出る

1. Emulator UI でテストユーザーを作成
2. ログインページでそのユーザーでログイン
3. 再度アクセス

### データが表示されない

1. Firestore Emulator にデータが存在するか確認
   - http://localhost:4000/firestore
2. テナントIDが正しいか確認
3. Custom Claims が設定されているか確認

### Functions が呼び出せない

```bash
# Functions のログを確認
# firebase.json の設定を確認
# .env.local に以下が設定されているか確認
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
```

---

## 📊 データの確認方法

### Firestore データの確認

1. http://localhost:4000 にアクセス
2. 左メニューの「Firestore」をクリック
3. 作成した顧客データを確認：
   - `tenants/test-tenant-001/customers/` 配下を確認

### Functions のログ確認

1. http://localhost:4000 にアクセス
2. 左メニューの「Logs」をクリック
3. API呼び出しのログを確認

---

## 🎯 推奨の確認フロー

### ステップ1: ログイン
1. http://localhost:3006 にアクセス
2. テストユーザーでログイン

### ステップ2: 顧客管理
1. `/customers` に移動
2. 新規顧客を作成
3. 顧客一覧が表示されることを確認
4. 顧客を検索
5. 顧客を編集

### ステップ3: Firestore確認
1. http://localhost:4000/firestore にアクセス
2. 作成した顧客データが保存されていることを確認

### ステップ4: 分析機能
1. `/dashboard/analytics` に移動
2. 各分析が正常に動作することを確認

---

## 🛑 停止方法

### Webアプリの停止

Webアプリが起動しているターミナルで `Ctrl+C`

### Emulatorの停止

Emulatorが起動しているターミナルで `Ctrl+C`

---

## 📝 次のステップ

1. ✅ ローカルで動作確認
2. ⚙️ テストの実行
3. 🚀 本番環境へのデプロイ準備
4. 📊 Security Rules の本番適用

---

**起動日時**: 2026-01-24
**Webアプリ**: http://localhost:3006 ← **ここにアクセス**
**Emulator UI**: http://localhost:4000
