/**
 * ダミーデータ投入
 */

function seedAllData_(ss) {
  seedSalesData_(ss);
  seedAdsData_(ss);
  seedCustomersData_(ss);
  seedExpensesData_(ss);
  seedStaffData_(ss);
  seedActionsData_(ss);

  // 名前付き範囲設定
  setAllNamedRanges_(ss);

  // ダッシュボード再計算
  recalculateDashboard_(ss);

  SpreadsheetApp.flush();
  console.log('All sample data seeded successfully');
}

/**
 * 売上ダミーデータ
 */
function seedSalesData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SALES);
  if (!sheet) return;

  // データが既に存在するかチェック
  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Sales data already exists, skipping seed');
    return;
  }

  const sampleData = [
    [new Date(2025, 0, 5), '山田花子', '新規', '全身脱毛コース', 300000, 1, 300000, 'カード', '佐藤', '初回来店'],
    [new Date(2025, 0, 8), '鈴木美咲', '既存', 'VIO脱毛', 50000, 1, 50000, '現金', '田中', '2回目施術'],
    [new Date(2025, 0, 12), '佐々木綾', '新規', '顔脱毛コース', 80000, 1, 80000, 'PayPay', '佐藤', ''],
    [new Date(2025, 0, 15), '高橋明美', '既存', '全身脱毛コース', 300000, 1, 300000, 'カード', '伊藤', '3回目施術'],
    [new Date(2025, 0, 18), '田中由美', '新規', '腕脱毛', 40000, 1, 40000, '現金', '田中', '体験から入会'],
    [new Date(2025, 0, 20), '伊藤麻衣', '既存', 'VIO脱毛', 50000, 1, 50000, 'カード', '佐藤', ''],
    [new Date(2025, 0, 22), '渡辺香織', '新規', '全身脱毛コース', 300000, 1, 300000, 'PayPay', '伊藤', '友人紹介'],
    [new Date(2025, 0, 25), '中村真理', '既存', '足脱毛', 60000, 1, 60000, '現金', '田中', '追加契約'],
    [new Date(2025, 0, 27), '小林彩', '新規', '顔脱毛コース', 80000, 1, 80000, 'カード', '佐藤', 'SNS経由'],
    [new Date(2025, 0, 29), '加藤優子', '既存', '全身脱毛コース', 300000, 1, 300000, 'PayPay', '伊藤', '']
  ];

  sheet.getRange(2, 1, sampleData.length, 10).setValues(sampleData);
  console.log('Sales sample data inserted');
}

/**
 * 広告ダミーデータ
 */
function seedAdsData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ADS);
  if (!sheet) return;

  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Ads data already exists, skipping seed');
    return;
  }

  const sampleData = [
    ['2025/01', 'Instagram広告', 100000, 25, 8, '', '', 320000, '', 'ストーリーズ中心'],
    ['2025/01', 'Google広告', 80000, 18, 6, '', '', 270000, '', 'リスティング'],
    ['2025/01', 'LINE広告', 60000, 15, 4, '', '', 200000, '', 'ターゲット配信'],
    ['2025/01', 'ホットペッパー', 40000, 12, 5, '', '', 250000, '', '掲載料'],
    ['2025/01', 'Facebook広告', 50000, 10, 3, '', '', 180000, '', ''],
    ['2024/12', 'Instagram広告', 95000, 22, 7, '', '', 300000, '', ''],
    ['2024/12', 'Google広告', 85000, 16, 5, '', '', 240000, '', ''],
    ['2024/12', 'LINE広告', 70000, 13, 4, '', '', 190000, '', '']
  ];

  sheet.getRange(2, 1, sampleData.length, 10).setValues(sampleData);

  // 数式が上書きされてしまうため、データ投入後に数式を再設定
  const startRow = 2;
  const endRow = startRow + sampleData.length - 1;
  for (let row = startRow; row <= endRow; row++) {
    sheet.getRange(row, 6).setFormula(`=IFERROR(E${row}/D${row},"")`); // 成約率
    sheet.getRange(row, 7).setFormula(`=IFERROR(C${row}/E${row},"")`); // CPA
    sheet.getRange(row, 9).setFormula(`=IF(AND(H${row}<>"",G${row}<>""),(H${row}-G${row})/G${row},"")`); // ROI
  }

  console.log('Ads sample data inserted');
}

/**
 * 顧客ダミーデータ
 */
function seedCustomersData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  if (!sheet) return;

  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Customers data already exists, skipping seed');
    return;
  }

  const sampleData = [
    ['山田花子', new Date(2025, 0, 5), '全身脱毛コース', 1, '初回', new Date(2025, 1, 5), '○', '', '佐藤', '順調'],
    ['鈴木美咲', new Date(2024, 10, 10), 'VIO脱毛', 3, '中間', new Date(2025, 1, 10), '○', '', '田中', ''],
    ['佐々木綾', new Date(2025, 0, 12), '顔脱毛コース', 1, '初回', new Date(2025, 1, 12), '○', '', '佐藤', ''],
    ['高橋明美', new Date(2024, 9, 15), '全身脱毛コース', 4, '中間', new Date(2025, 1, 15), '○', '', '伊藤', '優良顧客'],
    ['田中由美', new Date(2025, 0, 18), '腕脱毛', 1, '初回', new Date(2025, 1, 18), '○', '', '田中', ''],
    ['伊藤麻衣', new Date(2024, 8, 20), 'VIO脱毛', 5, '完了', '', '×', '価格が高い', '佐藤', '解約'],
    ['渡辺香織', new Date(2025, 0, 22), '全身脱毛コース', 1, '初回', new Date(2025, 1, 22), '○', '', '伊藤', '友人紹介'],
    ['中村真理', new Date(2024, 7, 25), '足脱毛', 6, '完了', new Date(2025, 1, 25), '○', '', '田中', '追加契約予定'],
    ['小林彩', new Date(2025, 0, 27), '顔脱毛コース', 1, '初回', new Date(2025, 1, 27), '○', '', '佐藤', 'SNS経由'],
    ['加藤優子', new Date(2024, 11, 29), '全身脱毛コース', 2, '中間', new Date(2025, 1, 29), '○', '', '伊藤', '']
  ];

  sheet.getRange(2, 1, sampleData.length, 10).setValues(sampleData);
  console.log('Customers sample data inserted');
}

/**
 * 経費ダミーデータ
 */
function seedExpensesData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!sheet) return;

  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Expenses data already exists, skipping seed');
    return;
  }

  const sampleData = [
    ['2025/01', 100000, 250000, 80000, 50000, 30000, 15000, 10000, '', ''],
    ['2024/12', 100000, 245000, 75000, 48000, 28000, 14000, 10000, '', ''],
    ['2024/11', 100000, 240000, 70000, 45000, 27000, 13000, 10000, '', ''],
    ['2024/10', 100000, 235000, 68000, 43000, 26000, 12000, 10000, '', ''],
    ['2024/09', 100000, 230000, 65000, 40000, 25000, 11000, 10000, '', '']
  ];

  sheet.getRange(2, 1, sampleData.length, 10).setValues(sampleData);

  // 合計列の数式を再設定
  const startRow = 2;
  const endRow = startRow + sampleData.length - 1;
  for (let row = startRow; row <= endRow; row++) {
    sheet.getRange(row, 9).setFormula(`=SUM(B${row}:H${row})`);
  }

  console.log('Expenses sample data inserted');
}

/**
 * スタッフダミーデータ
 */
function seedStaffData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!sheet) return;

  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Staff data already exists, skipping seed');
    return;
  }

  const sampleData = [
    ['佐藤', 35, 1050000, '', 0.65, 0.78, 12, '店長、技術力高い'],
    ['田中', 28, 780000, '', 0.52, 0.70, 8, '接客が丁寧'],
    ['伊藤', 32, 920000, '', 0.58, 0.75, 10, '新規獲得に強い'],
    ['山本', 25, 650000, '', 0.45, 0.65, 5, '新人育成中'],
    ['渡辺', 30, 850000, '', 0.55, 0.72, 9, 'リピート率高']
  ];

  sheet.getRange(2, 1, sampleData.length, 8).setValues(sampleData);

  // 平均単価の数式を再設定
  const startRow = 2;
  const endRow = startRow + sampleData.length - 1;
  for (let row = startRow; row <= endRow; row++) {
    sheet.getRange(row, 4).setFormula(`=IFERROR(C${row}/B${row},"")`);
  }

  console.log('Staff sample data inserted');
}

/**
 * 改善アクションダミーデータ
 */
function seedActionsData_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ACTIONS);
  if (!sheet) return;

  if (sheet.getRange('A2').getValue() !== '') {
    console.log('Actions data already exists, skipping seed');
    return;
  }

  const sampleData = [
    ['2025/01', '継続率', '75%', '継続率が目標85%を下回っている', '施術後のフォローアップ強化・LINE配信開始', '店長', new Date(2025, 0, 10), '実施中・2月に効果測定予定'],
    ['2025/01', '新規来店数', '15名', '目標20名に対して5名不足', 'Instagram広告の予算を2倍に増額', 'マーケ担当', new Date(2025, 0, 15), '広告費10万→20万に変更済み'],
    ['2024/12', '利益率', '18%', '目標20%に届かず', '材料費の仕入れ先を変更・人件費の見直し', '店長', new Date(2024, 11, 5), '材料費が15万→10万に削減成功'],
    ['2024/12', 'CPA', '18,000円', '目標15,000円を超過', 'Facebook広告を停止・Instagram集中投下', 'マーケ担当', new Date(2024, 11, 10), 'CPA 18,000→13,000円に改善'],
    ['2024/11', 'スタッフ売上', '山本65万', '目標100万に対して35万不足', '研修プログラムの実施・先輩との同行', '店長', new Date(2024, 10, 20), '12月実績80万に向上・継続フォロー中']
  ];

  sheet.getRange(2, 1, sampleData.length, 8).setValues(sampleData);
  console.log('Actions sample data inserted');
}
