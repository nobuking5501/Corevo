/**
 * シート操作ユーティリティ
 */

/**
 * シートの取得または作成（冪等）
 */
function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    console.log(`Created sheet: ${name}`);
  } else {
    console.log(`Sheet already exists: ${name}`);
    // 既存シートの場合、フィルタと内容をクリア
    clearSheetContent_(sheet);
  }
  return sheet;
}

/**
 * シートの内容とフィルタをクリア
 */
function clearSheetContent_(sheet) {
  try {
    // フィルタが存在する場合は削除
    const filter = sheet.getFilter();
    if (filter) {
      filter.remove();
      console.log(`Filter removed from sheet: ${sheet.getName()}`);
    }
  } catch (error) {
    console.warn(`Filter removal warning:`, error.message);
  }

  try {
    // グラフをクリア
    const charts = sheet.getCharts();
    charts.forEach(chart => sheet.removeChart(chart));
  } catch (error) {
    console.warn(`Chart removal warning:`, error.message);
  }

  try {
    // 条件付き書式をクリア
    const rules = sheet.getConditionalFormatRules();
    if (rules.length > 0) {
      sheet.clearConditionalFormatRules();
    }
  } catch (error) {
    console.warn(`Conditional format removal warning:`, error.message);
  }

  try {
    // データ検証をクリア（全範囲）
    sheet.getDataRange().clearDataValidations();
  } catch (error) {
    console.warn(`Data validation removal warning:`, error.message);
  }

  try {
    // 内容をクリア
    sheet.clear();
    console.log(`Content cleared from sheet: ${sheet.getName()}`);
  } catch (error) {
    console.warn(`Content clearing warning:`, error.message);
  }
}

/**
 * 範囲の保護（集計セル用）
 */
function protectRange_(sheet, rangeA1, description) {
  try {
    const range = sheet.getRange(rangeA1);
    const protection = range.protect().setDescription(description || '集計セル（自動計算）');

    // 実行ユーザのみ編集可能
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  } catch (error) {
    console.warn(`Protection warning for ${rangeA1}:`, error.message);
  }
}

/**
 * 名前付き範囲の設定
 */
function setNamedRange_(ss, name, rangeA1) {
  try {
    const existingRange = ss.getRangeByName(name);
    if (existingRange) {
      ss.removeNamedRange(name);
    }
    ss.setNamedRange(name, ss.getRange(rangeA1));
    console.log(`Named range set: ${name} = ${rangeA1}`);
  } catch (error) {
    console.warn(`Named range warning for ${name}:`, error.message);
  }
}

/**
 * すべての名前付き範囲を設定
 */
function setAllNamedRanges_(ss) {
  for (const key in NAMED_RANGES) {
    const { name, range } = NAMED_RANGES[key];
    setNamedRange_(ss, name, range);
  }
}

/**
 * 折れ線グラフ作成
 */
function createLineChart_(sheet, title, dataRange, xColumn, yColumn, position) {
  const chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(dataRange))
    .setPosition(position.row, position.col, position.offsetX || 0, position.offsetY || 0)
    .setOption('title', title)
    .setOption('legend', { position: 'bottom' })
    .setOption('hAxis', { title: xColumn })
    .setOption('vAxis', { title: yColumn });

  sheet.insertChart(chartBuilder.build());
}

/**
 * 棒グラフ作成
 */
function createColumnChart_(sheet, title, dataRange, position, isStacked) {
  const chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(dataRange))
    .setPosition(position.row, position.col, position.offsetX || 0, position.offsetY || 0)
    .setOption('title', title)
    .setOption('legend', { position: 'bottom' })
    .setOption('isStacked', isStacked || false);

  sheet.insertChart(chartBuilder.build());
}

/**
 * 既存グラフのクリア
 */
function clearCharts_(sheet) {
  const charts = sheet.getCharts();
  charts.forEach(chart => sheet.removeChart(chart));
}
