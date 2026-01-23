"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MigratePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const runMigration = async (dryRun: boolean) => {
    setIsRunning(true);
    setLogs([]);
    setResult(null);
    setError("");

    try {
      const migrate = httpsCallable(functions, "migrateToMultiTenant");
      const response = await migrate({ dryRun });
      const data = response.data as any;

      setLogs(data.logs || []);
      setResult(data);
    } catch (err: any) {
      console.error("Migration error:", err);
      setError(err.message || "移行中にエラーが発生しました");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">データ移行ツール</CardTitle>
            <CardDescription>
              既存のテナントデータを新しいマルチテナント構造に移行します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>⚠️ 重要:</strong> この操作は既存のデータ構造を変更します。
                まずドライラン（DRY RUN）で確認してください。
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={() => runMigration(true)}
                disabled={isRunning}
                variant="outline"
              >
                {isRunning ? "実行中..." : "ドライラン（確認のみ）"}
              </Button>
              <Button
                onClick={() => runMigration(false)}
                disabled={isRunning}
                variant="default"
              >
                {isRunning ? "実行中..." : "本番実行（データを変更）"}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-1">
                    <div>
                      <strong>
                        {result.dryRun ? "✅ ドライラン完了" : "✅ 移行完了"}
                      </strong>
                    </div>
                    <div>成功: {result.migrated} 件</div>
                    <div>スキップ: {result.skipped} 件（既に移行済み）</div>
                    {result.errors > 0 && (
                      <div className="text-red-600">エラー: {result.errors} 件</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {logs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">実行ログ:</h3>
                <div className="bg-black text-green-400 p-4 rounded-md overflow-auto max-h-96 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isRunning && logs.length === 0 && (
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>実行手順:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>まず「ドライラン」を実行して、どのデータが移行されるか確認します</li>
                  <li>問題がなければ「本番実行」を実行して、実際にデータを移行します</li>
                  <li>移行後、ブラウザをリロードしてログインし直してください</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
