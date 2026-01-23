/**
 * 経費シート構築
 */
function buildExpensesSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.EXPENSES);

  // ヘッダー設定
  const headers = [
    '月', '家賃', '人件費', '広告費', '材料費',
    '光熱費', '雑費', 'システム費', '合計', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:J1', COLORS.EXPENSES);

  // 行合計式設定（2〜100行）
  for (let row = 2; row <= 100; row++) {
    sheet.getRange(row, 9).setFormula(`=SUM(B${row}:H${row})`);
  }

  // 集計行設定（101行目）
  const summaryRow = SUMMARY_ROW;
  sheet.getRange(summaryRow, 1).setValue('【集計】');
  sheet.getRange(summaryRow, 9).setFormula('=SUM(I2:I100)');
  sheet.getRange(summaryRow, 11).setFormula('=IFERROR(I101/売上!G101,"")'); // K列：売上比率
  sheet.getRange(summaryRow, 12).setFormula('=IFERROR(D101/売上!G101,"")'); // L列：広告費率
  sheet.getRange(summaryRow, 13).setFormula('=IFERROR(C101/売上!G101,"")'); // M列：人件費率

  // ラベル追加
  sheet.getRange(summaryRow - 1, 9).setValue('経費合計');
  sheet.getRange(summaryRow - 1, 11).setValue('売上比率（経費率）');
  sheet.getRange(summaryRow - 1, 12).setValue('広告費率');
  sheet.getRange(summaryRow - 1, 13).setValue('人件費率');

  // 書式設定
  setCurrencyFormat_(sheet, 'B2:I100');
  setCurrencyFormat_(sheet, `I${summaryRow}`);
  setPercentFormat_(sheet, `K${summaryRow}:M${summaryRow}`);

  formatSummaryRow_(sheet, summaryRow, 1, 13);

  // 範囲保護
  protectRange_(sheet, 'I2:I100', '経費行合計');
  protectRange_(sheet, `I${summaryRow}:I${summaryRow}`, '経費集計');
  protectRange_(sheet, `K${summaryRow}:M${summaryRow}`, '経費比率');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 10);
  sheet.setColumnWidth(1, 80);   // 月
  sheet.setColumnWidth(2, 100);  // 家賃
  sheet.setColumnWidth(3, 100);  // 人件費
  sheet.setColumnWidth(4, 100);  // 広告費
  sheet.setColumnWidth(5, 100);  // 材料費
  sheet.setColumnWidth(6, 100);  // 光熱費
  sheet.setColumnWidth(7, 100);  // 雑費
  sheet.setColumnWidth(8, 100);  // システム費
  sheet.setColumnWidth(9, 100);  // 合計
  sheet.setColumnWidth(10, 150); // 備考

  // ========== 分析セクション（L列以降） ==========
  buildExpensesAnalysisSection_(sheet);

  console.log('Expenses sheet built successfully');
}

/**
 * 経費分析セクション構築（適正比率分析）
 */
function buildExpensesAnalysisSection_(sheet) {
  const startCol = 12; // L列

  // タイトル
  sheet.getRange(1, startCol).setValue('【経費比率分析（売上対比）】');
  sheet.getRange(1, startCol).setFontSize(12).setFontWeight('bold');
  sheet.getRange('L1:P1').merge();

  // 分析表ヘッダー
  const headers = ['経費項目', '実績比率', '適正範囲', '判定', '削減余地'];
  sheet.getRange(3, startCol, 1, 5).setValues([headers]);
  formatHeaderRow_(sheet, `L3:P3`, COLORS.EXPENSES);

  // 各経費項目の分析
  const items = [
    ['家賃', '=IFERROR(経費!B101/売上!G101,"")', '5-10%',
     '=IF(M4="","",IF(M4<=0.10,"○適正範囲","⚠超過"))',
     '=IF(AND(M4>0.10,売上!G101>0),(M4-0.10)*売上!G101,0)'],
    ['人件費', '=IFERROR(経費!C101/売上!G101,"")', '20-30%',
     '=IF(M5="","",IF(M5<=0.30,"○適正範囲","⚠超過"))',
     '=IF(AND(M5>0.30,売上!G101>0),(M5-0.30)*売上!G101,0)'],
    ['広告費', '=IFERROR(経費!D101/売上!G101,"")', '10-20%',
     '=IF(M6="","",IF(M6<=0.20,"○適正範囲","⚠超過"))',
     '=IF(AND(M6>0.20,売上!G101>0),(M6-0.20)*売上!G101,0)'],
    ['材料費', '=IFERROR(経費!E101/売上!G101,"")', '3-8%',
     '=IF(M7="","",IF(M7<=0.08,"○適正範囲","⚠超過"))',
     '=IF(AND(M7>0.08,売上!G101>0),(M7-0.08)*売上!G101,0)'],
    ['光熱費', '=IFERROR(経費!F101/売上!G101,"")', '2-5%',
     '=IF(M8="","",IF(M8<=0.05,"○適正範囲","⚠超過"))',
     '=IF(AND(M8>0.05,売上!G101>0),(M8-0.05)*売上!G101,0)'],
    ['雑費', '=IFERROR(経費!G101/売上!G101,"")', '1-3%',
     '=IF(M9="","",IF(M9<=0.03,"○適正範囲","⚠超過"))',
     '=IF(AND(M9>0.03,売上!G101>0),(M9-0.03)*売上!G101,0)'],
    ['システム費', '=IFERROR(経費!H101/売上!G101,"")', '1-2%',
     '=IF(M10="","",IF(M10<=0.02,"○適正範囲","⚠超過"))',
     '=IF(AND(M10>0.02,売上!G101>0),(M10-0.02)*売上!G101,0)']
  ];
  sheet.getRange(4, startCol, items.length, 5).setValues(items);

  // 合計削減余地
  sheet.getRange(12, startCol).setValue('【合計削減余地】');
  sheet.getRange(12, startCol).setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange(12, startCol + 4).setFormula('=SUM(P4:P10)');

  // 推奨アクション
  sheet.getRange(14, startCol).setValue('【コスト削減アクション】');
  sheet.getRange(14, startCol).setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('L14:P14').merge();

  const actions = [
    ['家賃10%超', '→', '家賃交渉 or 移転検討', '', ''],
    ['人件費30%超', '→', 'シフト最適化・パート比率見直し', '', ''],
    ['広告費20%超', '→', 'ROI低い媒体停止', '', ''],
    ['材料費8%超', '→', '仕入れ先変更・ロス削減', '', ''],
    ['総経費率60%超', '→', '全項目見直し必須', '', '']
  ];
  sheet.getRange(15, startCol, 5, 5).setValues(actions);

  // 書式設定
  setPercentFormat_(sheet, 'M4:M10');
  setCurrencyFormat_(sheet, 'P4:P10');
  setCurrencyFormat_(sheet, 'P12');

  // 列幅
  sheet.setColumnWidth(startCol, 100);     // 経費項目
  sheet.setColumnWidth(startCol + 1, 90);  // 実績比率
  sheet.setColumnWidth(startCol + 2, 90);  // 適正範囲
  sheet.setColumnWidth(startCol + 3, 100); // 判定
  sheet.setColumnWidth(startCol + 4, 100); // 削減余地
}
