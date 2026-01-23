/**
 * 週次レポート自動生成ユーティリティ
 */

/**
 * 週次レポート生成（PDCAダッシュボードを更新）
 */
function generateWeeklyReport_(ss) {
  const dashboard = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
  const pdca = ss.getSheetByName(SHEET_NAMES.PDCA_DASHBOARD);

  if (!dashboard || !pdca) {
    throw new Error('必要なシートが存在しません');
  }

  // 現在日時を記録
  const now = new Date();
  pdca.getRange('A2').setValue(`最終更新: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')}`);

  console.log('Weekly report generated successfully');
}

/**
 * KPIチェックと要注意項目の抽出
 */
function checkKPIAlerts_(ss) {
  const alerts = [];

  try {
    // 利益率チェック
    const profitMargin = ss.getSheetByName(SHEET_NAMES.DASHBOARD).getRange('B6').getValue();
    if (profitMargin < KPI_TARGETS.PROFIT_MARGIN) {
      alerts.push({
        kpi: '利益率',
        actual: profitMargin,
        target: KPI_TARGETS.PROFIT_MARGIN,
        message: `利益率が目標${(KPI_TARGETS.PROFIT_MARGIN * 100).toFixed(0)}%を下回っています（実績: ${(profitMargin * 100).toFixed(1)}%）`
      });
    }

    // 継続率チェック
    const continuationRate = ss.getSheetByName(SHEET_NAMES.CUSTOMERS).getRange('L101').getValue();
    if (continuationRate < KPI_TARGETS.CONTINUATION_RATE) {
      alerts.push({
        kpi: '継続率',
        actual: continuationRate,
        target: KPI_TARGETS.CONTINUATION_RATE,
        message: `継続率が目標${(KPI_TARGETS.CONTINUATION_RATE * 100).toFixed(0)}%を下回っています（実績: ${(continuationRate * 100).toFixed(1)}%）`
      });
    }

    // 新規来店数チェック
    const newCustomers = ss.getSheetByName(SHEET_NAMES.DASHBOARD).getRange('B7').getValue();
    if (newCustomers < KPI_TARGETS.NEW_CUSTOMERS_MONTHLY) {
      alerts.push({
        kpi: '新規来店数',
        actual: newCustomers,
        target: KPI_TARGETS.NEW_CUSTOMERS_MONTHLY,
        message: `新規来店数が目標${KPI_TARGETS.NEW_CUSTOMERS_MONTHLY}名を下回っています（実績: ${newCustomers}名）`
      });
    }

    // CPAチェック
    const cpa = ss.getSheetByName(SHEET_NAMES.ADS).getRange('G101').getValue();
    if (cpa > KPI_TARGETS.CPA_MAX) {
      alerts.push({
        kpi: 'CPA',
        actual: cpa,
        target: KPI_TARGETS.CPA_MAX,
        message: `CPAが目標${KPI_TARGETS.CPA_MAX.toLocaleString()}円を超過しています（実績: ${cpa.toLocaleString()}円）`
      });
    }

  } catch (error) {
    console.error('KPI check error:', error.message);
  }

  return alerts;
}

/**
 * 月次レポート生成
 */
function generateMonthlyReport_(ss) {
  const report = {
    period: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月'),
    kpiSummary: {},
    topActions: [],
    recommendations: []
  };

  try {
    const dashboard = ss.getSheetByName(SHEET_NAMES.DASHBOARD);

    // KPIサマリー取得
    report.kpiSummary = {
      sales: dashboard.getRange('B3').getValue(),
      profit: dashboard.getRange('B5').getValue(),
      profitMargin: dashboard.getRange('B6').getValue(),
      newCustomers: dashboard.getRange('B7').getValue(),
      continuationRate: ss.getSheetByName(SHEET_NAMES.CUSTOMERS).getRange('L101').getValue()
    };

    // 推奨アクション生成
    if (report.kpiSummary.profitMargin < KPI_TARGETS.PROFIT_MARGIN) {
      report.recommendations.push('利益率向上: 経費削減または売上単価アップ施策が必要');
    }
    if (report.kpiSummary.continuationRate < KPI_TARGETS.CONTINUATION_RATE) {
      report.recommendations.push('継続率向上: LINEフォローアップ・特典付与を実施');
    }
    if (report.kpiSummary.newCustomers < KPI_TARGETS.NEW_CUSTOMERS_MONTHLY) {
      report.recommendations.push('新規獲得強化: 広告予算増額・紹介キャンペーン実施');
    }

  } catch (error) {
    console.error('Monthly report generation error:', error.message);
  }

  return report;
}

/**
 * レポートをメール送信（オプション）
 */
function sendWeeklyReportEmail_(ss) {
  try {
    const alerts = checkKPIAlerts_(ss);

    if (alerts.length === 0) {
      console.log('No alerts to send');
      return;
    }

    let emailBody = '【週次KPIアラート】\n\n';
    emailBody += `以下のKPIが目標を下回っています：\n\n`;

    alerts.forEach(alert => {
      emailBody += `・${alert.message}\n`;
    });

    emailBody += `\n詳細は業績管理シートをご確認ください。`;

    // メール送信（実際の送信先はユーザーが設定）
    // MailApp.sendEmail({
    //   to: 'manager@example.com',
    //   subject: '【業績アラート】目標未達KPIがあります',
    //   body: emailBody
    // });

    console.log('Email would be sent:', emailBody);

  } catch (error) {
    console.error('Email sending error:', error.message);
  }
}
