# Google Apps Script (GAS) System

このディレクトリは、Google Spreadsheet ベースのサロン管理システムを構築するための Google Apps Script ファイル群です。

## 📋 システム概要

**目的**: Google Spreadsheet 上で動作する、サロン経営管理ツール

**特徴**:
- スプレッドシートで完結する管理システム
- 自動データ分析・レポート生成
- Firebase システムとの関係：並行運用 or レガシーシステム（詳細不明）

## 📁 ファイル構成（19ファイル）

### エントリーポイント

- **`main.gs`** - メインエントリーポイント、メニュー設定、初期化処理

### 設定・定数

- **`constants.gs`** - 定数定義（シート名、カラー設定等）

### データ生成

- **`seed_sampleData.gs`** - サンプルデータ生成（テスト・デモ用）

### シートビルダー（画面構築）

#### ダッシュボード系
- **`builders_dashboard.gs`** - メインダッシュボード構築
- **`builders_pdca_dashboard.gs`** - PDCAサイクル管理ダッシュボード

#### データ入力・管理系
- **`builders_sales.gs`** - 売上データ入力シート
- **`builders_expenses.gs`** - 経費データ入力シート
- **`builders_ads.gs`** - 広告データ入力シート
- **`builders_customers.gs`** - 顧客管理シート
- **`builders_staff.gs`** - スタッフ管理シート
- **`builders_actions.gs`** - 改善アクション管理シート

#### 分析系
- **`builders_sales_analysis.gs`** - 売上分析レポート
- **`builders_customer_analysis.gs`** - 顧客分析レポート
- **`builders_profit.gs`** - 利益計算・分析シート

#### その他
- **`builders_readme.gs`** - README シート自動生成

### ユーティリティ

- **`utils_sheets.gs`** - シート操作共通関数
- **`utils_formatting.gs`** - フォーマット・スタイル設定
- **`utils_validation.gs`** - データバリデーション
- **`utils_reports.gs`** - レポート生成共通関数

## 🔄 Firebase システムとの関係

### 推測される関係性

1. **並行運用シナリオ**
   - GAS: Google Spreadsheet での簡易管理
   - Firebase: 本格的なWebアプリ

2. **レガシーシステムシナリオ**
   - GAS: 過去のシステム（移行済み or 移行中）
   - Firebase: 新システム

3. **データエクスポートシナリオ**
   - GAS: Firebase データのエクスポート・分析ツール

### ⚠️ 現状の懸念点

- **データ同期**: GAS と Firebase のデータ同期方法が不明
- **更新頻度**: どちらが最新データを保持しているか不明
- **移行計画**: Firebase への完全移行予定の有無が不明

## 🚀 使用方法（推測）

### 1. スプレッドシート準備

```javascript
// main.gs を開いて実行
function onOpen() {
  // メニューに「Corevo」が追加される
}

function setupAllSheets() {
  // すべてのシートを自動生成
}
```

### 2. サンプルデータ生成

```javascript
// seed_sampleData.gs
function generateSampleData() {
  // テスト用データを自動生成
}
```

### 3. 各シートの更新

- 売上シート: 日々の売上入力
- 経費シート: 月次経費入力
- 広告シート: 広告費・効果入力

→ ダッシュボードが自動更新

## 📊 機能一覧

### データ入力機能

| シート | 機能 |
|--------|------|
| 売上 | 日次売上データ入力 |
| 経費 | 月次経費データ入力 |
| 広告 | 広告費・コンバージョン入力 |
| 顧客 | 顧客情報管理 |
| スタッフ | スタッフ情報管理 |
| アクション | 改善施策管理 |

### 分析・レポート機能

| 機能 | 詳細 |
|------|------|
| 売上分析 | コース別・スタッフ別集計 |
| 顧客分析 | 継続率・LTV分析 |
| 利益分析 | 売上-経費=利益計算 |
| PDCA管理 | 改善サイクル管理 |

### ダッシュボード機能

- KPI表示（売上、利益率、顧客数等）
- グラフ自動生成
- 月次比較
- 目標達成率表示

## 🔧 技術詳細

### 使用しているGAS機能

- **SpreadsheetApp**: シート操作
- **Charts**: グラフ生成
- **DataValidation**: 入力制限
- **ConditionalFormat**: 条件付き書式
- **Custom Menus**: カスタムメニュー

### コーディング規約

```javascript
// 関数名: camelCase
function buildDashboard() {}

// 定数: UPPER_SNAKE_CASE
const SHEET_NAME_DASHBOARD = 'ダッシュボード';

// シート操作共通関数を活用
const sheet = getOrCreateSheet(SHEET_NAME_DASHBOARD);
```

## 📝 今後のアクション

### 優先度：高

1. **GASシステムの現状確認**
   - 実際に使用されているか？
   - 最終更新日は？
   - Firebase との連携方法は？

2. **移行方針の決定**
   - Firebase へ完全移行するか？
   - 並行運用を続けるか？
   - GAS を廃止するか？

### 優先度：中

3. **データ同期の確立**
   - GAS → Firebase のデータ移行ツール作成
   - Firebase → GAS のエクスポート機能

4. **ドキュメント整備**
   - 各シートの使用方法マニュアル
   - データ入力ガイド

## ❓ FAQ

### Q1: GAS システムはまだ使っていますか？

→ **不明**。実際の使用状況を確認する必要があります。

### Q2: Firebase と GAS はデータを共有していますか？

→ **不明**。同期メカニズムが実装されているかどうか確認が必要です。

### Q3: GAS を削除しても良いですか？

→ **慎重に判断**してください。以下を確認：
- 現在の使用状況
- Firebase に未実装の機能の有無
- データのバックアップ

## 🔗 関連ドキュメント

- [Firebase System Documentation](/backend/functions/README.md)
- [Project Concept](/core/00_concept.md)
- [Data Model](/docs/DATA_MODEL.md)

---

**最終更新**: 2026-01-23
**ステータス**: 調査必要（使用状況不明）
