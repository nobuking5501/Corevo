/**
 * 広告シート構築
 */
function buildAdsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.ADS);

  // ヘッダー設定
  const headers = [
    '月', '媒体', '広告費', '新規予約数', '成約数',
    '成約率', 'CPA', 'LTV', 'ROI', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:J1', COLORS.ADS);

  // 自動計算式設定（2〜100行）
  for (let row = 2; row <= 100; row++) {
    sheet.getRange(row, 6).setFormula(`=IFERROR(E${row}/D${row},"")`); // 成約率
    sheet.getRange(row, 7).setFormula(`=IFERROR(C${row}/E${row},"")`); // CPA
    sheet.getRange(row, 9).setFormula(`=IF(AND(H${row}<>"",G${row}<>""),(H${row}-G${row})/G${row},"")`); // ROI
  }

  // 集計行設定（101行目）
  const summaryRow = SUMMARY_ROW;
  sheet.getRange(summaryRow, 1).setValue('【集計】');
  sheet.getRange(summaryRow, 3).setFormula('=SUM(C2:C100)');
  sheet.getRange(summaryRow, 7).setFormula('=AVERAGE(G2:G100)');
  sheet.getRange(summaryRow, 8).setFormula('=AVERAGE(H2:H100)');
  sheet.getRange(summaryRow, 9).setFormula('=AVERAGE(I2:I100)');

  // ラベル追加
  sheet.getRange(summaryRow - 1, 3).setValue('総広告費');
  sheet.getRange(summaryRow - 1, 7).setValue('平均CPA');
  sheet.getRange(summaryRow - 1, 8).setValue('平均LTV');
  sheet.getRange(summaryRow - 1, 9).setValue('平均ROI');

  // 書式設定
  setCurrencyFormat_(sheet, 'C2:C100');
  setPercentFormat_(sheet, 'F2:F100');
  setCurrencyFormat_(sheet, 'G2:H100');
  setPercentFormat_(sheet, 'I2:I100');
  setCurrencyFormat_(sheet, `C${summaryRow}`);
  setCurrencyFormat_(sheet, `G${summaryRow}:H${summaryRow}`);
  setPercentFormat_(sheet, `I${summaryRow}`);

  formatSummaryRow_(sheet, summaryRow, 1, 10);

  // 条件付き書式：ROI < 0 → 赤
  applyConditionalFormattingNegative_(sheet, 'I2:I100');

  // 範囲保護
  protectRange_(sheet, `F2:F100`, '広告自動計算');
  protectRange_(sheet, `G2:G100`, '広告自動計算');
  protectRange_(sheet, `I2:I100`, '広告自動計算');
  protectRange_(sheet, `C${summaryRow}:C${summaryRow}`, '広告集計');
  protectRange_(sheet, `G${summaryRow}:I${summaryRow}`, '広告集計');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 10);
  sheet.setColumnWidth(1, 80);   // 月
  sheet.setColumnWidth(2, 150);  // 媒体
  sheet.setColumnWidth(3, 100);  // 広告費
  sheet.setColumnWidth(4, 100);  // 新規予約数
  sheet.setColumnWidth(5, 80);   // 成約数
  sheet.setColumnWidth(6, 80);   // 成約率
  sheet.setColumnWidth(7, 100);  // CPA
  sheet.setColumnWidth(8, 100);  // LTV
  sheet.setColumnWidth(9, 80);   // ROI
  sheet.setColumnWidth(10, 150); // 備考

  // ========== 分析セクション（L列以降） ==========
  buildAdsAnalysisSection_(sheet);

  console.log('Ads sheet built successfully');
}

/**
 * 広告分析セクション構築（媒体別ランキング）
 */
function buildAdsAnalysisSection_(sheet) {
  const startCol = 12; // L列

  // タイトル
  sheet.getRange(1, startCol).setValue('【媒体別パフォーマンス分析】');
  sheet.getRange(1, startCol).setFontSize(12).setFontWeight('bold');
  sheet.getRange('L1:O1').merge();

  // ROIランキング
  sheet.getRange(3, startCol).setValue('ROIランキング（高い順）');
  sheet.getRange(3, startCol).setFontWeight('bold').setBackground('#FFF8E1');
  const roiHeaders = ['媒体', 'ROI', '判定'];
  sheet.getRange(4, startCol, 1, 3).setValues([roiHeaders]);
  formatHeaderRow_(sheet, `L4:N4`, COLORS.ADS);

  // ROIデータ（上位5件を手動集計式で）
  for (let i = 0; i < 5; i++) {
    const row = 5 + i;
    sheet.getRange(row, startCol).setValue(''); // 媒体名（手動入力）
    sheet.getRange(row, startCol + 1).setValue(''); // ROI（手動入力）
    sheet.getRange(row, startCol + 2).setFormula(
      `=IF(M${row}="","",IF(M${row}>3,"◎優秀",IF(M${row}>2,"○良好",IF(M${row}>0,"△要改善","×停止検討"))))`
    );
  }

  // CPAランキング
  sheet.getRange(11, startCol).setValue('CPAランキング（低い順）');
  sheet.getRange(11, startCol).setFontWeight('bold').setBackground('#FFF8E1');
  const cpaHeaders = ['媒体', 'CPA', '判定'];
  sheet.getRange(12, startCol, 1, 3).setValues([cpaHeaders]);
  formatHeaderRow_(sheet, `L12:N12`, COLORS.ADS);

  // CPAデータ
  for (let i = 0; i < 5; i++) {
    const row = 13 + i;
    sheet.getRange(row, startCol).setValue('');
    sheet.getRange(row, startCol + 1).setValue('');
    sheet.getRange(row, startCol + 2).setFormula(
      `=IF(M${row}="","",IF(M${row}<=15000,"◎目標達成",IF(M${row}<20000,"○許容範囲","×要改善")))`
    );
  }

  // 成約率ランキング
  sheet.getRange(19, startCol).setValue('成約率ランキング（高い順）');
  sheet.getRange(19, startCol).setFontWeight('bold').setBackground('#FFF8E1');
  const convHeaders = ['媒体', '成約率', '判定'];
  sheet.getRange(20, startCol, 1, 3).setValues([convHeaders]);
  formatHeaderRow_(sheet, `L20:N20`, COLORS.ADS);

  // 成約率データ
  for (let i = 0; i < 5; i++) {
    const row = 21 + i;
    sheet.getRange(row, startCol).setValue('');
    sheet.getRange(row, startCol + 1).setValue('');
    sheet.getRange(row, startCol + 2).setFormula(
      `=IF(M${row}="","",IF(M${row}>0.4,"◎優秀",IF(M${row}>0.25,"○良好","△要改善")))`
    );
  }

  // 推奨アクション
  sheet.getRange(27, startCol).setValue('【推奨アクション】');
  sheet.getRange(27, startCol).setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('L27:O27').merge();

  const actions = [
    ['ROI 300%超の媒体', '→', '予算を2倍に増額', ''],
    ['ROI 200%未満の媒体', '→', 'クリエイティブ改善', ''],
    ['CPA 20,000円超の媒体', '→', '予算削減or停止検討', ''],
    ['成約率 25%未満の媒体', '→', 'LP・訴求内容を見直し', '']
  ];
  sheet.getRange(28, startCol, 4, 4).setValues(actions);

  // 書式設定
  setPercentFormat_(sheet, 'M5:M9');
  setCurrencyFormat_(sheet, 'M13:M17');
  setPercentFormat_(sheet, 'M21:M25');

  // 列幅
  sheet.setColumnWidth(startCol, 150);     // 媒体
  sheet.setColumnWidth(startCol + 1, 100); // 値
  sheet.setColumnWidth(startCol + 2, 120); // 判定
}
