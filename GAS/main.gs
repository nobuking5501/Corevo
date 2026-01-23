/**
 * スプレッドシート起動時にカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 業績テンプレ')
    .addItem('🏗️ 初期構築（全シート生成）', 'menuInitAll')
    .addItem('📝 ダミーデータ投入', 'menuSeedAll')
    .addSeparator()
    .addItem('🔄 ダッシュボード再計算', 'menuRecalcDashboard')
    .addItem('📊 週次レポート生成', 'menuGenerateWeeklyReport')
    .addItem('⚠️ KPIアラートチェック', 'menuCheckKPIAlerts')
    .addToUi();
}

/**
 * エントリポイント：ホームカード表示
 */
function onHomepage(e) {
  try {
    return createHomeCard_();
  } catch (error) {
    console.error('onHomepage error:', error);
    return createErrorCard_(error.message);
  }
}

/**
 * ファイルスコープ権限付与後
 */
function onFileScopeGranted(e) {
  try {
    return createHomeCard_();
  } catch (error) {
    console.error('onFileScopeGranted error:', error);
    return createErrorCard_(error.message);
  }
}

/**
 * ホームカード生成
 */
function createHomeCard_() {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('📊 脱毛サロン業績テンプレ')
      .setSubtitle('初期構築・データ管理'))
    .addSection(CardService.newCardSection()
      .setHeader('初期セットアップ')
      .addWidget(CardService.newTextParagraph()
        .setText('スプレッドシートに業績管理シートを作成します。'))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('🏗️ 初期構築（全シート生成）')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('handleInitAll'))))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('📝 ダミーデータ投入')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('handleSeedAll'))))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('🔄 ダッシュボード再計算')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('handleRecalcDashboard')))))
    .addSection(CardService.newCardSection()
      .setHeader('使い方')
      .addWidget(CardService.newTextParagraph()
        .setText('1️⃣ 初期構築でシート作成\n2️⃣ ダミーデータで動作確認\n3️⃣ 必要に応じて再計算')));

  return card.build();
}

/**
 * エラーカード生成
 */
function createErrorCard_(message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('⚠️ エラー'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('エラーが発生しました：\n' + message)))
    .build();
}

/**
 * ハンドラ：初期構築
 */
function handleInitAll(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 基本シート
    buildDashboardSheet_(ss);
    buildSalesSheet_(ss);
    buildAdsSheet_(ss);
    buildCustomersSheet_(ss);
    buildExpensesSheet_(ss);
    buildProfitSheet_(ss);
    buildStaffSheet_(ss);
    buildActionsSheet_(ss);

    // 分析シート
    buildSalesAnalysisSheet_(ss);
    buildCustomerAnalysisSheet_(ss);
    buildPDCADashboardSheet_(ss);

    // 使い方
    buildReadmeSheet_(ss);

    const notification = CardService.newNotification()
      .setText('✅ 初期構築が完了しました！全12シートが生成されました。「使い方」シートを確認してください。');

    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();

  } catch (error) {
    console.error('handleInitAll error:', error);
    const notification = CardService.newNotification()
      .setText('❌ エラー: ' + error.message);
    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();
  }
}

/**
 * ハンドラ：ダミーデータ投入
 */
function handleSeedAll(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    seedAllData_(ss);

    const notification = CardService.newNotification()
      .setText('✅ ダミーデータの投入が完了しました！');

    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();

  } catch (error) {
    console.error('handleSeedAll error:', error);
    const notification = CardService.newNotification()
      .setText('❌ エラー: ' + error.message);
    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();
  }
}

/**
 * ハンドラ：ダッシュボード再計算
 */
function handleRecalcDashboard(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    recalculateDashboard_(ss);

    const notification = CardService.newNotification()
      .setText('✅ ダッシュボードの再計算が完了しました！');

    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();

  } catch (error) {
    console.error('handleRecalcDashboard error:', error);
    const notification = CardService.newNotification()
      .setText('❌ エラー: ' + error.message);
    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();
  }
}

/**
 * メニュー：初期構築
 */
function menuInitAll() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 基本シート
    buildDashboardSheet_(ss);
    buildSalesSheet_(ss);
    buildAdsSheet_(ss);
    buildCustomersSheet_(ss);
    buildExpensesSheet_(ss);
    buildProfitSheet_(ss);
    buildStaffSheet_(ss);
    buildActionsSheet_(ss);

    // 分析シート
    buildSalesAnalysisSheet_(ss);
    buildCustomerAnalysisSheet_(ss);
    buildPDCADashboardSheet_(ss);

    // 使い方
    buildReadmeSheet_(ss);

    SpreadsheetApp.getUi().alert('✅ 初期構築が完了しました！\n\n全12シートが生成されました。\n\n・基本シート（8）\n・分析シート（3）\n・使い方（1）\n\n「使い方」シートを確認してください。');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + error.message);
  }
}

/**
 * メニュー：ダミーデータ投入
 */
function menuSeedAll() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    seedAllData_(ss);
    SpreadsheetApp.getUi().alert('✅ ダミーデータの投入が完了しました！');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + error.message);
  }
}

/**
 * メニュー：ダッシュボード再計算
 */
function menuRecalcDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    recalculateDashboard_(ss);
    SpreadsheetApp.getUi().alert('✅ ダッシュボードの再計算が完了しました！');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + error.message);
  }
}

/**
 * メニュー：週次レポート生成
 */
function menuGenerateWeeklyReport() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    generateWeeklyReport_(ss);
    SpreadsheetApp.getUi().alert('✅ 週次レポートが生成されました！\n\nPDCA管理シートを確認してください。');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + error.message);
  }
}

/**
 * メニュー：KPIアラートチェック
 */
function menuCheckKPIAlerts() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const alerts = checkKPIAlerts_(ss);

    if (alerts.length === 0) {
      SpreadsheetApp.getUi().alert('✅ 全てのKPIが目標を達成しています！');
      return;
    }

    let message = '⚠️ 以下のKPIが目標を下回っています：\n\n';
    alerts.forEach(alert => {
      message += `・${alert.message}\n`;
    });
    message += '\nPDCA管理シートで改善施策を確認してください。';

    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + error.message);
  }
}
