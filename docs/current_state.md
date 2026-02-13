# current_state.md

## 現状の事実

### リポジトリ状態
- git tag `legacy-baseline` でベースラインを確定済み
- コミットハッシュ: 27c257a4f69fe3c509afb3eb3b29b477d3e7a570
- ブランチ: master
- 総ファイル数: 251
- 総行数: 53,468行

### ディレクトリ構成
- `/GAS` - Google Apps Script関連
- `/ai` - AI関連（insight, prompt）
- `/apps/web` - Next.jsフロントエンドアプリケーション
- `/backend/functions` - Firebase Functions（TypeScript）
- `/docs` - ドキュメント類
- `/infra/scripts` - インフラ管理スクリプト

### 技術スタック
- フロントエンド: Next.js, React, TypeScript
- バックエンド: Firebase Functions, Node.js
- データベース: Firestore
- 認証: Firebase Authentication
- ストレージ: Firebase Storage
- 外部連携: LINE, Google Calendar

### 主要機能（ファイル構成から確認）
- マルチテナント管理
- 顧客管理
- 予約・アポイントメント管理
- カレンダー連携（Google Calendar）
- LINE連携（Webhook, メッセージ送信）
- 売上・経費管理
- KPI管理
- AI機能（インサイト、予測、NBA）
- ダッシュボード・分析
- 顧客ポータル
- LIFF（LINE Front-end Framework）対応

### 設定ファイル
- `firebase.json` - Firebase設定
- `firestore.rules`, `firestore.rules.dev`, `firestore.rules.production` - Firestoreセキュリティルール
- `storage.rules` - Storageセキュリティルール
- `firestore.indexes.json` - Firestoreインデックス定義
- `.env.example` - 環境変数テンプレート

### スクリプト類
- テストユーザー作成
- データシード
- マルチテナントセットアップ
- エミュレータ関連
- Firebase設定取得

### ドキュメント
- `README.md`
- `QUICKSTART.md`
- `SETUP_INSTRUCTIONS.md`
- `docs/DATA_MODEL.md`
- `docs/DEPLOY.md`
- `docs/LINE_LIFF_SETUP.md`
- `docs/SALES_MANAGEMENT_DESIGN.md`
