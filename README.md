# Corevo - サロン経営OS

マルチテナントSaaSとして、美容サロンの経営を効率化する統合プラットフォーム。

## 特徴

- **マルチテナント**: 完全に分離されたデータ管理
- **PC/スマホ最適化**: PCは経営ダッシュボード、スマホは現場UI
- **AI駆動**: 夜間バッチで予測・インサイト・顧客提案を自動生成
- **前計算主義**: ダッシュボードは集計済みメトリクスのみ参照
- **承認制送信**: AI提案は必ず人間が承認してから配信

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, FullCalendar
- **バックエンド**: Firebase (Auth, Firestore, Storage, Functions, Scheduler)
- **決済**: Stripe (サブスクリプション管理)
- **メール**: SendGrid / Gmail API
- **AI**: Claude API (Anthropic)

## プロジェクト構成

```
Corevo/
├── apps/
│   └── web/              # Next.js フロントエンド (Vercel)
├── backend/
│   └── functions/        # Firebase Functions (Node 20, asia-northeast1)
├── ai/
│   ├── insight/          # AI予測・インサイト設計
│   └── prompt/           # プロンプトテンプレート
├── infra/
│   └── scripts/          # テナント初期化、シードスクリプト
├── docs/
│   ├── DEPLOY.md         # デプロイ手順
│   ├── DATA_MODEL.md     # データモデル詳細
│   └── ...
├── .env.example          # 環境変数テンプレート
└── package.json          # ワークスペース管理
```

## クイックスタート

> 💡 **共同開発者向け**: 詳細なセットアップ手順は [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください

### 前提条件

- Node.js 20+
- npm 10+
- Firebase CLI (`npm install -g firebase-tools`)

### 1. セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd Corevo

# 依存関係のインストール
npm install

# 環境変数の設定
cp apps/web/.env.local.example apps/web/.env.local
# apps/web/.env.local を編集してFirebase設定を追加
```

### 2. Firebase Emulatorで開発（推奨）

本番環境に影響を与えずにローカルで開発できます。

```bash
# ターミナル1: Emulator起動
npm run emulator

# ターミナル2: テストデータ投入
npm run emulator:seed

# ターミナル3: Web開発サーバー起動
npm run dev:web
```

**アクセス**:
- Web App: http://localhost:3006
- Emulator UI: http://127.0.0.1:4000

**テスト用ログイン**:
- Email: `test@example.com`
- Password: `test1234`

### 3. 本番Firebaseで開発

```bash
# Firebase にログイン
firebase login

# Firebase プロジェクトを選択
firebase use --add

# Web開発サーバー起動（.env.localでNEXT_PUBLIC_APP_ENV=productionに設定）
npm run dev:web
```

## 主要機能

### PC向け（経営者・管理者）

- **ダッシュボード**: 実績/予測/AIインサイト、KPI、スタッフ分析
- **詳細レポート**: 売上推移、構成比、A/Bテスト、失客予兆
- **AIコンソール**: 提案の承認・送信管理

### スマホ向け（スタッフ）

- **今日の予約**: 当日スケジュール一覧
- **顧客カード**: 施術履歴、メモ、写真
- **承認待ち**: AI提案の簡易承認

### 共通

- **カレンダー**: 日/週/月表示、ドラッグ&ドロップ予約
- **顧客管理**: 検索、タイムライン、施術記録
- **メニュー管理**: 価格、所要時間、粗利率設定
- **Billing**: Stripe連携のプラン変更

## 開発コマンド

```bash
# ビルド
npm run build              # 全体
npm run build:web          # Web のみ
npm run build:functions    # Functions のみ

# Linting
npm run lint

# テスト
npm run test

# デプロイ
# 詳細は docs/DEPLOY.md 参照
```

## ドキュメント

- [デプロイ手順](docs/DEPLOY.md)
- [データモデル](docs/DATA_MODEL.md)
- [Web App README](apps/web/README.md)
- [Functions README](backend/functions/README.md)

## セキュリティ

- Email+Password 認証（Google ログイン不使用）
- tenantId による完全分離
- Security Rules で他テナントアクセス防止
- 重要操作は Functions 経由のみ
- 署名付きURL によるストレージアクセス

## ライセンス

UNLICENSED - Private/Commercial Use
