/**
 * スタッフシート構築
 */
function buildStaffSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.STAFF);

  // ヘッダー設定
  const headers = [
    'スタッフ名', '施術件数', '売上合計', '平均単価', '指名率',
    'リピート率', '口コミ数', '備考'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A1:H1', COLORS.STAFF);

  // 平均単価計算式（2〜100行）
  for (let row = 2; row <= 100; row++) {
    sheet.getRange(row, 4).setFormula(`=IFERROR(C${row}/B${row},"")`);
  }

  // 集計行設定（101行目）
  const summaryRow = SUMMARY_ROW;
  sheet.getRange(summaryRow, 1).setValue('【集計】');
  sheet.getRange(summaryRow, 2).setFormula('=AVERAGE(B2:B100)');
  sheet.getRange(summaryRow, 4).setFormula('=AVERAGE(D2:D100)');
  sheet.getRange(summaryRow, 6).setFormula('=AVERAGE(F2:F100)');

  // ラベル追加
  sheet.getRange(summaryRow - 1, 2).setValue('平均施術件数');
  sheet.getRange(summaryRow - 1, 4).setValue('平均単価');
  sheet.getRange(summaryRow - 1, 6).setValue('平均リピート率');

  // 書式設定
  setCurrencyFormat_(sheet, 'C2:D100');
  setPercentFormat_(sheet, 'E2:F100');
  setCurrencyFormat_(sheet, `D${summaryRow}`);
  setPercentFormat_(sheet, `F${summaryRow}`);

  formatSummaryRow_(sheet, summaryRow, 1, 8);

  // 範囲保護
  protectRange_(sheet, 'D2:D100', 'スタッフ平均単価');
  protectRange_(sheet, `B${summaryRow}:B${summaryRow}`, 'スタッフ集計');
  protectRange_(sheet, `D${summaryRow}:D${summaryRow}`, 'スタッフ集計');
  protectRange_(sheet, `F${summaryRow}:F${summaryRow}`, 'スタッフ集計');

  // 列幅調整
  autoResizeColumns_(sheet, 1, 8);
  sheet.setColumnWidth(1, 120);  // スタッフ名
  sheet.setColumnWidth(2, 100);  // 施術件数
  sheet.setColumnWidth(3, 100);  // 売上合計
  sheet.setColumnWidth(4, 100);  // 平均単価
  sheet.setColumnWidth(5, 80);   // 指名率
  sheet.setColumnWidth(6, 100);  // リピート率
  sheet.setColumnWidth(7, 100);  // 口コミ数
  sheet.setColumnWidth(8, 200);  // 備考

  // ========== 分析セクション（J列以降） ==========
  buildStaffAnalysisSection_(sheet);

  console.log('Staff sheet built successfully');
}

/**
 * スタッフ分析セクション構築
 */
function buildStaffAnalysisSection_(sheet) {
  const startCol = 10; // J列

  // タイトル
  sheet.getRange(1, startCol).setValue('【スタッフパフォーマンス分析】');
  sheet.getRange(1, startCol).setFontSize(12).setFontWeight('bold');
  sheet.getRange('J1:M1').merge();

  // 売上ランキング
  sheet.getRange(3, startCol).setValue('売上ランキング（TOP5）');
  sheet.getRange(3, startCol).setFontWeight('bold').setBackground('#E8EAF6');
  const salesHeaders = ['順位', 'スタッフ名', '売上', '目標達成率'];
  sheet.getRange(4, startCol, 1, 4).setValues([salesHeaders]);
  formatHeaderRow_(sheet, `J4:M4`, COLORS.STAFF);

  // ランキングデータ（手動集計）
  for (let i = 0; i < 5; i++) {
    const row = 5 + i;
    sheet.getRange(row, startCol).setValue(i + 1);
    sheet.getRange(row, startCol + 1).setValue(''); // 名前（手動）
    sheet.getRange(row, startCol + 2).setValue(''); // 売上（手動）
    sheet.getRange(row, startCol + 3).setFormula(
      `=IF(L${row}="","",L${row}/1000000)`
    );
  }

  // 平均単価ランキング
  sheet.getRange(11, startCol).setValue('平均単価ランキング（TOP5）');
  sheet.getRange(11, startCol).setFontWeight('bold').setBackground('#E8EAF6');
  const priceHeaders = ['順位', 'スタッフ名', '平均単価', '評価'];
  sheet.getRange(12, startCol, 1, 4).setValues([priceHeaders]);
  formatHeaderRow_(sheet, `J12:M12`, COLORS.STAFF);

  for (let i = 0; i < 5; i++) {
    const row = 13 + i;
    sheet.getRange(row, startCol).setValue(i + 1);
    sheet.getRange(row, startCol + 1).setValue('');
    sheet.getRange(row, startCol + 2).setValue('');
    sheet.getRange(row, startCol + 3).setFormula(
      `=IF(L${row}="","",IF(L${row}>40000,"◎高単価",IF(L${row}>30000,"○標準","△低単価")))`
    );
  }

  // パフォーマンスマトリクス説明
  sheet.getRange(19, startCol).setValue('【パフォーマンスマトリクス】');
  sheet.getRange(19, startCol).setFontWeight('bold').setBackground('#E8EAF6');
  sheet.getRange('J19:M19').merge();

  const matrix = [
    ['スタッフ名', '指名率', 'リピート率', '総合評価'],
    ['', '', '', '=IF(K21="","",IF(AND(K21>0.6,L21>0.75),"★優秀",IF(OR(K21<0.4,L21<0.65),"要改善","標準")))'],
    ['', '', '', '=IF(K22="","",IF(AND(K22>0.6,L22>0.75),"★優秀",IF(OR(K22<0.4,L22<0.65),"要改善","標準")))'],
    ['', '', '', '=IF(K23="","",IF(AND(K23>0.6,L23>0.75),"★優秀",IF(OR(K23<0.4,L23<0.65),"要改善","標準")))'],
    ['', '', '', '=IF(K24="","",IF(AND(K24>0.6,L24>0.75),"★優秀",IF(OR(K24<0.4,L24<0.65),"要改善","標準")))'],
    ['', '', '', '=IF(K25="","",IF(AND(K25>0.6,L25>0.75),"★優秀",IF(OR(K25<0.4,L25<0.65),"要改善","標準")))']
  ];
  sheet.getRange(20, startCol, 6, 4).setValues(matrix);
  formatHeaderRow_(sheet, `J20:M20`, COLORS.STAFF);

  // 改善アクション
  sheet.getRange(27, startCol).setValue('【改善アクション】');
  sheet.getRange(27, startCol).setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('J27:M27').merge();

  const actions = [
    ['売上100万円未満', '→', '先輩スタッフと同行研修', ''],
    ['指名率40%未満', '→', '接客スキル研修実施', ''],
    ['リピート率65%未満', '→', 'アフターフォロー強化', ''],
    ['平均単価3万円未満', '→', 'アップセルトーク研修', '']
  ];
  sheet.getRange(28, startCol, 4, 4).setValues(actions);

  // 書式設定
  setCurrencyFormat_(sheet, 'L5:L9');
  setPercentFormat_(sheet, 'M5:M9');
  setCurrencyFormat_(sheet, 'L13:L17');
  setPercentFormat_(sheet, 'K21:L25');

  // 列幅
  sheet.setColumnWidth(startCol, 80);      // 順位
  sheet.setColumnWidth(startCol + 1, 120); // スタッフ名
  sheet.setColumnWidth(startCol + 2, 100); // 値
  sheet.setColumnWidth(startCol + 3, 120); // 評価
}
