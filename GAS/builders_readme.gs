/**
 * 使い方シート構築
 */
function buildReadmeSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '使い方');

  // 既存の内容をクリア
  sheet.clear();

  // タイトル
  sheet.getRange('A1').setValue('📊 脱毛サロン業績管理テンプレート 使い方ガイド');
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold').setBackground('#4285F4').setFontColor('#FFFFFF');
  sheet.setRowHeight(1, 40);

  // セクション1：基本的な使い方
  let row = 3;
  sheet.getRange(`A${row}`).setValue('🚀 基本的な使い方');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#E8F5E9');
  row++;

  sheet.getRange(`A${row}`).setValue('1. 日々の売上を「売上」シートに入力');
  row++;
  sheet.getRange(`A${row}`).setValue('2. 月次で「広告」「経費」シートを更新');
  row++;
  sheet.getRange(`A${row}`).setValue('3. 「ダッシュボード」で主要指標を確認');
  row++;
  sheet.getRange(`A${row}`).setValue('4. 問題があれば「改善アクション」シートに記録');
  row += 2;

  // セクション2：追いかけるべき重要指標
  sheet.getRange(`A${row}`).setValue('🎯 追いかけるべき重要指標（KPI）');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#FFF8E1');
  row++;

  sheet.getRange(`A${row}:D${row}`).setValues([['指標', '目標値', '確認頻度', '改善アクション']]);
  sheet.getRange(`A${row}:D${row}`).setFontWeight('bold').setBackground('#F5F5F5');
  row++;

  const kpiData = [
    ['営業利益', '月30万円以上', '週次', '経費削減または売上向上策を実施'],
    ['利益率', '20%以上', '週次', '15%以下なら経費構造を見直し'],
    ['次回予約率', '80%以上', '週次', '施術品質や接客を改善'],
    ['継続率', '85%以上', '月次', '70%以下は解約理由を分析'],
    ['CPA（顧客獲得単価）', '15,000円以下', '月次', '効率の悪い媒体は予算を削減'],
    ['ROI（投資対効果）', '150%以上', '月次', '負の値は即座に広告を見直し'],
    ['新規来店数', '月20名以上', '月次', '減少傾向なら広告強化'],
    ['平均客単価', '150,000円以上', '月次', '高額コースの提案を強化'],
    ['スタッフ別売上', '月100万円以上/人', '月次', '研修や配置転換を検討']
  ];

  sheet.getRange(row, 1, kpiData.length, 4).setValues(kpiData);
  sheet.getRange(row, 1, kpiData.length, 4).setBorder(true, true, true, true, true, true);
  row += kpiData.length + 2;

  // セクション3：月次レビューのやり方
  sheet.getRange(`A${row}`).setValue('📋 月次レビューのやり方（毎月5日実施）');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#E3F2FD');
  row++;

  sheet.getRange(`A${row}`).setValue('1. ダッシュボードを開く');
  row++;
  sheet.getRange(`A${row}`).setValue('2. 以下を確認：');
  row++;
  sheet.getRange(`A${row}`).setValue('   ✓ 営業利益が目標達成か？');
  row++;
  sheet.getRange(`A${row}`).setValue('   ✓ 利益率は20%以上か？');
  row++;
  sheet.getRange(`A${row}`).setValue('   ✓ 継続率は85%以上か？');
  row++;
  sheet.getRange(`A${row}`).setValue('   ✓ 広告のROIは黒字か？');
  row++;
  sheet.getRange(`A${row}`).setValue('3. 「改善アクション」シートに課題と対策を記録');
  row++;
  sheet.getRange(`A${row}`).setValue('4. 翌月に効果を測定して記録');
  row += 2;

  // セクション4：よくある改善パターン
  sheet.getRange(`A${row}`).setValue('💡 よくある改善パターン');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#F3E5F5');
  row++;

  sheet.getRange(`A${row}`).setValue('【利益率が低い場合】');
  sheet.getRange(`A${row}`).setFontWeight('bold');
  row++;
  sheet.getRange(`A${row}`).setValue('・人件費が売上の40%超 → 採用見直し');
  row++;
  sheet.getRange(`A${row}`).setValue('・広告費が売上の30%超 → 媒体を絞る');
  row++;
  sheet.getRange(`A${row}`).setValue('・材料費が高い → 仕入れ先の見直し');
  row += 2;

  sheet.getRange(`A${row}`).setValue('【継続率が低い場合】');
  sheet.getRange(`A${row}`).setFontWeight('bold');
  row++;
  sheet.getRange(`A${row}`).setValue('・施術技術の向上（研修実施）');
  row++;
  sheet.getRange(`A${row}`).setValue('・次回予約のタイミング改善');
  row++;
  sheet.getRange(`A${row}`).setValue('・カウンセリングの質向上');
  row++;
  sheet.getRange(`A${row}`).setValue('・価格設定の見直し');
  row += 2;

  sheet.getRange(`A${row}`).setValue('【新規獲得が不足】');
  sheet.getRange(`A${row}`).setFontWeight('bold');
  row++;
  sheet.getRange(`A${row}`).setValue('・Instagram広告の強化');
  row++;
  sheet.getRange(`A${row}`).setValue('・ホットペッパーの掲載順位UP');
  row++;
  sheet.getRange(`A${row}`).setValue('・紹介キャンペーン実施');
  row++;
  sheet.getRange(`A${row}`).setValue('・Googleマイビジネスの最適化');
  row += 2;

  // セクション5：各シートの説明
  sheet.getRange(`A${row}`).setValue('📝 各シートの説明');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#FFF3E0');
  row++;

  const sheetDescriptions = [
    ['ダッシュボード', '主要指標を自動集計して表示'],
    ['売上', '日々の売上データを入力（顧客名・メニュー・金額など）'],
    ['広告', '広告媒体ごとの実績を月単位で管理'],
    ['顧客', '顧客情報と継続状況を管理'],
    ['経費', '月次の固定費・変動費を入力'],
    ['利益', '売上と経費から営業利益を自動計算'],
    ['スタッフ', 'スタッフごとの実績を管理'],
    ['改善アクション', '課題と改善施策を記録・追跡']
  ];

  sheet.getRange(row, 1, sheetDescriptions.length, 2).setValues(sheetDescriptions);
  sheet.getRange(row, 1, sheetDescriptions.length, 1).setFontWeight('bold');
  row += sheetDescriptions.length + 2;

  // セクション6：トラブルシューティング
  sheet.getRange(`A${row}`).setValue('🔧 トラブルシューティング');
  sheet.getRange(`A${row}`).setFontSize(14).setFontWeight('bold').setBackground('#FFEBEE');
  row++;

  sheet.getRange(`A${row}`).setValue('#REF! エラー → 参照先シートが存在しない。初期構築を再実行');
  row++;
  sheet.getRange(`A${row}`).setValue('#DIV/0! エラー → ゼロ除算。データを入力してから確認');
  row++;
  sheet.getRange(`A${row}`).setValue('#VALUE! エラー → 型エラー。数値項目に文字が入っていないか確認');
  row += 2;

  // フッター
  sheet.getRange(`A${row}`).setValue('🎉 このテンプレートを活用して、サロン経営を成功させましょう！');
  sheet.getRange(`A${row}`).setFontSize(12).setFontWeight('bold').setFontColor('#4285F4');

  // 列幅調整
  sheet.setColumnWidth(1, 400);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 300);

  // シートをタブの最後に移動
  sheet.activate();
  ss.moveActiveSheet(ss.getNumSheets());

  console.log('README sheet built successfully');
}
