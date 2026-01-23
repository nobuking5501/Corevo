/**
 * PDCAダッシュボードシート構築
 */
function buildPDCADashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.PDCA_DASHBOARD);

  // タイトル
  sheet.getRange('A1').setValue('【PDCA管理ダッシュボード】');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // ========== 今週の要注意KPI ==========
  sheet.getRange('A3').setValue('⚠️ 今週の要注意KPI');
  sheet.getRange('A3').setFontWeight('bold').setFontSize(12).setBackground('#FFCDD2');
  sheet.getRange('A3:E3').merge();

  const alertHeaders = ['KPI', '実績', '目標', '達成率', 'ステータス'];
  sheet.getRange(4, 1, 1, 5).setValues([alertHeaders]);
  formatHeaderRow_(sheet, 'A4:E4', COLORS.PDCA_DASHBOARD);

  const alerts = [
    ['利益率', '=ダッシュボード!B6', '20%', '=IFERROR(B5/0.20,"")', '=IF(D5>=1,"✓達成","⚠未達成")'],
    ['継続率', '=顧客!L101', '85%', '=IFERROR(B6/0.85,"")', '=IF(D6>=1,"✓達成","⚠未達成")'],
    ['新規来店数', '=ダッシュボード!B7', '20名', '=IFERROR(B7/20,"")', '=IF(D7>=1,"✓達成","⚠未達成")'],
    ['CPA', '=広告!G101', '15,000円', '=IFERROR(15000/B8,"")', '=IF(D8>=1,"✓達成","⚠超過")'],
    ['広告費率', '=経費!L101', '15%', '=IFERROR(0.15/B9,"")', '=IF(D9>=1,"✓達成","⚠超過")']
  ];
  sheet.getRange(5, 1, alerts.length, 5).setValues(alerts);

  setPercentFormat_(sheet, 'B5:B5');
  setPercentFormat_(sheet, 'B6:B6');
  setCurrencyFormat_(sheet, 'B8:B8');
  setPercentFormat_(sheet, 'B9:B9');
  setPercentFormat_(sheet, 'D5:D9');

  // ========== 今月の重点施策 ==========
  sheet.getRange('A11').setValue('🎯 今月の重点施策');
  sheet.getRange('A11').setFontWeight('bold').setFontSize(12).setBackground('#C5E1A5');
  sheet.getRange('A11:G11').merge();

  const actionHeaders = ['施策名', '目的KPI', '担当', '期限', '進捗', '効果測定日', 'メモ'];
  sheet.getRange(12, 1, 1, 7).setValues([actionHeaders]);
  formatHeaderRow_(sheet, 'A12:G12', COLORS.PDCA_DASHBOARD);

  // 施策入力欄（10件分）
  for (let row = 13; row <= 22; row++) {
    // 進捗は選択式
    const cell = sheet.getRange(row, 5);
    cell.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['未着手', '実行中', '完了', '効果測定中', '停止'], true)
      .build());
  }

  // ========== 先月の成果 ==========
  sheet.getRange('A24').setValue('✅ 先月の成果');
  sheet.getRange('A24').setFontWeight('bold').setFontSize(12).setBackground('#B3E5FC');
  sheet.getRange('A24:F24').merge();

  const resultHeaders = ['施策名', 'KPI', '実施前', '実施後', '改善効果', '評価'];
  sheet.getRange(25, 1, 1, 6).setValues([resultHeaders]);
  formatHeaderRow_(sheet, 'A25:F25', COLORS.PDCA_DASHBOARD);

  // 成果入力欄（5件分）
  const resultExamples = [
    ['材料費削減施策', '材料費', '15万円', '10万円', '▲5万円', '◎成功'],
    ['CPA改善施策', 'CPA', '18,000円', '13,000円', '▲5,000円', '◎成功'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', '']
  ];
  sheet.getRange(26, 1, resultExamples.length, 6).setValues(resultExamples);

  // ========== 週次レビューチェックリスト ==========
  sheet.getRange('I3').setValue('📅 週次レビューチェックリスト');
  sheet.getRange('I3').setFontWeight('bold').setFontSize(12).setBackground('#FFF9C4');
  sheet.getRange('I3:K3').merge();

  const weeklyChecks = [
    ['□', 'KPI実績確認', ''],
    ['□', '進行中施策の進捗確認', ''],
    ['□', '要注意KPIの原因分析', ''],
    ['□', '次週アクション決定', ''],
    ['□', 'スタッフへの共有', '']
  ];
  sheet.getRange(4, 9, weeklyChecks.length, 3).setValues(weeklyChecks);

  // ========== 月次レビューチェックリスト ==========
  sheet.getRange('I10').setValue('📅 月次レビューチェックリスト');
  sheet.getRange('I10').setFontWeight('bold').setFontSize(12).setBackground('#FFF9C4');
  sheet.getRange('I10:K10').merge();

  const monthlyChecks = [
    ['□', '全KPI達成状況確認', ''],
    ['□', '施策効果測定', ''],
    ['□', '成功施策の横展開検討', ''],
    ['□', '失敗施策の原因分析', ''],
    ['□', '次月目標・施策設定', ''],
    ['□', 'スタッフ評価・フィードバック', '']
  ];
  sheet.getRange(11, 9, monthlyChecks.length, 3).setValues(monthlyChecks);

  // ========== PDCAサイクル ==========
  sheet.getRange('I18').setValue('🔄 PDCA運用ガイド');
  sheet.getRange('I18').setFontWeight('bold').setFontSize(12).setBackground('#B2DFDB');
  sheet.getRange('I18:K18').merge();

  const pdcaGuide = [
    ['Plan（計画）', '→', '月初に重点施策を設定'],
    ['Do（実行）', '→', '担当者を決めて実行'],
    ['Check（評価）', '→', '週次で進捗・月次で効果測定'],
    ['Action（改善）', '→', '成功は横展開・失敗は修正']
  ];
  sheet.getRange(19, 9, pdcaGuide.length, 3).setValues(pdcaGuide);

  // 列幅調整
  sheet.setColumnWidth(1, 200);  // 施策名/KPI
  sheet.setColumnWidth(2, 100);  // 実績/目的KPI
  sheet.setColumnWidth(3, 100);  // 目標/担当
  sheet.setColumnWidth(4, 100);  // 達成率/期限
  sheet.setColumnWidth(5, 100);  // ステータス/進捗
  sheet.setColumnWidth(6, 100);  // 効果測定日
  sheet.setColumnWidth(7, 150);  // メモ
  sheet.setColumnWidth(9, 30);   // チェックボックス
  sheet.setColumnWidth(10, 200); // 項目
  sheet.setColumnWidth(11, 150); // メモ

  console.log('PDCA Dashboard sheet built successfully');
}
