/**
 * 書式設定ユーティリティ
 */

/**
 * ヘッダー行の書式設定
 */
function formatHeaderRow_(sheet, range, color) {
  const headerRange = sheet.getRange(range);
  headerRange.setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground(color);
  sheet.setFrozenRows(1);

  // フィルタが存在しない場合のみ作成
  try {
    const existingFilter = sheet.getFilter();
    if (!existingFilter) {
      headerRange.createFilter();
    }
  } catch (error) {
    // フィルタが存在しない場合は作成
    try {
      headerRange.createFilter();
    } catch (createError) {
      console.warn(`Filter creation skipped for ${sheet.getName()}:`, createError.message);
    }
  }
}

/**
 * 列幅の自動調整
 */
function autoResizeColumns_(sheet, startCol, endCol) {
  for (let i = startCol; i <= endCol; i++) {
    sheet.autoResizeColumn(i);
    // 自動調整後、最低幅を確保
    const currentWidth = sheet.getColumnWidth(i);
    if (currentWidth < 100) {
      sheet.setColumnWidth(i, 120);
    }
  }
}

/**
 * 数値フォーマット設定
 */
function setNumberFormat_(sheet, range, format) {
  sheet.getRange(range).setNumberFormat(format);
}

/**
 * 日付フォーマット設定
 */
function setDateFormat_(sheet, range) {
  sheet.getRange(range).setNumberFormat('yyyy/mm/dd');
}

/**
 * 通貨フォーマット設定
 */
function setCurrencyFormat_(sheet, range) {
  sheet.getRange(range).setNumberFormat('¥#,##0');
}

/**
 * パーセントフォーマット設定
 */
function setPercentFormat_(sheet, range) {
  sheet.getRange(range).setNumberFormat('0.0%');
}

/**
 * 集計行の書式設定
 */
function formatSummaryRow_(sheet, row, startCol, endCol) {
  const range = sheet.getRange(row, startCol, 1, endCol - startCol + 1);
  range.setFontWeight('bold')
    .setBackground(COLORS.SUMMARY_ROW);
}

/**
 * 条件付き書式：前月比較（ダッシュボード用）
 */
function applyConditionalFormattingComparison_(sheet, dataRange, currentCol, previousCol) {
  const rules = sheet.getConditionalFormatRules();

  // 今月 > 前月 → 緑
  const greaterRule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([sheet.getRange(dataRange)])
    .whenFormulaSatisfied(`=${currentCol}2>${previousCol}2`)
    .setBackground('#D5F5E3')
    .build();

  // 今月 < 前月 → 赤
  const lessRule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([sheet.getRange(dataRange)])
    .whenFormulaSatisfied(`=${currentCol}2<${previousCol}2`)
    .setBackground('#F5B7B1')
    .build();

  rules.push(greaterRule);
  rules.push(lessRule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * 条件付き書式：負数を赤に（ROI用）
 */
function applyConditionalFormattingNegative_(sheet, range) {
  const rules = sheet.getConditionalFormatRules();

  const negativeRule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([sheet.getRange(range)])
    .whenNumberLessThan(0)
    .setBackground('#F5B7B1')
    .build();

  rules.push(negativeRule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * 印刷範囲クリア
 */
function clearPrintRange_(sheet) {
  sheet.getRange('A1').activate();
}
