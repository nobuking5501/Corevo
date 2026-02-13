# 【生徒さん向け】Corevo開発環境セットアップガイド（Mac版）

このガイドに従って、開発環境をセットアップしてください。

## 🎯 最終ゴール

- ブラウザで http://localhost:3006 にアクセスできる
- `test@example.com` / `test1234` でログインできる
- ダッシュボードが表示される

---

## ステップ0: 事前準備

### 必要なもの

- ✅ Mac（macOS）
- ✅ GitHubアカウント（招待メールを承認済み）
- ✅ インターネット接続
- ⏱️ 時間: 約30分

---

## ステップ1: 必要なソフトウェアのインストール

### 1-1. ターミナルを開く

1. Finderを開く
2. 「アプリケーション」→「ユーティリティ」→「ターミナル」をダブルクリック

### 1-2. Homebrewをインストール（まだの場合）

ターミナルに以下をコピペして Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

パスワードを求められたら、Macのログインパスワードを入力してください（文字は表示されません）。

インストール確認:
```bash
brew --version
```
`Homebrew 4.x.x` のように表示されればOK。

### 1-3. Node.js 20をインストール

```bash
brew install node@20
```

インストール確認:
```bash
node --version
# v20.x.x と表示されればOK

npm --version
# 10.x.x と表示されればOK
```

### 1-4. Firebase CLIをインストール

```bash
npm install -g firebase-tools
```

インストール確認:
```bash
firebase --version
# 13.x.x などと表示されればOK
```

### 1-5. Gitの確認

```bash
git --version
```

`git version 2.x.x` と表示されればOK。

もし「コマンドが見つかりません」と出たら:
```bash
brew install git
```

---

## ステップ2: プロジェクトをダウンロード

### 2-1. GitHubの招待を承認

1. メールボックスを確認
2. GitHubからの招待メール「You've been invited to join...」を開く
3. 「View invitation」をクリック
4. 「Accept invitation」をクリック

### 2-2. 作業フォルダに移動

```bash
# デスクトップの専用フォルダに移動（先生が作成済み）
cd ~/Desktop/Corevo専用フォルダ
```

または、デスクトップに直接クローンする場合:
```bash
cd ~/Desktop
```

### 2-3. プロジェクトをクローン

```bash
git clone https://github.com/nobuking5501/Corevo.git
```

**初回のみ**: GitHubのユーザー名とパスワードを求められる場合があります。
- Username: あなたのGitHubユーザー名
- Password: GitHubのパーソナルアクセストークン（パスワードではありません）

### 2-4. フォルダに移動

```bash
cd Corevo
```

### 2-5. 中身を確認

```bash
ls -la
```

以下のようなフォルダが見えればOK:
```
apps/
backend/
core/
docs/
README.md
package.json
```

---

## ステップ3: 依存関係のインストール

### 3-1. パッケージをインストール

```bash
npm install
```

**⏱️ 3〜5分かかります。**

エラーが出なければ成功です。

---

## ステップ4: 環境変数の設定

### 4-1. 環境変数ファイルをコピー

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

### 4-2. 環境変数を編集

```bash
# VSCodeで開く（VSCodeがインストール済みの場合）
code apps/web/.env.local

# または、テキストエディタで開く
open -a TextEdit apps/web/.env.local
```

**以下の行を確認:**

```bash
NEXT_PUBLIC_APP_ENV=dev
```

この行が `dev` になっていればOK。（これでローカルEmulatorを使います）

**保存して閉じる。**

---

## ステップ5: 開発環境を起動

ここから**3つのターミナルウィンドウ**を使います。

### 5-1. ターミナル1: Firebase Emulator起動

```bash
# Corevoフォルダにいることを確認
pwd
# /Users/あなたの名前/Desktop/Corevo と表示されればOK

# Emulator起動
npm run emulator
```

**以下のように表示されれば成功:**

```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000                │
└─────────────────────────────────────────────────────────────┘
```

**このターミナルはそのままにしておく！**

---

### 5-2. ターミナル2: テストデータ投入

**新しいターミナルを開く:**
- Command + T を押す
- または「シェル」→「新規ウインドウ」→「新規タブ」

```bash
# Corevoフォルダに移動
cd ~/Desktop/Corevo

# テストデータを投入
npm run emulator:seed
```

**以下のように表示されれば成功:**

```
✅ Emulator seed completed successfully!
Created:
- 4 organizations
- 8 tenants
- 2 users (admin@corevo.test, test@example.com)
- 44 customers
- 111 appointments
```

---

### 5-3. ターミナル3: Web開発サーバー起動

**もう1つ新しいターミナルを開く:**
- Command + T を押す

```bash
# Corevoフォルダに移動
cd ~/Desktop/Corevo

# Web開発サーバー起動
npm run dev:web
```

**以下のように表示されれば成功:**

```
- ready started server on 0.0.0.0:3006, url: http://localhost:3006
- event compiled client and server successfully
```

---

## ステップ6: ブラウザで確認

### 6-1. Webアプリを開く

ブラウザ（ChromeやSafari）で以下のURLを開く:

```
http://localhost:3006
```

**ログイン画面が表示されればOK！**

### 6-2. ログインする

```
メールアドレス: test@example.com
パスワード: test1234
```

**ダッシュボードが表示されれば成功です！🎉**

### 6-3. Emulator UIを確認（オプション）

```
http://127.0.0.1:4000
```

ここでFirestoreのデータや認証ユーザーを確認できます。

---

## ステップ7: 開発の準備

### 7-1. 必読ドキュメント

開発を始める前に、以下のファイルを必ず読んでください:

```bash
# 1. 全体の行動指針（最重要！）
cat CLAUDE.md

# 2. コーディング規約（超重要！）
cat core/02_rules.md

# 3. 開発フロー
cat core/04_flow.md

# 4. プロジェクトの概念
cat core/00_concept.md
```

**特に `core/02_rules.md` は必読です！**

### 7-2. VSCodeで開く（推奨）

```bash
# プロジェクト全体をVSCodeで開く
code .
```

---

## 日常的な開発の流れ

### 毎回の開発開始時

```bash
# ターミナル1: Emulator起動
cd ~/Desktop/Corevo
npm run emulator

# ターミナル2: Web開発サーバー起動
cd ~/Desktop/Corevo
npm run dev:web

# ブラウザで開く
# http://localhost:3006
```

### コードを変更したら

1. ファイルを保存
2. ブラウザが自動的にリロードされる
3. 変更が反映される

### 最新コードを取得（先生が更新した場合）

```bash
# 変更を保存してコミット（後述）

# 最新コードを取得
git pull origin main
```

### 自分の変更をGitHubに送る

```bash
# 変更をステージング
git add .

# コミット
git commit -m "機能追加: 〇〇を実装"

# GitHubにプッシュ
git push origin main
```

---

## よくあるエラーと対処法

### エラー1: `npm install` でエラー

```bash
# Node.jsのバージョンを確認
node --version
# v20.x.x でない場合は再インストール

# キャッシュをクリア
npm cache clean --force

# 再インストール
rm -rf node_modules
npm install
```

### エラー2: Emulatorが起動しない（ポート使用中）

```bash
# ポートを使用しているプロセスを確認
lsof -i :8080

# プロセスを終了（<PID>は上記で表示された数字）
kill -9 <PID>

# Emulatorを再起動
npm run emulator
```

### エラー3: `git clone` でエラー

```bash
# GitHubの招待を承認しているか確認
# https://github.com/nobuking5501/Corevo にアクセスできるか確認

# SSH鍵の設定が必要な場合は、HTTPSでクローン（上記のコマンドはHTTPS）
```

### エラー4: ログイン画面で「Firebase configuration error」

```bash
# .env.localを確認
cat apps/web/.env.local

# NEXT_PUBLIC_APP_ENV=dev になっているか確認
```

### エラー5: Web開発サーバーが起動しない

```bash
# Functionsをビルド
cd backend/functions
npm run build
cd ../..

# 再起動
npm run dev:web
```

---

## 困ったときの連絡方法

- 先生に質問する
- このガイドをもう一度読む
- エラーメッセージをコピーして共有する

---

## まとめ: 3つのターミナルで開発

| ターミナル | コマンド | 役割 |
|----------|---------|------|
| **ターミナル1** | `npm run emulator` | Firebase Emulator（データベース） |
| **ターミナル2** | `npm run dev:web` | Web開発サーバー（Next.js） |
| **ターミナル3** | 作業用 | Git操作、ファイル確認など |

---

## 次のステップ

1. ✅ 開発環境のセットアップ完了
2. 📚 `core/02_rules.md` を読む
3. 🛠️ 最初のタスクを受け取る
4. 💻 コードを書き始める

頑張ってください！🚀
