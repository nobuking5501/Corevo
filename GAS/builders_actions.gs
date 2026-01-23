/**
 * 改善アクションシート構築
 */
function buildActionsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.ACTIONS);

  // ヘッダー設定
  const headers = [
    '月', '指標', '数値', '課題', '改善施策',
    '担当者', '実施日', '効果コメント'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:H1', COLORS.ACTIONS);

  // 書式設定
  setDateFormat_(sheet, 'G2:G100');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 8);
  sheet.setColumnWidth(4, 200); // 課題列を広く
  sheet.setColumnWidth(5, 200); // 改善施策列を広く
  sheet.setColumnWidth(8, 200); // 効果コメント列を広く

  console.log('Actions sheet built successfully');
}
