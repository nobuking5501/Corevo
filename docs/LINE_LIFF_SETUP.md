# LINE LIFF 顧客ポータル セットアップガイド

このドキュメントでは、LINE LIFF（LINE Front-end Framework）を使った顧客ポータル機能のセットアップ方法を説明します。

## 概要

顧客がLINE上で以下の機能を利用できます：
- **予約管理**: 自分の予約を確認・キャンセル
- **カルテ確認**: 施術履歴と次回推奨日の確認

## 前提条件

- LINE公式アカウント（Business / Premium）
- LINE Developers アカウント
- Corevoのデプロイ済み環境（本番URLが必要）

## セットアップ手順

### 1. LINE Developersでチャネルを作成

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダーを選択または新規作成
3. 「新規チャネルを作成」→「LINEログイン」を選択
4. 以下を入力：
   - チャネル名: 例「Corevo 顧客ポータル」
   - チャネル説明: 例「顧客向け予約・カルテ確認機能」
   - アプリタイプ: 「ウェブアプリ」

### 2. LIFF アプリを作成

1. 作成したチャネルの「LIFF」タブを選択
2. 「追加」ボタンをクリック
3. 以下を設定：

#### メインページ（マイページ）
- **LIFFアプリ名**: `顧客マイページ`
- **サイズ**: `Full`
- **エンドポイントURL**: `https://your-domain.com/customer-portal`
- **Scope**: `profile`, `openid`
- **ボットリンク機能**: `On (Aggressive)`

作成後、**LIFF ID**（`1234567890-abcdefgh`形式）をメモしてください。

### 3. 環境変数を設定

#### フロントエンド（apps/web/.env.local）

```env
# LIFF設定
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh

# テナントID（店舗ID）
NEXT_PUBLIC_TENANT_ID=your_tenant_id
```

#### バックエンド（backend/functions/.env）

LINE Messaging API の設定は既存の `.env` に追加済みの場合は不要です。
未設定の場合は以下を追加：

```env
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret
```

### 4. Firestoreにテナント設定を追加

各テナント（店舗）のドキュメントに LINE 設定を追加：

```javascript
// Firestore: /tenants/{tenantId}
{
  // ... 既存フィールド
  settings: {
    line: {
      channelAccessToken: "your_channel_access_token",
      channelSecret: "your_channel_secret",
      isEnabled: true
    }
  }
}
```

### 5. LINEリッチメニューを設定

顧客がLINEのトーク画面下部からアクセスできるようにリッチメニューを設定します。

#### リッチメニューの作成手順

1. LINE Official Account Manager にアクセス
2. 該当のアカウントを選択
3. 「ホーム」→「トークルーム管理」→「リッチメニュー」
4. 「作成」をクリック

#### 推奨設定

**タイトル**: `マイページ`
**表示期間**: 常時表示
**メニューバーのテキスト**: `メニュー`
**テンプレート**: 「大」を選択（2つのボタン）

#### ボタン設定

**左側ボタン**:
- **アクション**: リンク
- **ラベル**: 予約確認
- **リンクタイプ**: LIFF
- **URL**: `https://liff.line.me/1234567890-abcdefgh/appointments`
  （`1234567890-abcdefgh`は手順2で取得したLIFF ID）

**右側ボタン**:
- **アクション**: リンク
- **ラベル**: カルテ
- **リンクタイプ**: LIFF
- **URL**: `https://liff.line.me/1234567890-abcdefgh/charts`

### 6. Webhook URLを設定

LINE Messaging APIのWebhook URLを設定：

1. LINE Developers Console でMessaging API チャネルを開く
2. 「Messaging API設定」タブを選択
3. **Webhook URL**: `https://your-region-your-project.cloudfunctions.net/lineWebhook`
4. 「Webhookの利用」を **ON** に設定
5. 「検証」ボタンで接続確認

### 7. デプロイと動作確認

#### バックエンドのデプロイ

```bash
cd backend/functions
npm run deploy
```

以下のCloud Functionsがデプロイされます：
- `lineWebhook` - LINEからのイベント受信
- `getCustomerByLineUserId` - LINE UserIDから顧客情報取得
- `getCustomerAppointments` - 顧客の予約一覧取得
- `getCustomerCharts` - 顧客のカルテ一覧取得
- `cancelCustomerAppointment` - 予約キャンセル

#### フロントエンドのデプロイ

```bash
cd apps/web
npm run build
# Vercel / Cloudflare Pages / Firebase Hosting等にデプロイ
```

#### 動作確認

1. LINE公式アカウントを友だち追加
2. トーク画面下部のリッチメニューが表示されることを確認
3. 「予約確認」ボタンをタップ
4. LIFF画面が開き、予約一覧が表示されることを確認
5. 「カルテ」ボタンをタップ
6. カルテ履歴が表示されることを確認

## トラブルシューティング

### LIFF初期化エラー

**エラー**: `LIFF initialization failed`

**原因**:
- LIFF IDが正しく設定されていない
- エンドポイントURLが間違っている

**解決方法**:
1. `.env.local` の `NEXT_PUBLIC_LIFF_ID` を確認
2. LINE Developers Console でエンドポイントURLを確認

### 顧客情報が見つからない

**エラー**: `顧客情報が見つかりませんでした`

**原因**:
- 顧客データに `lineUserId` が登録されていない

**解決方法**:
1. LINE公式アカウントをブロックして再度友だち追加
2. `lineWebhook` の `handleFollowEvent` が正しく動作しているか確認
3. Firestoreで該当の顧客ドキュメントに `lineUserId` フィールドがあるか確認

### 予約・カルテが表示されない

**原因**:
- テナントIDが正しく設定されていない
- 該当顧客に予約/カルテデータがない

**解決方法**:
1. `.env.local` の `NEXT_PUBLIC_TENANT_ID` を確認
2. Firestoreで該当顧客の予約/カルテデータを確認

## セキュリティに関する注意事項

1. **LIFF ID は公開情報**: `.env.local` の `NEXT_PUBLIC_` 変数は公開されますが、LIFF IDは公開されても問題ありません
2. **認証**: LIFFは LINE Login により自動的に認証されます
3. **テナント分離**: Cloud Functions側で必ず `tenantId` を検証してください
4. **データアクセス制御**: 顧客は自分のLINE User IDに紐づくデータのみアクセス可能

## 参考リンク

- [LINE Developers Documentation](https://developers.line.biz/ja/docs/)
- [LIFF Documentation](https://developers.line.biz/ja/docs/liff/overview/)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [リッチメニューの作成方法](https://www.linebiz.com/jp/manual/OfficialAccountManager/rich-menus/)

## サポート

問題が発生した場合は、プロジェクトのIssueを作成してください。
