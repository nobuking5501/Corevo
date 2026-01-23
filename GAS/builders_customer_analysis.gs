/**
 * 顧客分析シート構築
 */
function buildCustomerAnalysisSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.CUSTOMER_ANALYSIS);

  // タイトル
  sheet.getRange('A1').setValue('【顧客分析・リテンション管理】');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // ========== 解約理由分析 ==========
  sheet.getRange('A3').setValue('解約理由TOP5');
  sheet.getRange('A3').setFontWeight('bold').setBackground(COLORS.CUSTOMER_ANALYSIS);

  const reasonHeaders = ['解約理由', '件数', '構成比', '優先度'];
  sheet.getRange(4, 1, 1, 4).setValues([reasonHeaders]);
  formatHeaderRow_(sheet, 'A4:D4', COLORS.CUSTOMER_ANALYSIS);

  // 解約理由（手動集計）
  const reasons = [
    ['価格が高い', '=COUNTIF(顧客!H:H,"価格が高い")', '=IFERROR(B5/B10,"")', '=IF(B5>0,"★最優先","")'],
    ['効果が薄い', '=COUNTIF(顧客!H:H,"効果が薄い")', '=IFERROR(B6/B10,"")', '=IF(B6>0,"★最優先","")'],
    ['接客不満', '=COUNTIF(顧客!H:H,"接客不満")', '=IFERROR(B7/B10,"")', '=IF(B7>0,"◎重要","")'],
    ['立地が悪い', '=COUNTIF(顧客!H:H,"立地が悪い")', '=IFERROR(B8/B10,"")', '=IF(B8>0,"○対応","")'],
    ['時間がない', '=COUNTIF(顧客!H:H,"時間がない")', '=IFERROR(B9/B10,"")', '=IF(B9>0,"○対応","")'],
    ['合計', '=COUNTIF(顧客!H:H,"<>"&"")', '=SUM(C5:C9)', '']
  ];
  sheet.getRange(5, 1, reasons.length, 4).setValues(reasons);

  setPercentFormat_(sheet, 'C5:C10');
  formatSummaryRow_(sheet, 10, 1, 4);

  // ========== ステータス別顧客数 ==========
  sheet.getRange('A12').setValue('ステータス別顧客数');
  sheet.getRange('A12').setFontWeight('bold').setBackground(COLORS.CUSTOMER_ANALYSIS);

  const statusHeaders = ['ステータス', '顧客数', '構成比', '平均通過回数'];
  sheet.getRange(13, 1, 1, 4).setValues([statusHeaders]);
  formatHeaderRow_(sheet, 'A13:D13', COLORS.CUSTOMER_ANALYSIS);

  const statuses = [
    ['初回', '=COUNTIF(顧客!E:E,"初回")', '=IFERROR(B14/B17,"")', '=AVERAGEIF(顧客!E:E,"初回",顧客!D:D)'],
    ['中間', '=COUNTIF(顧客!E:E,"中間")', '=IFERROR(B15/B17,"")', '=AVERAGEIF(顧客!E:E,"中間",顧客!D:D)'],
    ['完了', '=COUNTIF(顧客!E:E,"完了")', '=IFERROR(B16/B17,"")', '=AVERAGEIF(顧客!E:E,"完了",顧客!D:D)'],
    ['合計', '=SUM(B14:B16)', '=SUM(C14:C16)', '=AVERAGE(D14:D16)']
  ];
  sheet.getRange(14, 1, statuses.length, 4).setValues(statuses);

  setPercentFormat_(sheet, 'C14:C17');
  formatSummaryRow_(sheet, 17, 1, 4);

  // ========== 継続率・解約率 ==========
  sheet.getRange('A19').setValue('継続率・解約率');
  sheet.getRange('A19').setFontWeight('bold').setBackground(COLORS.CUSTOMER_ANALYSIS);

  const retentionHeaders = ['指標', '実績', '目標', '達成状況'];
  sheet.getRange(20, 1, 1, 4).setValues([retentionHeaders]);
  formatHeaderRow_(sheet, 'A20:D20', COLORS.CUSTOMER_ANALYSIS);

  const retention = [
    ['継続率', '=顧客!L101', '85%', '=IF(B21>=${KPI_TARGETS.CONTINUATION_RATE},"✓達成","未達成")'],
    ['解約率', '=顧客!M101', '15%', '=IF(B22<=0.15,"✓達成","未達成")'],
    ['次回予約率', '=顧客!K101', '80%', '=IF(B23>=${KPI_TARGETS.NEXT_RESERVATION_RATE},"✓達成","未達成")']
  ];
  sheet.getRange(21, 1, retention.length, 4).setValues(retention);

  setPercentFormat_(sheet, 'B21:B23');

  // ========== コース別顧客数 ==========
  sheet.getRange('A25').setValue('コース別顧客数');
  sheet.getRange('A25').setFontWeight('bold').setBackground(COLORS.CUSTOMER_ANALYSIS);

  const courseHeaders = ['コース', '顧客数', '構成比'];
  sheet.getRange(26, 1, 1, 3).setValues([courseHeaders]);
  formatHeaderRow_(sheet, 'A26:C26', COLORS.CUSTOMER_ANALYSIS);

  const courseCust = [
    ['全身脱毛コース', '=COUNTIF(顧客!C:C,"全身脱毛コース")', '=IFERROR(B27/B31,"")'],
    ['VIO脱毛', '=COUNTIF(顧客!C:C,"VIO脱毛")', '=IFERROR(B28/B31,"")'],
    ['顔脱毛コース', '=COUNTIF(顧客!C:C,"顔脱毛コース")', '=IFERROR(B29/B31,"")'],
    ['腕・足脱毛', '=COUNTIF(顧客!C:C,"腕脱毛")+COUNTIF(顧客!C:C,"足脱毛")', '=IFERROR(B30/B31,"")'],
    ['合計', '=SUM(B27:B30)', '=SUM(C27:C30)']
  ];
  sheet.getRange(27, 1, courseCust.length, 3).setValues(courseCust);

  setPercentFormat_(sheet, 'C27:C31');
  formatSummaryRow_(sheet, 31, 1, 3);

  // ========== 分析コメント・改善アクション ==========
  sheet.getRange('F3').setValue('【改善アクション】');
  sheet.getRange('F3').setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('F3:H3').merge();

  const actions = [
    ['解約理由「価格」が多い', '→', '分割払い・サブスク導入検討'],
    ['解約理由「効果」が多い', '→', '機器更新・施術方法見直し'],
    ['継続率85%未満', '→', 'LINEフォロー・特典付与'],
    ['初回ステータス60%超', '→', '2回目来店促進キャンペーン'],
    ['次回予約率80%未満', '→', '予約時特典・リマインド強化']
  ];
  sheet.getRange(4, 6, 5, 3).setValues(actions);

  sheet.getRange('F11').setValue('【分析ポイント】');
  sheet.getRange('F11').setFontWeight('bold').setBackground('#FFEB3B');
  sheet.getRange('F11:H11').merge();

  const insights = [
    ['解約理由TOP3で80%', '→', 'その3項目に集中対策'],
    ['完了顧客30%超', '→', '追加コース提案が必要'],
    ['中間顧客50%超', '→', '順調なリテンション'],
    ['初回顧客60%超', '→', '継続率に黄信号']
  ];
  sheet.getRange(12, 6, 4, 3).setValues(insights);

  // 列幅調整
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(6, 180);
  sheet.setColumnWidth(7, 40);
  sheet.setColumnWidth(8, 220);

  console.log('Customer Analysis sheet built successfully');
}
