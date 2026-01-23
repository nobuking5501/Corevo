"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { useAuth } from "@/lib/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export default function LineSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // LINE設定
  const [lineSettings, setLineSettings] = useState({
    channelAccessToken: "",
    channelSecret: "",
    liffId: "",
    enabled: false,
  });

  // テナント情報
  const [plan, setPlan] = useState<string>("");
  const [webhookUrl, setWebhookUrl] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        // ユーザーのテナントIDを取得
        const token = await user.getIdTokenResult();
        const tenantIds = token.claims.tenantIds as string[] | undefined;

        if (!tenantIds || tenantIds.length === 0) {
          setError("テナント情報が見つかりません");
          setLoading(false);
          return;
        }

        const currentTenantId = tenantIds[0];
        setTenantId(currentTenantId);

        // テナント情報を取得
        const tenantDoc = await getDoc(doc(db, "tenants", currentTenantId));

        if (!tenantDoc.exists()) {
          setError("テナント情報が見つかりません");
          setLoading(false);
          return;
        }

        const tenantData = tenantDoc.data();
        const settings = tenantData?.settings || {};
        const lineConfig = settings?.line || {};
        const featureFlags = settings?.featureFlags || {};

        // プラン情報を取得
        setPlan(tenantData?.plan || "free");

        // Webhook URLを生成
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "corevo-e1a8b";
        setWebhookUrl(`https://asia-northeast1-${projectId}.cloudfunctions.net/lineWebhook`);

        // LINE設定を取得
        setLineSettings({
          channelAccessToken: lineConfig?.channelAccessToken || "",
          channelSecret: lineConfig?.channelSecret || "",
          liffId: lineConfig?.liffId || "",
          enabled: featureFlags?.lineIntegration || false,
        });
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("設定の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // 設定を保存
      const tenantRef = doc(db, "tenants", tenantId);
      await updateDoc(tenantRef, {
        "settings.line.channelAccessToken": lineSettings.channelAccessToken,
        "settings.line.channelSecret": lineSettings.channelSecret,
        "settings.line.liffId": lineSettings.liffId,
        "settings.featureFlags.lineIntegration": lineSettings.enabled,
        updatedAt: new Date(),
      });

      setSuccess("設定を保存しました");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!tenantId) return;

    setTesting(true);
    setError("");
    setSuccess("");

    try {
      // テスト送信（管理者自身にメッセージを送信）
      const sendMessage = httpsCallable(functions, "sendLineMessage");
      await sendMessage({
        tenantId,
        customerId: "test", // 実際にはテストユーザーIDを指定
        messageBody: "LINE連携のテストメッセージです",
      });

      setSuccess("テストメッセージを送信しました");
    } catch (err: any) {
      console.error("Failed to test connection:", err);
      setError(`接続テストに失敗しました: ${err.message || "不明なエラー"}`);
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("クリップボードにコピーしました");
    setTimeout(() => setSuccess(""), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsLayout>
      <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">LINE連携設定</h1>
        <p className="text-gray-600 mt-2">
          LINE Official Accountと連携して、顧客に予約リマインダーやメッセージを送信できます。
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Webhook URL */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              LINE Developers ConsoleのWebhook設定に以下のURLを登録してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1 font-mono text-sm" />
              <Button onClick={() => copyToClipboard(webhookUrl)} variant="outline">
                コピー
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              ※ Messaging API設定 → Webhook URL に上記URLを設定してください
            </p>
          </CardContent>
        </Card>

        {/* LINE認証情報 */}
        <Card>
          <CardHeader>
            <CardTitle>LINE認証情報</CardTitle>
            <CardDescription>
              LINE Developers Consoleから取得した情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="channelAccessToken">Channel Access Token</Label>
              <Input
                id="channelAccessToken"
                type="password"
                value={lineSettings.channelAccessToken}
                onChange={(e) =>
                  setLineSettings({ ...lineSettings, channelAccessToken: e.target.value })
                }
                placeholder="Channel Access Tokenを入力"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Messaging API設定 → チャネルアクセストークン から取得
              </p>
            </div>

            <div>
              <Label htmlFor="channelSecret">Channel Secret</Label>
              <Input
                id="channelSecret"
                type="password"
                value={lineSettings.channelSecret}
                onChange={(e) =>
                  setLineSettings({ ...lineSettings, channelSecret: e.target.value })
                }
                placeholder="Channel Secretを入力"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                チャネル基本設定 → Channel Secret から取得
              </p>
            </div>

            <div>
              <Label htmlFor="liffId">LIFF ID</Label>
              <Input
                id="liffId"
                type="text"
                value={lineSettings.liffId}
                onChange={(e) =>
                  setLineSettings({ ...lineSettings, liffId: e.target.value })
                }
                placeholder="例: 1234567890-abcdefgh"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                LIFF → 作成したLIFFアプリのLIFF ID を入力
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={lineSettings.enabled}
                onChange={(e) =>
                  setLineSettings({ ...lineSettings, enabled: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                LINE連携を有効にする
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* LIFF設定 */}
        {lineSettings.liffId && (
          <Card>
            <CardHeader>
              <CardTitle>LIFF予約ページ</CardTitle>
              <CardDescription>
                顧客が使用する予約ページのURLです。リッチメニューに設定してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>LIFF URL（予約ページ）</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={`https://liff.line.me/${lineSettings.liffId}`}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      onClick={() => copyToClipboard(`https://liff.line.me/${lineSettings.liffId}`)}
                      variant="outline"
                    >
                      コピー
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    ※ このURLをリッチメニューのリンクに設定してください
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">リッチメニューの設定方法</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>LINE Official Account Managerにログイン</li>
                    <li>ホーム → リッチメニュー → 作成</li>
                    <li>「予約する」ボタンに上記のLIFF URLを設定</li>
                    <li>リッチメニューを公開</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* アクションボタン */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "保存中..." : "設定を保存"}
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={testing || !lineSettings.channelAccessToken}
            variant="outline"
            className="flex-1"
          >
            {testing ? "テスト中..." : "接続テスト"}
          </Button>
        </div>

        {/* 設定ガイド */}
        <Card>
          <CardHeader>
            <CardTitle>設定ガイド</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. LINE Official Accountを作成</h3>
              <p className="text-sm text-gray-600">
                <a
                  href="https://developers.line.biz/console/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  LINE Developers Console
                </a>
                で新しいチャネル（Messaging API）を作成してください。
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Webhook URLを設定</h3>
              <p className="text-sm text-gray-600">
                Messaging API設定 → Webhook URL に上記のWebhook URLを入力し、「Webhookの利用」をオンにしてください。
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. 認証情報を取得</h3>
              <p className="text-sm text-gray-600">
                Channel Access TokenとChannel Secretを取得し、上記フォームに入力してください。
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. LIFFアプリを作成</h3>
              <p className="text-sm text-gray-600 mb-2">
                LINE Developers Console → LIFF → 追加 で新しいLIFFアプリを作成してください。
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-4">
                <li>
                  Endpoint URL:{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                    {typeof window !== "undefined" ? window.location.origin : ""}/liff/booking
                  </code>
                </li>
                <li>サイズ: Full（推奨）</li>
                <li>スコープ: profile, openid</li>
              </ul>
              <p className="text-sm text-gray-600 mt-2">
                作成後に表示されるLIFF IDを上記フォームに入力してください。
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">5. 応答メッセージをオフ</h3>
              <p className="text-sm text-gray-600">
                Messaging API設定 → 応答メッセージ を「オフ」にして、Botの自動応答を無効にしてください。
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">6. リッチメニューを設定</h3>
              <p className="text-sm text-gray-600">
                LINE Official Account Managerでリッチメニューを作成し、「予約する」ボタンにLIFF URLを設定してください。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </SettingsLayout>
  );
}
