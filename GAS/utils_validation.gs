/**
 * データ検証ユーティリティ
 */

/**
 * プルダウンリスト設定
 */
function setValidationList_(sheet, rangeA1, values) {
  const range = sheet.getRange(rangeA1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

/**
 * 複数行にわたるプルダウン設定
 */
function setValidationListForRows_(sheet, column, startRow, endRow, values) {
  const range = sheet.getRange(startRow, column, endRow - startRow + 1, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}
