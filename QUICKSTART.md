# Corevo クイックスタートガイド

最短で開発環境を立ち上げる手順。

## 前提条件

- Node.js 20+
- Firebase プロジェクト（または Emulator使用）
- npm または yarn

## ステップ 1: 依存関係インストール

```bash
# ルートで全ワークスペースのインストール
npm install
```

これにより以下がインストールされます：
- `apps/web` (Next.js)
- `backend/functions` (Firebase Functions)
- `infra/scripts` (シードスクリプト)

## ステップ 2: 環境変数設定

ルートに `.env` ファイルを作成：

```bash
cp .env.example .env
```

最低限必要な設定（Firebase Emulator 使用時）：

```env
# ダミー値でOK（Emulator使用時）
NEXT_PUBLIC_FIREBASE_API_KEY=dummy
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
NEXT_PUBLIC_APP_ENV=dev
```

## ステップ 3: Firebase Emulator 起動（推奨）

```bash
# Firebase CLI インストール
npm install -g firebase-tools

# Emulator 起動
firebase emulators:start
```

Emulator Suite が起動します：
- **Auth**: http://localhost:9099
- **Firestore**: http://localhost:8080
- **Functions**: http://localhost:5001
- **Storage**: http://localhost:9199
- **UI**: http://localhost:4000

## ステップ 4: Next.js 開発サーバー起動

別のターミナルで：

```bash
npm run dev:web
```

http://localhost:3000 でアプリにアクセスできます。

## ステップ 5: テストユーザー作成

### オプション A: Firebase Emulator で手動作成

1. Emulator UI (http://localhost:4000) を開く
2. Authentication → Add User
3. Email: `test@example.com`, Password: `test1234`

### オプション B: Seed Script 実行（本番Firebase使用時）

```bash
# Service Account Key を取得
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# ファイルを service-account-key.json として保存

cd infra/scripts
npm install
FIREBASE_SERVICE_ACCOUNT=../../service-account-key.json npm run seed
```

デモテナントが作成されます：
- **Email**: `owner@demo.corevo.test`
- **Password**: `demo1234`

## ステップ 6: ログイン

1. http://localhost:3000/login にアクセス
2. 作成したユーザーでログイン
3. 初回は `/onboarding` でテナント作成
4. `/dashboard` に遷移

## トラブルシューティング

### "Firebase not initialized" エラー

- `.env` ファイルが正しく配置されているか確認
- 環境変数が `NEXT_PUBLIC_` で始まっているか確認

### Functions が動かない

- Emulator が起動しているか確認
- `backend/functions` でビルドエラーがないか確認:
  ```bash
  cd backend/functions
  npm run build
  ```

### ログイン後にエラー

- Emulator 使用時は Custom Claims が自動設定されないため、`/onboarding` で手動作成が必要
- または Seed Script でテナントを事前作成

## 次のステップ

- [詳細なデプロイ手順](docs/DEPLOY.md)
- [データモデル](docs/DATA_MODEL.md)
- [Web App README](apps/web/README.md)
- [Functions README](backend/functions/README.md)

---

開発を楽しんでください！
