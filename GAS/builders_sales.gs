/**
 * 売上シート構築
 */
function buildSalesSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.SALES);

  // ヘッダー設定
  const headers = [
    '日付', '顧客名', '区分', 'メニュー名', 'コース単価',
    '回数', '売上金額', '支払方法', '担当スタッフ', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:J1', COLORS.SALES);

  // データ検証：区分（C列）
  setValidationListForRows_(sheet, 3, 2, 100, VALIDATION_VALUES.CUSTOMER_TYPE);

  // データ検証：支払方法（H列）
  setValidationListForRows_(sheet, 8, 2, 100, VALIDATION_VALUES.PAYMENT_METHOD);

  // 集計行設定（101行目）
  const summaryRow = SUMMARY_ROW;
  sheet.getRange(summaryRow, 1).setValue('【集計】');
  sheet.getRange(summaryRow, 7).setFormula('=SUM(G2:G100)');
  sheet.getRange(summaryRow, 8).setFormula('=AVERAGE(G2:G100)');
  sheet.getRange(summaryRow, 9).setFormula('=COUNTIF(D2:D100,"*コース*")/COUNTA(D2:D100)');
  sheet.getRange(summaryRow, 10).setFormula('=COUNTIF(C2:C100,"新規")/COUNTA(C2:C100)');

  // ラベル追加
  sheet.getRange(summaryRow - 1, 7).setValue('月間総売上');
  sheet.getRange(summaryRow - 1, 8).setValue('平均客単価');
  sheet.getRange(summaryRow - 1, 9).setValue('コース比率');
  sheet.getRange(summaryRow - 1, 10).setValue('新規売上比率');

  // 書式設定
  setDateFormat_(sheet, 'A2:A100');
  setCurrencyFormat_(sheet, 'E2:E100');
  setCurrencyFormat_(sheet, 'G2:G100');
  setCurrencyFormat_(sheet, `G${summaryRow}:H${summaryRow}`);
  setPercentFormat_(sheet, `I${summaryRow}:J${summaryRow}`);

  formatSummaryRow_(sheet, summaryRow, 1, 10);

  // 範囲保護
  protectRange_(sheet, `G${summaryRow}:J${summaryRow}`, '売上集計セル');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 10);
  sheet.setColumnWidth(1, 100);  // 日付
  sheet.setColumnWidth(2, 120);  // 顧客名
  sheet.setColumnWidth(3, 80);   // 区分
  sheet.setColumnWidth(4, 150);  // メニュー名
  sheet.setColumnWidth(7, 100);  // 売上金額
  sheet.setColumnWidth(8, 100);  // 支払方法
  sheet.setColumnWidth(9, 120);  // 担当スタッフ
  sheet.setColumnWidth(10, 150); // 備考

  console.log('Sales sheet built successfully');
}
