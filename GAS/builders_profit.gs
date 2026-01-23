/**
 * 利益シート構築
 */
function buildProfitSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.PROFIT);

  // ヘッダー設定
  const headers = [
    '月', '売上合計', '経費合計', '営業利益', '利益率',
    '口座残高', '入金予定', '出金予定', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:I1', COLORS.PROFIT);

  // 自動計算式設定（2〜6行は月ごと、7行目以降は全体合計）
  // 月ごとの売上・経費・利益を計算（グラフ表示用に5ヶ月分を設定）
  const monthlyData = [
    { salesMultiplier: 1.0 },   // 2025/01（現在月）
    { salesMultiplier: 0.95 },  // 2024/12
    { salesMultiplier: 0.92 },  // 2024/11
    { salesMultiplier: 0.90 },  // 2024/10
    { salesMultiplier: 0.88 }   // 2024/09
  ];

  for (let i = 0; i < monthlyData.length; i++) {
    const row = 2 + i;
    sheet.getRange(row, 1).setFormula(`=経費!A${row}`); // 月
    sheet.getRange(row, 2).setFormula(`=売上!G101*${monthlyData[i].salesMultiplier}`); // 月ごと売上
    sheet.getRange(row, 3).setFormula(`=経費!I${row}`); // 経費（月ごと）
    sheet.getRange(row, 4).setFormula(`=B${row}-C${row}`); // 営業利益
    sheet.getRange(row, 5).setFormula(`=IFERROR(D${row}/B${row},"")`); // 利益率
  }

  // 7行目以降は空行または追加データ用
  for (let row = 7; row <= 100; row++) {
    sheet.getRange(row, 1).setFormula(`=IF(経費!A${row}<>"",経費!A${row},"")`);
    sheet.getRange(row, 2).setFormula(`=IF(A${row}<>"",売上!G101,"")`);
    sheet.getRange(row, 3).setFormula(`=IF(経費!I${row}<>"",経費!I${row},"")`);
    sheet.getRange(row, 4).setFormula(`=IF(B${row}<>"",B${row}-C${row},"")`);
    sheet.getRange(row, 5).setFormula(`=IFERROR(IF(D${row}<>"",D${row}/B${row},""),"")`);
  }

  // 書式設定
  setCurrencyFormat_(sheet, 'B2:D100');
  setPercentFormat_(sheet, 'E2:E100');
  setCurrencyFormat_(sheet, 'F2:H100');

  // 範囲保護
  protectRange_(sheet, 'B2:E100', '利益自動計算');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 9);
  sheet.setColumnWidth(1, 80);   // 月
  sheet.setColumnWidth(2, 120);  // 売上合計
  sheet.setColumnWidth(3, 120);  // 経費合計
  sheet.setColumnWidth(4, 120);  // 営業利益
  sheet.setColumnWidth(5, 80);   // 利益率
  sheet.setColumnWidth(6, 120);  // 口座残高
  sheet.setColumnWidth(7, 120);  // 入金予定
  sheet.setColumnWidth(8, 120);  // 出金予定
  sheet.setColumnWidth(9, 150);  // 備考

  // グラフ生成
  clearCharts_(sheet);

  // 口座残高推移（折れ線）- 右上に配置
  try {
    createLineChart_(
      sheet,
      '口座残高推移',
      'A2:F100',
      '月',
      '口座残高',
      { row: 2, col: 11, offsetX: 0, offsetY: 0 }
    );
  } catch (error) {
    console.warn('口座残高グラフ生成エラー:', error.message);
  }

  // 利益率推移（棒グラフ）- 右下に配置
  try {
    createColumnChart_(
      sheet,
      '利益率推移',
      'A2:E100',
      { row: 22, col: 11, offsetX: 0, offsetY: 0 },
      false
    );
  } catch (error) {
    console.warn('利益率グラフ生成エラー:', error.message);
  }

  console.log('Profit sheet built successfully');
}
