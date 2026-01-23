/**
 * 価格計算ユーティリティ
 * セット割引、動的価格計算などを提供
 */

import { Service } from "@/types";

// デフォルトのセット割引ルール
// 2箇所: 20%OFF, 3箇所: 30%OFF, 4箇所: 40%OFF, 5箇所以上: 50%OFF
export const DEFAULT_DISCOUNT_RULES = [
  { quantity: 2, discountRate: 0.2 },
  { quantity: 3, discountRate: 0.3 },
  { quantity: 4, discountRate: 0.4 },
  { quantity: 5, discountRate: 0.5 },
];

/**
 * セット割引率を取得
 * @param eligibleCount セット割引対象のサービス数
 * @returns 割引率（0.0 ~ 1.0）
 */
export function getDiscountRate(eligibleCount: number): number {
  if (eligibleCount < 2) return 0;

  // ルールを降順でソートして、最大の適用可能な割引を見つける
  const sortedRules = [...DEFAULT_DISCOUNT_RULES].sort((a, b) => b.quantity - a.quantity);

  for (const rule of sortedRules) {
    if (eligibleCount >= rule.quantity) {
      return rule.discountRate;
    }
  }

  return 0;
}

/**
 * 選択されたサービスの合計金額を計算（割引前）
 * @param services 選択されたサービスのリスト
 * @returns 合計金額
 */
export function calculateSubtotal(services: Service[]): number {
  return services.reduce((sum, service) => sum + service.price, 0);
}

/**
 * セット割引対象のサービス数をカウント
 * @param services 選択されたサービスのリスト
 * @returns セット割引対象のサービス数
 */
export function countEligibleServices(services: Service[]): number {
  return services.filter(s => s.setDiscountEligible).length;
}

/**
 * 割引額を計算
 * @param services 選択されたサービスのリスト
 * @returns 割引額
 */
export function calculateDiscount(services: Service[]): number {
  const eligibleServices = services.filter(s => s.setDiscountEligible);
  const eligibleCount = eligibleServices.length;

  if (eligibleCount < 2) return 0;

  const discountRate = getDiscountRate(eligibleCount);
  const eligibleSubtotal = eligibleServices.reduce((sum, s) => sum + s.price, 0);

  return Math.floor(eligibleSubtotal * discountRate);
}

/**
 * 最終金額を計算（割引適用後）
 * @param services 選択されたサービスのリスト
 * @returns 最終金額
 */
export function calculateTotal(services: Service[]): number {
  const subtotal = calculateSubtotal(services);
  const discount = calculateDiscount(services);

  return subtotal - discount;
}

/**
 * 合計所要時間を計算
 * @param services 選択されたサービスのリスト
 * @returns 合計所要時間（分）
 */
export function calculateTotalDuration(services: Service[]): number {
  return services.reduce((sum, service) => sum + service.durationMinutes, 0);
}

/**
 * 価格計算の詳細を取得
 * @param services 選択されたサービスのリスト
 * @returns 価格計算の詳細情報
 */
export interface PricingBreakdown {
  subtotal: number;
  discount: number;
  discountRate: number;
  total: number;
  eligibleCount: number;
  totalDuration: number;
}

export function getPricingBreakdown(services: Service[]): PricingBreakdown {
  const eligibleCount = countEligibleServices(services);
  const discountRate = getDiscountRate(eligibleCount);
  const subtotal = calculateSubtotal(services);
  const discount = calculateDiscount(services);
  const total = subtotal - discount;
  const totalDuration = calculateTotalDuration(services);

  return {
    subtotal,
    discount,
    discountRate,
    total,
    eligibleCount,
    totalDuration,
  };
}

/**
 * 割引説明テキストを生成
 * @param eligibleCount セット割引対象のサービス数
 * @returns 割引説明テキスト
 */
export function getDiscountDescription(eligibleCount: number): string {
  if (eligibleCount < 2) return "";

  const rate = getDiscountRate(eligibleCount);
  const percentage = Math.floor(rate * 100);

  return `${eligibleCount}箇所セット割引: ${percentage}%OFF`;
}
