/**
 * 売上分析シート構築
 */
function buildSalesAnalysisSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.SALES_ANALYSIS);

  // タイトル
  sheet.getRange('A1').setValue('【売上構造分析】');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // ========== コース別売上分析 ==========
  sheet.getRange('A3').setValue('コース別売上分析');
  sheet.getRange('A3').setFontWeight('bold').setBackground(COLORS.SALES_ANALYSIS);

  const courseHeaders = ['コース名', '件数', '売上', '構成比', '平均単価'];
  sheet.getRange(4, 1, 1, 5).setValues([courseHeaders]);
  formatHeaderRow_(sheet, 'A4:E4', COLORS.SALES_ANALYSIS);

  // コース別集計（手動入力+数式）
  const courses = [
    ['全身脱毛コース', '=COUNTIF(売上!D:D,"全身脱毛コース")', '=SUMIF(売上!D:D,"全身脱毛コース",売上!G:G)', '=IFERROR(C5/C10,"")', '=IFERROR(C5/B5,"")'],
    ['VIO脱毛', '=COUNTIF(売上!D:D,"VIO脱毛")', '=SUMIF(売上!D:D,"VIO脱毛",売上!G:G)', '=IFERROR(C6/C10,"")', '=IFERROR(C6/B6,"")'],
    ['顔脱毛コース', '=COUNTIF(売上!D:D,"顔脱毛コース")', '=SUMIF(売上!D:D,"顔脱毛コース",売上!G:G)', '=IFERROR(C7/C10,"")', '=IFERROR(C7/B7,"")'],
    ['腕脱毛', '=COUNTIF(売上!D:D,"腕脱毛")', '=SUMIF(売上!D:D,"腕脱毛",売上!G:G)', '=IFERROR(C8/C10,"")', '=IFERROR(C8/B8,"")'],
    ['足脱毛', '=COUNTIF(売上!D:D,"足脱毛")', '=SUMIF(売上!D:D,"足脱毛",売上!G:G)', '=IFERROR(C9/C10,"")', '=IFERROR(C9/B9,"")'],
    ['合計', '=SUM(B5:B9)', '=SUM(C5:C9)', '=SUM(D5:D9)', '=IFERROR(C10/B10,"")']
  ];
  sheet.getRange(5, 1, courses.length, 5).setValues(courses);

  // 書式
  setCurrencyFormat_(sheet, 'C5:C10');
  setPercentFormat_(sheet, 'D5:D10');
  setCurrencyFormat_(sheet, 'E5:E10');
  formatSummaryRow_(sheet, 10, 1, 5);

  // ========== 新規vs既存分析 ==========
  sheet.getRange('A12').setValue('新規 vs 既存顧客分析');
  sheet.getRange('A12').setFontWeight('bold').setBackground(COLORS.SALES_ANALYSIS);

  const typeHeaders = ['顧客区分', '件数', '売上', '構成比', '平均単価'];
  sheet.getRange(13, 1, 1, 5).setValues([typeHeaders]);
  formatHeaderRow_(sheet, 'A13:E13', COLORS.SALES_ANALYSIS);

  const types = [
    ['新規', '=COUNTIF(売上!C:C,"新規")', '=SUMIF(売上!C:C,"新規",売上!G:G)', '=IFERROR(C14/C16,"")', '=IFERROR(C14/B14,"")'],
    ['既存', '=COUNTIF(売上!C:C,"既存")', '=SUMIF(売上!C:C,"既存",売上!G:G)', '=IFERROR(C15/C16,"")', '=IFERROR(C15/B15,"")'],
    ['合計', '=SUM(B14:B15)', '=SUM(C14:C15)', '=SUM(D14:D15)', '=IFERROR(C16/B16,"")']
  ];
  sheet.getRange(14, 1, types.length, 5).setValues(types);

  setCurrencyFormat_(sheet, 'C14:C16');
  setPercentFormat_(sheet, 'D14:D16');
  setCurrencyFormat_(sheet, 'E14:E16');
  formatSummaryRow_(sheet, 16, 1, 5);

  // ========== 支払い方法別分析 ==========
  sheet.getRange('A18').setValue('支払い方法別分析');
  sheet.getRange('A18').setFontWeight('bold').setBackground(COLORS.SALES_ANALYSIS);

  const paymentHeaders = ['支払い方法', '件数', '売上', '構成比'];
  sheet.getRange(19, 1, 1, 4).setValues([paymentHeaders]);
  formatHeaderRow_(sheet, 'A19:D19', COLORS.SALES_ANALYSIS);

  const payments = [
    ['カード', '=COUNTIF(売上!H:H,"カード")', '=SUMIF(売上!H:H,"カード",売上!G:G)', '=IFERROR(C20/C23,"")'],
    ['現金', '=COUNTIF(売上!H:H,"現金")', '=SUMIF(売上!H:H,"現金",売上!G:G)', '=IFERROR(C21/C23,"")'],
    ['PayPay', '=COUNTIF(売上!H:H,"PayPay")', '=SUMIF(売上!H:H,"PayPay",売上!G:G)', '=IFERROR(C22/C23,"")'],
    ['合計', '=SUM(B20:B22)', '=SUM(C20:C22)', '=SUM(D20:D22)']
  ];
  sheet.getRange(20, 1, payments.length, 4).setValues(payments);

  setCurrencyFormat_(sheet, 'C20:C23');
  setPercentFormat_(sheet, 'D20:D23');
  formatSummaryRow_(sheet, 23, 1, 4);

  // ========== 分析コメント ==========
  sheet.getRange('G3').setValue('【分析ポイント】');
  sheet.getRange('G3').setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('G3:I3').merge();

  const insights = [
    ['コース別構成比', '→', '低調コースはキャンペーン実施'],
    ['新規比率30%未満', '→', '広告予算増額が必要'],
    ['既存比率70%超', '→', '新規獲得施策を強化'],
    ['高単価コース不足', '→', 'アップセル研修実施'],
    ['現金比率高い', '→', 'キャッシュレス促進']
  ];
  sheet.getRange(4, 7, 5, 3).setValues(insights);

  // 列幅調整
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 40);
  sheet.setColumnWidth(9, 200);

  console.log('Sales Analysis sheet built successfully');
}
