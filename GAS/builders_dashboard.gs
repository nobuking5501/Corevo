/**
 * ダッシュボードシート構築
 */
function buildDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.DASHBOARD);

  // タイトル行
  sheet.getRange('A1').setValue('【月次KPI ダッシュボード】');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // ヘッダー設定（5ヶ月分+平均+累計）
  const headers = ['指標', '2025/01', '2024/12', '2024/11', '2024/10', '2024/09', '5ヶ月平均', '5ヶ月累計', '備考'];
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow_(sheet, 'A2:I2', COLORS.DASHBOARD);

  // 指標データ設定（利益シートから5ヶ月分のデータを参照）
  const metrics = [
    ['月間売上', '=利益!B2', '=利益!B3', '=利益!B4', '=利益!B5', '=利益!B6', '=AVERAGE(B3:F3)', '=SUM(B3:F3)', '現在の売上合計'],
    ['経費合計', '=利益!C2', '=利益!C3', '=利益!C4', '=利益!C5', '=利益!C6', '=AVERAGE(B4:F4)', '=SUM(B4:F4)', '全経費の合計'],
    ['営業利益', '=利益!D2', '=利益!D3', '=利益!D4', '=利益!D5', '=利益!D6', '=AVERAGE(B5:F5)', '=SUM(B5:F5)', '売上-経費'],
    ['利益率', '=利益!E2', '=利益!E3', '=利益!E4', '=利益!E5', '=利益!E6', '=AVERAGE(B6:F6)', '', '営業利益率'],
    ['新規来店数', '=COUNTIF(売上!C:C,"新規")', '', '', '', '', '', '', ''],
    ['次回予約率', '=顧客!K101', '', '', '', '', '', '', '次回予約がある顧客率'],
    ['継続率', '=顧客!L101', '', '', '', '', '', '', '継続○の顧客率'],
    ['CPA', '=広告!G101', '', '', '', '', '', '', '顧客獲得単価'],
    ['LTV', '=広告!H101', '', '', '', '', '', '', '顧客生涯価値']
  ];

  sheet.getRange(3, 1, metrics.length, 9).setValues(metrics);

  // 書式設定
  setCurrencyFormat_(sheet, 'B3:H5');    // 売上、経費、営業利益
  setPercentFormat_(sheet, 'B6:H6');     // 利益率
  setCurrencyFormat_(sheet, 'B10:B11');  // CPA、LTV

  // 列幅調整
  autoResizeColumns_(sheet, 1, 9);
  sheet.setColumnWidth(1, 120);  // 指標
  sheet.setColumnWidth(2, 110);  // 2025/01
  sheet.setColumnWidth(3, 110);  // 2024/12
  sheet.setColumnWidth(4, 110);  // 2024/11
  sheet.setColumnWidth(5, 110);  // 2024/10
  sheet.setColumnWidth(6, 110);  // 2024/09
  sheet.setColumnWidth(7, 110);  // 平均
  sheet.setColumnWidth(8, 110);  // 累計
  sheet.setColumnWidth(9, 200);  // 備考

  // グラフ生成
  clearCharts_(sheet);

  console.log('Dashboard sheet built successfully');
}

/**
 * ダッシュボード再計算（グラフ再生成含む）
 */
function recalculateDashboard_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
  if (!sheet) {
    throw new Error('ダッシュボードシートが存在しません');
  }

  // グラフのクリアと再生成
  clearCharts_(sheet);

  // 売上・経費・利益の推移グラフ（折れ線）- 右上に配置（J列から）
  try {
    const profitSheet = ss.getSheetByName(SHEET_NAMES.PROFIT);
    if (profitSheet) {
      const chartBuilder = sheet.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(profitSheet.getRange('A1:D6'))
        .setPosition(2, 10, 0, 0)
        .setOption('title', '売上・経費・利益の推移（5ヶ月）')
        .setOption('width', 600)
        .setOption('height', 350)
        .setOption('legend', { position: 'bottom' })
        .setOption('hAxis', { title: '月', slantedText: true })
        .setOption('vAxis', { title: '金額（円）', format: '¥#,##0' })
        .setOption('series', {
          0: { labelInLegend: '売上合計', color: '#4285F4', lineWidth: 3 },
          1: { labelInLegend: '経費合計', color: '#EA4335', lineWidth: 3 },
          2: { labelInLegend: '営業利益', color: '#34A853', lineWidth: 3 }
        })
        .setOption('chartArea', { width: '75%', height: '70%' });

      sheet.insertChart(chartBuilder.build());
    }
  } catch (error) {
    console.warn('売上推移グラフ生成エラー:', error.message);
  }

  // 固定費vs売上グラフ（積み上げ棒）- 右下に配置（J列から）
  try {
    const expensesSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
    if (expensesSheet) {
      const chartBuilder = sheet.newChart()
        .setChartType(Charts.ChartType.COLUMN)
        .addRange(expensesSheet.getRange('A2:H6'))
        .setPosition(20, 10, 0, 0)
        .setOption('title', '経費内訳（月別）')
        .setOption('width', 600)
        .setOption('height', 350)
        .setOption('legend', { position: 'right' })
        .setOption('isStacked', true)
        .setOption('hAxis', { title: '月' })
        .setOption('vAxis', { title: '金額（円）', format: '¥#,##0' })
        .setOption('series', {
          0: { labelInLegend: '家賃', color: '#E57373' },
          1: { labelInLegend: '人件費', color: '#81C784' },
          2: { labelInLegend: '広告費', color: '#64B5F6' },
          3: { labelInLegend: '材料費', color: '#FFD54F' },
          4: { labelInLegend: '光熱費', color: '#BA68C8' },
          5: { labelInLegend: '雑費', color: '#4DB6AC' },
          6: { labelInLegend: 'システム費', color: '#FF8A65' }
        })
        .setOption('chartArea', { width: '70%', height: '70%' });

      sheet.insertChart(chartBuilder.build());
    }
  } catch (error) {
    console.warn('固定費vs売上グラフ生成エラー:', error.message);
  }

  SpreadsheetApp.flush();
  console.log('Dashboard recalculated successfully');
}
