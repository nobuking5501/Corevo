"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function AIPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI提案キュー</h1>
          <p className="text-gray-500">顧客へのメッセージ提案の承認と送信</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              承認待ち提案
            </CardTitle>
            <CardDescription>AIが生成した顧客へのメッセージ案を確認・承認してください</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="mx-auto h-12 w-12 mb-4 text-gray-300" />
              <p>承認待ちの提案はありません</p>
              <p className="text-sm mt-2">夜間バッチ（03:00）で新しい提案が生成されます</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
