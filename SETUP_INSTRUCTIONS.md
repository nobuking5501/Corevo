# Corevo セットアップ手順

## 現在の状態

✅ Service Accountキーを保存しました
✅ プロジェクトID: `corevo-e1a8b`
✅ 開発サーバーが http://localhost:3005 で起動中

## ⚠️ 重要: 次に必要な作業

Firebase Consoleで**Webアプリを登録**する必要があります。

### 手順

#### 1. Firebase Console にアクセス

https://console.firebase.google.com/project/corevo-e1a8b/settings/general

#### 2. Webアプリを追加

1. "Your apps" セクションを探す
2. "Add app" ボタンをクリック
3. **Web** (</> アイコン) を選択
4. アプリのニックネームを入力: `Corevo Web`
5. "Firebase Hosting" のチェックは**不要**（Vercelを使用）
6. "Register app" をクリック

#### 3. 設定値を取得

登録完了後、以下のような画面が表示されます:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "corevo-e1a8b.firebaseapp.com",
  projectId: "corevo-e1a8b",
  storageBucket: "corevo-e1a8b.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

#### 4. 自動設定スクリプトを実行

ターミナルで以下を実行:

```bash
node fetch-web-config.js
```

このスクリプトが自動的に `apps/web/.env.local` を更新します。

#### 5. 開発サーバーを再起動

```bash
# 現在のサーバーを停止 (Ctrl+C)
# 再起動
npm run dev
```

#### 6. ブラウザで確認

http://localhost:3005 にアクセスして、Firebaseエラーが解消されていることを確認。

---

## 🔐 セキュリティ警告

**重要**: Service Accountのprivate keyがこのチャット履歴に公開されています。

### 必須の対応

1. [IAM & Admin コンソール](https://console.cloud.google.com/iam-admin/serviceaccounts?project=corevo-e1a8b) にアクセス
2. `firebase-adminsdk-fbsvc@corevo-e1a8b.iam.gserviceaccount.com` を選択
3. "Keys" タブを開く
4. 現在のキー (`5de95c8...`) を**削除**
5. 新しいキーを生成
6. 新しい `service-account-key.json` で上書き

---

## Firebase 認証とFirestoreの有効化

アプリを使用するには、以下も有効化する必要があります:

### Authentication (認証)

1. https://console.firebase.google.com/project/corevo-e1a8b/authentication
2. "Get started" をクリック
3. "Email/Password" を有効化
4. "Email link (passwordless sign-in)" は**無効**のまま

### Firestore Database

1. https://console.firebase.google.com/project/corevo-e1a8b/firestore
2. "Create database" をクリック
3. ロケーション: `asia-northeast1` (東京) を選択
4. "Start in test mode" を選択（後でセキュリティルールを適用）
5. "Enable" をクリック

### Storage

1. https://console.firebase.google.com/project/corevo-e1a8b/storage
2. "Get started" をクリック
3. "Start in test mode" を選択
4. ロケーション: `asia-northeast1` を選択

---

## テストユーザーの作成

### オプション1: 手動作成

1. [Authentication](https://console.firebase.google.com/project/corevo-e1a8b/authentication/users) にアクセス
2. "Add user" をクリック
3. Email: `test@corevo.local`, Password: `test1234`

### オプション2: Seed Script使用

```bash
cd infra/scripts
npm install
FIREBASE_SERVICE_ACCOUNT=../../service-account-key.json npm run seed
```

デモテナントとユーザーが作成されます。

---

## トラブルシューティング

### "Firebase: Error (auth/invalid-api-key)"

→ Webアプリがまだ登録されていません。上記の手順1-4を実行してください。

### "Missing or insufficient permissions"

→ Firestore のセキュリティルールを確認。テストモードで開始してください。

### "Storage: Object ... does not exist"

→ Firebase Storage が有効化されていません。上記の手順を実行してください。

---

## 次のステップ

1. ✅ Webアプリを登録
2. ✅ Authentication, Firestore, Storageを有効化
3. ✅ テストユーザーを作成
4. ✅ http://localhost:3005 でログイン
5. 🎉 開発開始！
