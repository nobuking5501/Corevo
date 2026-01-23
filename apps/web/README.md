# Corevo Web App

Next.js 14 (App Router) で構築されたフロントエンド。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UI コンポーネント**: shadcn/ui (Radix UI)
- **状態管理**: Zustand
- **Firebase**: Firebase SDK (Auth, Firestore, Storage, Functions)
- **カレンダー**: FullCalendar
- **チャート**: Recharts

## ディレクトリ構成

```
src/
├── app/               # App Router ページ
│   ├── login/         # ログインページ
│   ├── onboarding/    # テナント作成
│   ├── dashboard/     # ダッシュボード（PC専用）
│   ├── calendar/      # 予約カレンダー
│   ├── customers/     # 顧客管理
│   ├── records/       # 施術記録
│   ├── services/      # メニュー管理
│   ├── ai/            # AI提案キュー
│   ├── billing/       # Stripe 請求
│   └── settings/      # 設定
├── components/
│   ├── ui/            # shadcn/ui コンポーネント
│   ├── layout/        # レイアウトコンポーネント
│   ├── dashboard/     # ダッシュボード用コンポーネント
│   ├── calendar/      # カレンダー用コンポーネント
│   └── customer/      # 顧客管理用コンポーネント
├── lib/
│   ├── firebase.ts    # Firebase 初期化
│   └── utils.ts       # ユーティリティ関数
├── hooks/
│   └── use-toast.ts   # Toast フック
├── stores/
│   └── auth.ts        # 認証ストア（Zustand）
└── types/
    └── index.ts       # TypeScript 型定義
```

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

ルートの `.env` ファイルに以下を設定：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_APP_ENV=dev
```

### 3. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

## 主要機能

### 認証フロー

1. `/login` でメール＋パスワードでログイン
2. 初回ログイン時は `/onboarding` に自動遷移
3. テナント作成後は `/dashboard` に遷移

### PC / スマホ最適化

- **PC**: 詳細KPI、グラフ、A/B分析、エクスポート
- **スマホ**: 今日の予約、承認待ち、顧客カード（簡易表示）

レスポンシブ対応により、画面サイズで自動切り替え。

### AuthProvider

`src/components/layout/AuthProvider.tsx` が認証状態を監視し、以下を自動処理：

- ログイン状態の確認
- Custom Claims からテナントID取得
- ユーザー情報とテナント情報の読み込み
- 未認証時は `/login` にリダイレクト
- テナント未作成時は `/onboarding` にリダイレクト

### ダッシュボード

`/dashboard` で以下を表示：

- 今日/週間の売上・予約数・No-show率
- AI売上予測（来月・再来月）
- AIインサイト（注意報・機会・不足分析）

**重要**: ダッシュボードは生データを集計せず、必ず `metrics/forecasts/insights` コレクションの前計算データを参照します。

### カレンダー

`/calendar` で予約スケジュールを管理。

- FullCalendar による日/週/月表示
- ドラッグ&ドロップで予約作成・移動
- スタッフフィルタ
- 空き枠レコメンド

### 顧客管理

`/customers` で顧客情報を管理。

- 検索（名前、カナ、電話番号）
- 個別ページ（`/customers/[id]`）でタイムライン表示
  - 予約履歴
  - 施術記録（写真付き）
  - 送信メッセージ履歴
  - AI提案履歴

### AI提案キュー

`/ai` でAI生成のメッセージ草案を承認・送信。

- 優先度順に表示
- 理由と文面をプレビュー
- 承認後、`sendMessage` Function を呼び出して送信

## ビルド

```bash
npm run build
```

`.next/` ディレクトリにビルド成果物が生成されます。

## デプロイ

Vercel へのデプロイ手順は `docs/DEPLOY.md` を参照してください。

## テスト

```bash
npm run test
```

## トラブルシューティング

### Firebase 接続エラー

- 環境変数が正しく設定されているか確認
- Firebase Console で Web アプリが追加されているか確認

### ログイン後にリダイレクトしない

- Custom Claims が設定されているか確認
- ブラウザのコンソールログを確認

### ダッシュボードにデータが表示されない

- シードスクリプトが実行されているか確認
- Firestore に `metrics/forecasts/insights` データがあるか確認

## 動作確認チェックリスト

- [ ] `/login` でログインできる
- [ ] テナント未作成時に `/onboarding` に遷移する
- [ ] テナント作成後に `/dashboard` に遷移する
- [ ] ダッシュボードにKPI・予測・インサイトが表示される
- [ ] カレンダーで予約を作成できる
- [ ] 顧客管理で顧客情報を閲覧・編集できる
- [ ] AI提案を承認・送信できる
- [ ] ログアウトできる

---

詳細な実装は各ファイルのコメントを参照してください。
