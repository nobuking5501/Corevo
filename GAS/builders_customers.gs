/**
 * 顧客シート構築
 */
function buildCustomersSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.CUSTOMERS);

  // ヘッダー設定
  const headers = [
    '顧客名', '登録日', '契約コース', '通過回数', 'ステータス',
    '次回予約日', '継続', '解約理由', '指名スタッフ', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:J1', COLORS.CUSTOMERS);

  // データ検証：ステータス（E列）
  setValidationListForRows_(sheet, 5, 2, 100, VALIDATION_VALUES.STATUS);

  // データ検証：継続（G列）
  setValidationListForRows_(sheet, 7, 2, 100, VALIDATION_VALUES.CONTINUATION);

  // 集計行設定（101行目）
  const summaryRow = SUMMARY_ROW;
  sheet.getRange(summaryRow, 1).setValue('【集計】');
  sheet.getRange(summaryRow, 11).setFormula('=COUNTIF(F2:F100,"<>")/COUNTA(F2:F100)'); // K列：次回予約率
  sheet.getRange(summaryRow, 12).setFormula('=COUNTIF(G2:G100,"○")/COUNTA(G2:G100)'); // L列：継続率
  sheet.getRange(summaryRow, 13).setFormula('=COUNTIF(H2:H100,"<>")/COUNTA(G2:G100)'); // M列：解約率

  // ラベル追加
  sheet.getRange(summaryRow - 1, 11).setValue('次回予約率');
  sheet.getRange(summaryRow - 1, 12).setValue('継続率');
  sheet.getRange(summaryRow - 1, 13).setValue('解約率');

  // 書式設定
  setDateFormat_(sheet, 'B2:B100');
  setDateFormat_(sheet, 'F2:F100');
  setPercentFormat_(sheet, `K${summaryRow}:M${summaryRow}`);

  formatSummaryRow_(sheet, summaryRow, 1, 13);

  // 範囲保護
  protectRange_(sheet, `K${summaryRow}:M${summaryRow}`, '顧客集計セル');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 10);
  sheet.setColumnWidth(1, 120);  // 顧客名
  sheet.setColumnWidth(2, 100);  // 登録日
  sheet.setColumnWidth(3, 150);  // 契約コース
  sheet.setColumnWidth(4, 80);   // 通過回数
  sheet.setColumnWidth(5, 100);  // ステータス
  sheet.setColumnWidth(6, 100);  // 次回予約日
  sheet.setColumnWidth(7, 60);   // 継続
  sheet.setColumnWidth(8, 150);  // 解約理由
  sheet.setColumnWidth(9, 120);  // 指名スタッフ
  sheet.setColumnWidth(10, 150); // 備考

  console.log('Customers sheet built successfully');
}
