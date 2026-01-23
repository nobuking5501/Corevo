#!/usr/bin/env node

/**
 * 脱毛サロンメニューを一括登録するスクリプト
 *
 * 使い方:
 * node infra/scripts/seed-salon-menu.js <tenantId>
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || "./service-account-key.json";

try {
  const serviceAccountData = JSON.parse(readFileSync(serviceAccount, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountData),
  });
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  console.log("Please provide service account JSON file or set FIREBASE_SERVICE_ACCOUNT env var");
  process.exit(1);
}

const db = admin.firestore();

// 脱毛サロンメニューデータ
const salonMenus = [
  // 顔
  {
    name: '男性:髭のみ / 女性:全顔',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.8,
    category: '顔',
    description: '顔全体の脱毛',
    setDiscountEligible: true,
    sortOrder: 1,
    active: true
  },
  {
    name: 'ホホ（オプション）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: '顔',
    description: 'ホホのみの脱毛',
    setDiscountEligible: false,
    sortOrder: 2,
    active: true
  },
  {
    name: 'おでこ（オプション）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: '顔',
    description: 'おでこのみの脱毛',
    setDiscountEligible: false,
    sortOrder: 3,
    active: true
  },

  // 手
  {
    name: '両腕（二の腕+ひじ下）',
    price: 8800,
    durationMinutes: 40,
    marginCoefficient: 0.8,
    category: '手',
    description: '両腕全体の脱毛',
    setDiscountEligible: true,
    sortOrder: 4,
    active: true
  },
  {
    name: '二の腕のみ',
    price: 4400,
    durationMinutes: 20,
    marginCoefficient: 0.8,
    category: '手',
    description: '二の腕のみの脱毛',
    setDiscountEligible: false,
    sortOrder: 5,
    active: true
  },
  {
    name: 'ひじ下のみ',
    price: 4400,
    durationMinutes: 20,
    marginCoefficient: 0.8,
    category: '手',
    description: 'ひじ下のみの脱毛',
    setDiscountEligible: false,
    sortOrder: 6,
    active: true
  },
  {
    name: '両手（甲・指）',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: '手',
    description: '両手の甲と指の脱毛',
    setDiscountEligible: false,
    sortOrder: 7,
    active: true
  },

  // 足
  {
    name: '両足（もも+すね）',
    price: 8800,
    durationMinutes: 50,
    marginCoefficient: 0.8,
    category: '足',
    description: '両足全体の脱毛',
    setDiscountEligible: true,
    sortOrder: 8,
    active: true
  },
  {
    name: 'もものみ',
    price: 4400,
    durationMinutes: 25,
    marginCoefficient: 0.8,
    category: '足',
    description: 'もものみの脱毛',
    setDiscountEligible: false,
    sortOrder: 9,
    active: true
  },
  {
    name: 'すねのみ',
    price: 4400,
    durationMinutes: 25,
    marginCoefficient: 0.8,
    category: '足',
    description: 'すねのみの脱毛',
    setDiscountEligible: false,
    sortOrder: 10,
    active: true
  },
  {
    name: '両足の甲',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.8,
    category: '足',
    description: '両足の甲の脱毛',
    setDiscountEligible: false,
    sortOrder: 11,
    active: true
  },

  // VIO
  {
    name: 'VIO（ハイジニーナ）',
    price: 8800,
    durationMinutes: 40,
    marginCoefficient: 0.8,
    category: 'VIO',
    description: 'VIOライン全体の脱毛',
    setDiscountEligible: true,
    sortOrder: 12,
    active: true
  },
  {
    name: 'Vライン（単部位）',
    price: 3300,
    durationMinutes: 15,
    marginCoefficient: 0.8,
    category: 'VIO',
    description: 'Vラインのみの脱毛',
    setDiscountEligible: false,
    sortOrder: 13,
    active: true
  },
  {
    name: 'Iライン（単部位）',
    price: 3300,
    durationMinutes: 15,
    marginCoefficient: 0.8,
    category: 'VIO',
    description: 'Iラインのみの脱毛',
    setDiscountEligible: false,
    sortOrder: 14,
    active: true
  },
  {
    name: 'Oライン',
    price: 3300,
    durationMinutes: 15,
    marginCoefficient: 0.8,
    category: 'VIO',
    description: 'Oラインの脱毛',
    setDiscountEligible: false,
    sortOrder: 15,
    active: true
  },

  // 身体（前面）
  {
    name: '胸',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.8,
    category: '身体（前面）',
    description: '胸部の脱毛',
    setDiscountEligible: true,
    sortOrder: 16,
    active: true
  },
  {
    name: 'お腹',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.8,
    category: '身体（前面）',
    description: 'お腹の脱毛',
    setDiscountEligible: true,
    sortOrder: 17,
    active: true
  },
  {
    name: '両ワキ',
    price: 2200,
    durationMinutes: 15,
    marginCoefficient: 0.8,
    category: '身体（前面）',
    description: '両ワキの脱毛',
    setDiscountEligible: false,
    sortOrder: 18,
    active: true
  },

  // 身体（背面）
  {
    name: 'うなじ',
    price: 2200,
    durationMinutes: 15,
    marginCoefficient: 0.8,
    category: '身体（背面）',
    description: 'うなじの脱毛（無料シェービング付き）',
    setDiscountEligible: false,
    sortOrder: 19,
    active: true
  },
  {
    name: '背中',
    price: 8800,
    durationMinutes: 40,
    marginCoefficient: 0.8,
    category: '身体（背面）',
    description: '背中全体の脱毛（無料シェービング付き）',
    setDiscountEligible: true,
    sortOrder: 20,
    active: true
  },
  {
    name: 'おしり',
    price: 6600,
    durationMinutes: 30,
    marginCoefficient: 0.8,
    category: '身体（背面）',
    description: 'おしりの脱毛',
    setDiscountEligible: true,
    sortOrder: 21,
    active: true
  },

  // その他
  {
    name: 'シェービング',
    price: 1100,
    durationMinutes: 10,
    marginCoefficient: 0.9,
    category: 'その他',
    description: 'シェービングサービス（※うなじ・背中は無料）',
    setDiscountEligible: false,
    sortOrder: 22,
    active: true
  }
];

async function seedSalonMenu(tenantId) {
  try {
    console.log(`\n脱毛サロンメニューを登録します...`);
    console.log(`テナントID: ${tenantId}`);
    console.log(`登録メニュー数: ${salonMenus.length}件\n`);

    const batch = db.batch();
    let count = 0;

    for (const menu of salonMenus) {
      const serviceRef = db.collection(`tenants/${tenantId}/services`).doc();

      const serviceData = {
        tenantId: tenantId,
        name: menu.name,
        price: menu.price,
        durationMinutes: menu.durationMinutes,
        marginCoefficient: menu.marginCoefficient,
        category: menu.category,
        description: menu.description,
        setDiscountEligible: menu.setDiscountEligible,
        sortOrder: menu.sortOrder,
        active: menu.active,
        tags: [],
        promotionPriority: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.set(serviceRef, serviceData);
      count++;

      console.log(`${count}. ${menu.name} (¥${menu.price.toLocaleString()}) ${menu.setDiscountEligible ? '★' : ''}`);
    }

    await batch.commit();

    console.log(`\n✓ ${count}件のメニューを登録しました！`);
    console.log('\n★マークはセット割引対象メニューです');
    console.log('セット割引: 2箇所20%OFF / 3箇所30%OFF / 4箇所40%OFF / 5箇所以上50%OFF');

  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  }
}

// メイン実行
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('使い方: node infra/scripts/seed-salon-menu.js <tenantId>');
  console.error('例: node infra/scripts/seed-salon-menu.js tenant_abc123');
  process.exit(1);
}

seedSalonMenu(tenantId)
  .then(() => {
    console.log('\n完了しました！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('失敗しました:', error);
    process.exit(1);
  });
