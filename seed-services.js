/**
 * 脱毛サロンのサービスメニュー一括登録スクリプト
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Service Accountを読み込む
const serviceAccount = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));

// Firebase Admin初期化（本番環境）
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

// 脱毛サロンのサービスメニュー
const services = [
  // 身体（前面）
  {
    name: '胸',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '身体（前面）',
    setDiscountEligible: true,
    sortOrder: 1,
    description: 'セット対象',
    active: true
  },
  {
    name: 'お腹',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '身体（前面）',
    setDiscountEligible: true,
    sortOrder: 2,
    description: 'セット対象',
    active: true
  },
  {
    name: '両ワキ',
    price: 2200,
    durationMinutes: 15,
    marginCoefficient: 0.7,
    category: '身体（前面）',
    setDiscountEligible: false,
    sortOrder: 3,
    active: true
  },

  // 身体（背面）
  {
    name: 'うなじ',
    price: 2200,
    durationMinutes: 15,
    marginCoefficient: 0.7,
    category: '身体（背面）',
    setDiscountEligible: false,
    sortOrder: 4,
    active: true
  },
  {
    name: '背中',
    price: 8800,
    durationMinutes: 40,
    marginCoefficient: 0.7,
    category: '身体（背面）',
    setDiscountEligible: true,
    sortOrder: 5,
    description: 'セット対象',
    active: true
  },
  {
    name: 'おしり',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '身体（背面）',
    setDiscountEligible: true,
    sortOrder: 6,
    description: 'セット対象',
    active: true
  },

  // 顔
  {
    name: '顔（男性:髭のみ）',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '顔',
    setDiscountEligible: true,
    sortOrder: 7,
    description: 'セット対象',
    active: true
  },
  {
    name: '顔（女性:全顔）',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '顔',
    setDiscountEligible: true,
    sortOrder: 8,
    description: 'セット対象',
    active: true
  },
  {
    name: 'ホホ（オプション）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.7,
    category: '顔',
    setDiscountEligible: false,
    sortOrder: 9,
    description: 'オプション',
    active: true
  },
  {
    name: 'おでこ（オプション）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.7,
    category: '顔',
    setDiscountEligible: false,
    sortOrder: 10,
    description: 'オプション',
    active: true
  },

  // 手
  {
    name: '両腕（二の腕+ひじ下）',
    price: 8800,
    durationMinutes: 45,
    marginCoefficient: 0.7,
    category: '手',
    setDiscountEligible: true,
    sortOrder: 11,
    description: 'セット対象',
    active: true
  },
  {
    name: '二の腕のみ',
    price: 4400,
    durationMinutes: 25,
    marginCoefficient: 0.7,
    category: '手',
    setDiscountEligible: false,
    sortOrder: 12,
    active: true
  },
  {
    name: 'ひじ下のみ',
    price: 4400,
    durationMinutes: 25,
    marginCoefficient: 0.7,
    category: '手',
    setDiscountEligible: false,
    sortOrder: 13,
    active: true
  },
  {
    name: '両手（甲・指）',
    price: 1100,
    durationMinutes: 15,
    marginCoefficient: 0.7,
    category: '手',
    setDiscountEligible: false,
    sortOrder: 14,
    active: true
  },

  // 足
  {
    name: '両足（もも+すね）',
    price: 8800,
    durationMinutes: 50,
    marginCoefficient: 0.7,
    category: '足',
    setDiscountEligible: true,
    sortOrder: 15,
    description: 'セット対象',
    active: true
  },
  {
    name: 'もものみ',
    price: 4400,
    durationMinutes: 30,
    marginCoefficient: 0.7,
    category: '足',
    setDiscountEligible: false,
    sortOrder: 16,
    active: true
  },
  {
    name: 'すねのみ',
    price: 4400,
    durationMinutes: 25,
    marginCoefficient: 0.7,
    category: '足',
    setDiscountEligible: false,
    sortOrder: 17,
    active: true
  },
  {
    name: '両足の甲',
    price: 1100,
    durationMinutes: 15,
    marginCoefficient: 0.7,
    category: '足',
    setDiscountEligible: false,
    sortOrder: 18,
    active: true
  },

  // VIO
  {
    name: 'VIO（ハイジニーナ）',
    price: 8800,
    durationMinutes: 45,
    marginCoefficient: 0.7,
    category: 'VIO',
    setDiscountEligible: true,
    sortOrder: 19,
    description: 'セット対象',
    active: true
  },
  {
    name: 'Vライン（単部位）',
    price: 3300,
    durationMinutes: 20,
    marginCoefficient: 0.7,
    category: 'VIO',
    setDiscountEligible: false,
    sortOrder: 20,
    active: true
  },
  {
    name: 'Iライン（単部位）',
    price: 3300,
    durationMinutes: 20,
    marginCoefficient: 0.7,
    category: 'VIO',
    setDiscountEligible: false,
    sortOrder: 21,
    active: true
  },
  {
    name: 'Oライン',
    price: 3300,
    durationMinutes: 20,
    marginCoefficient: 0.7,
    category: 'VIO',
    setDiscountEligible: false,
    sortOrder: 22,
    active: true
  },

  // その他
  {
    name: 'シェービング（有料）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: 'その他',
    setDiscountEligible: false,
    sortOrder: 23,
    description: '手の届く部位',
    active: true
  },
  {
    name: 'シェービング（無料）',
    price: 0,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: 'その他',
    setDiscountEligible: false,
    sortOrder: 24,
    description: 'うなじ・背中（手が届かない部位）',
    active: true
  }
];

async function seedServices() {
  try {
    console.log('🔍 テナント「ディープ＆モア」を検索中...\n');

    // テナント名で検索
    const tenantsSnapshot = await db.collection('tenants')
      .where('name', '==', 'ディープ＆モア')
      .limit(1)
      .get();

    if (tenantsSnapshot.empty) {
      console.error('❌ テナント「ディープ＆モア」が見つかりません。');
      console.error('   test@example.com でログインしているテナント名を確認してください。');
      process.exit(1);
    }

    const tenantId = tenantsSnapshot.docs[0].id;
    const tenantData = tenantsSnapshot.docs[0].data();
    console.log(`✓ テナント: ${tenantData.name} (${tenantId})\n`);

    // 既存のサービスを取得
    console.log('🗑️  既存のサービスを確認中...\n');
    const existingServicesSnapshot = await db.collection(`tenants/${tenantId}/services`).get();

    if (!existingServicesSnapshot.empty) {
      console.log(`   ${existingServicesSnapshot.size}件の既存サービスを削除中...\n`);

      // バッチ削除（500件ずつ）
      const batch = db.batch();
      let deleteCount = 0;

      existingServicesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
        console.log(`   - ${doc.data().name} を削除`);
      });

      await batch.commit();
      console.log(`\n   ✓ ${deleteCount}件のサービスを削除しました\n`);
    } else {
      console.log('   既存のサービスはありません\n');
    }

    console.log('📝 新しいサービスメニューを登録中...\n');

    let count = 0;
    for (const service of services) {
      await db.collection(`tenants/${tenantId}/services`).add({
        tenantId,
        ...service,
        tags: [],
        promotionPriority: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
      console.log(`  ${count}. ${service.name} - ¥${service.price.toLocaleString()} ${service.setDiscountEligible ? '★' : ''}`);
    }

    console.log('\n========================================');
    console.log(`✅ ${count}件のサービスメニューを登録しました`);
    console.log('========================================\n');

    console.log('💡 セット割引ルール:');
    console.log('  2箇所: 20%OFF');
    console.log('  3箇所: 30%OFF');
    console.log('  4箇所: 40%OFF');
    console.log('  5箇所以上: 50%OFF\n');

    console.log('★マークがセット割引対象のサービスです。\n');

    process.exit(0);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

seedServices();
