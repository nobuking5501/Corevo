"use client";

import { MainLayout } from "@/components/layout/MainLayout";

export default function BillingPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">請求管理</h1>
        <p className="text-gray-500">Stripe 連携（実装準備完了）</p>
      </div>
    </MainLayout>
  );
}
