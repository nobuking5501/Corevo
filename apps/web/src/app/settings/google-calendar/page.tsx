"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { useAuth } from "@/lib/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, CheckCircle2, XCircle, Trash2, Copy, Link2, AlertCircle, Store, Users, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { StaffMember } from "@/types";

interface StaffCalendarConnection {
  staffMemberId: string;
  staffName: string;
  googleEmail: string;
  calendarId: string;
  accessToken?: string;
  refreshToken?: string;
  connectedAt: Date;
  isActive: boolean;
}

interface SetupCheck {
  configured: boolean;
  checks: {
    firebaseProjectId: boolean;
    firebaseClientEmail: boolean;
    firebasePrivateKey: boolean;
    googleCalendarClientId: boolean;
    googleCalendarClientSecret: boolean;
    appUrl: boolean;
  };
  missingConfigs: string[];
  redirectUri: string;
}

export default function GoogleCalendarSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Google Calendar設定
  const [calendarSettings, setCalendarSettings] = useState({
    enabled: false,
    clientId: "",
    clientSecret: "",
    syncInterval: 5, // 分
  });

  // スタッフの連携状況
  const [connections, setConnections] = useState<StaffCalendarConnection[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [setupCheck, setSetupCheck] = useState<SetupCheck | null>(null);
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null);

  // お店用連携状況
  const [storeConnection, setStoreConnection] = useState<StaffCalendarConnection | null>(null);
  const [syncingShifts, setSyncingShifts] = useState(false);

  // セットアップ手順の表示/非表示
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // URLパラメータからエラー/成功メッセージを取得
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const successParam = searchParams.get("success");

    if (errorParam) {
      setError(`連携に失敗しました: ${decodeURIComponent(errorParam)}`);
    } else if (successParam === "true") {
      setSuccess("Googleカレンダーとの連携に成功しました！");
      // 連携情報を再読み込み
      window.location.href = "/settings/google-calendar";
    }
  }, [searchParams]);

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
        const googleCalendar = settings?.googleCalendar || {};
        const featureFlags = settings?.featureFlags || {};

        // Google Calendar設定を取得
        setCalendarSettings({
          enabled: featureFlags?.googleCalendarIntegration || false,
          clientId: googleCalendar?.clientId || "",
          clientSecret: googleCalendar?.clientSecret || "",
          syncInterval: googleCalendar?.syncInterval || 5,
        });

        // スタッフの連携状況を取得
        const connectionsRef = collection(db, `tenants/${currentTenantId}/googleCalendarConnections`);
        const connectionsSnapshot = await getDocs(connectionsRef);
        const connectionsData = connectionsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          connectedAt: doc.data().connectedAt?.toDate(),
        })) as StaffCalendarConnection[];

        setConnections(connectionsData);

        // お店用連携情報を取得
        const storeConnectionDoc = await getDoc(
          doc(db, `tenants/${currentTenantId}/googleCalendarConnections`, "store")
        );
        if (storeConnectionDoc.exists()) {
          setStoreConnection({
            ...storeConnectionDoc.data(),
            connectedAt: storeConnectionDoc.data().connectedAt?.toDate(),
          } as StaffCalendarConnection);
        }

        // スタッフメンバーを取得
        const staffRef = collection(db, `tenants/${currentTenantId}/staffMembers`);
        const staffSnapshot = await getDocs(staffRef);
        const staffData = staffSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as StaffMember[];
        setStaffMembers(staffData);

        // 設定チェックを実行
        const checkResponse = await fetch("/api/calendar/check-setup");
        const checkData = await checkResponse.json();
        setSetupCheck(checkData);
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
        "settings.googleCalendar.clientId": calendarSettings.clientId,
        "settings.googleCalendar.clientSecret": calendarSettings.clientSecret,
        "settings.googleCalendar.syncInterval": calendarSettings.syncInterval,
        "settings.featureFlags.googleCalendarIntegration": calendarSettings.enabled,
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

  const handleConnectStoreCalendar = () => {
    if (!user || !tenantId) {
      setError("ユーザー情報またはテナント情報が取得できません");
      return;
    }

    // OAuth認証フローを開始（お店用）
    const authorizeUrl = `/api/auth/google-calendar/authorize?tenantId=${tenantId}&userId=store`;
    window.location.href = authorizeUrl;
  };

  const handleDisconnectStoreCalendar = async () => {
    if (!tenantId) return;
    if (!confirm("お店用Googleカレンダー連携を解除しますか？")) return;

    try {
      const storeConnectionRef = doc(db, `tenants/${tenantId}/googleCalendarConnections`, "store");
      await updateDoc(storeConnectionRef, {
        isActive: false,
        updatedAt: new Date(),
      });

      setStoreConnection(null);
      setSuccess("お店用連携を解除しました");
    } catch (err) {
      console.error("Failed to disconnect store calendar:", err);
      setError("連携解除に失敗しました");
    }
  };

  const handleSyncShifts = async () => {
    if (!tenantId) return;

    setSyncingShifts(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/calendar/sync-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync shifts");
      }

      setSuccess(
        `シフト同期完了: ${data.syncedStaff}/${data.totalStaff}名のスタッフのシフトをお店用カレンダーに同期しました`
      );
    } catch (err: any) {
      console.error("Failed to sync shifts:", err);
      setError(`シフト同期に失敗しました: ${err.message}`);
    } finally {
      setSyncingShifts(false);
    }
  };

  const handleReconnectCalendar = (staffMemberId: string) => {
    if (!user || !tenantId) {
      setError("ユーザー情報またはテナント情報が取得できません");
      return;
    }

    // OAuth認証フローを開始（既存の連携を更新）
    const authorizeUrl = `/api/auth/google-calendar/authorize?tenantId=${tenantId}&userId=${staffMemberId}`;
    window.location.href = authorizeUrl;
  };

  const handleDisconnectCalendar = async (staffMemberId: string) => {
    if (!tenantId) return;
    if (!confirm("Googleカレンダー連携を解除しますか？")) return;

    try {
      const connectionRef = doc(db, `tenants/${tenantId}/googleCalendarConnections`, staffMemberId);
      await updateDoc(connectionRef, {
        isActive: false,
        updatedAt: new Date(),
      });

      // 連携リストから削除
      setConnections(connections.filter((c) => c.staffMemberId !== staffMemberId));
      setSuccess("連携を解除しました");
    } catch (err) {
      console.error("Failed to disconnect:", err);
      setError("連携解除に失敗しました");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("クリップボードにコピーしました");
    setTimeout(() => setSuccess(""), 2000);
  };

  const handleConnectStaffCalendar = (staffMemberId: string) => {
    if (!user || !tenantId) {
      setError("ユーザー情報またはテナント情報が取得できません");
      return;
    }

    // OAuth認証フローを開始（スタッフ用）
    const authorizeUrl = `/api/auth/google-calendar/authorize?tenantId=${tenantId}&userId=${staffMemberId}`;
    window.location.href = authorizeUrl;
  };

  const handleGenerateConnectUrl = async (staffMemberId: string) => {
    if (!tenantId) return;

    setGeneratingUrl(staffMemberId);
    setError("");

    try {
      const response = await fetch("/api/calendar/generate-connect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, staffMemberId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate URL");
      }

      // URLをクリップボードにコピー
      await navigator.clipboard.writeText(data.connectUrl);
      setSuccess(`連携URLをコピーしました（有効期限: 24時間）`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to generate connect URL:", err);
      setError(`URL生成に失敗しました: ${err.message}`);
    } finally {
      setGeneratingUrl(null);
    }
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

  const redirectUri = `${window.location.origin}/api/auth/google-calendar/callback`;

  return (
    <SettingsLayout>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Googleカレンダー連携設定</h1>
          <p className="text-gray-600 mt-2">
            スタッフのGoogleカレンダーと同期して、予約管理を効率化できます。
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

        {/* 設定チェック状態 */}
        {setupCheck && !setupCheck.configured && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">環境変数の設定が不足しています：</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {setupCheck.missingConfigs.map((config) => (
                  <li key={config}>{config}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                .env.local ファイルに必要な環境変数を追加してください。
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* 認証情報設定 */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle>認証情報設定</CardTitle>
              <CardDescription>
                Google Cloud Consoleから取得したClient IDとClient Secretを入力してください
                {!calendarSettings.clientId && (
                  <span className="block mt-2 text-amber-600 font-semibold">
                    ※ 初回設定の場合は、下の「セットアップ手順を見る」を開いて、Google Cloud Consoleの設定を完了してください
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  type="text"
                  value={calendarSettings.clientId}
                  onChange={(e) =>
                    setCalendarSettings({ ...calendarSettings, clientId: e.target.value })
                  }
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={calendarSettings.clientSecret}
                  onChange={(e) =>
                    setCalendarSettings({ ...calendarSettings, clientSecret: e.target.value })
                  }
                  placeholder="Client Secretを入力"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="syncInterval">同期間隔（分）</Label>
                <Input
                  id="syncInterval"
                  type="number"
                  min="1"
                  max="60"
                  value={calendarSettings.syncInterval}
                  onChange={(e) =>
                    setCalendarSettings({
                      ...calendarSettings,
                      syncInterval: parseInt(e.target.value) || 5,
                    })
                  }
                  className="mt-1 w-32"
                />
                <p className="text-sm text-gray-500 mt-1">
                  GoogleカレンダーとCorevoを同期する間隔（推奨: 5分）
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={calendarSettings.enabled}
                  onChange={(e) =>
                    setCalendarSettings({ ...calendarSettings, enabled: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  Googleカレンダー連携を有効にする
                </Label>
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "保存中..." : "設定を保存"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* お店用カレンダー連携 */}
          <Card className="border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                お店用カレンダー連携
              </CardTitle>
              <CardDescription>
                店舗全体のスケジュール管理用のGoogleカレンダーと連携します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">連携状況</h3>
                {storeConnection && storeConnection.isActive ? (
                  <div className="border rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-green-900">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          連携済み
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{storeConnection.googleEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          連携日: {storeConnection.connectedAt?.toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnectStoreCalendar}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        解除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      管理者アカウントのGoogleカレンダーと連携します
                    </p>
                    <Button
                      onClick={handleConnectStoreCalendar}
                      disabled={
                        !calendarSettings.enabled ||
                        !calendarSettings.clientId
                      }
                      className="w-full"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      お店用カレンダーを連携
                    </Button>
                    {(!calendarSettings.enabled || !calendarSettings.clientId) && (
                      <p className="text-xs text-amber-600 mt-2">
                        ※ 上記の認証情報設定を保存してから連携してください
                      </p>
                    )}
                  </div>
                )}
              </div>

              {storeConnection && storeConnection.isActive && (
                <div>
                  <h3 className="font-semibold mb-2">シフト同期</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    全スタッフのGoogleカレンダーのシフト（イベント）をお店用カレンダーに同期します
                  </p>
                  <Button
                    onClick={handleSyncShifts}
                    disabled={syncingShifts || connections.length === 0}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingShifts ? "animate-spin" : ""}`} />
                    {syncingShifts ? "同期中..." : "スタッフシフトを今すぐ同期"}
                  </Button>
                  {connections.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      ※ スタッフ用カレンダー連携を完了してから使用できます
                    </p>
                  )}
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-900 font-semibold mb-1">こんな場合におすすめ</p>
                <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                  <li>店舗の営業スケジュールを一元管理したい</li>
                  <li>全スタッフの予定を一つのカレンダーで確認したい</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* スタッフ用カレンダー連携 */}
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                スタッフ用カレンダー連携
              </CardTitle>
              <CardDescription>
                各スタッフが個人のGoogleカレンダーを連携します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">スタッフ一覧と連携状況</h3>
                {staffMembers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-lg">
                    スタッフが登録されていません。
                    <br />
                    <a href="/staff-members" className="text-blue-600 hover:underline mt-2 inline-block">
                      スタッフを追加する
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffMembers.map((staff) => {
                      const connection = connections.find((c) => c.staffMemberId === staff.id);
                      const isConnected = !!connection;

                      return (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                              style={{ backgroundColor: staff.color }}
                            >
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{staff.name}</p>
                                {isConnected ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              {isConnected ? (
                                <>
                                  <p className="text-sm text-gray-600">{connection.googleEmail}</p>
                                  <p className="text-xs text-gray-400">
                                    連携日: {connection.connectedAt.toLocaleDateString()}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500">未連携</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isConnected ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReconnectCalendar(staff.id)}
                                  className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  再接続
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDisconnectCalendar(staff.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  解除
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleConnectStaffCalendar(staff.id)}
                                  disabled={
                                    !calendarSettings.enabled ||
                                    !calendarSettings.clientId
                                  }
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Calendar className="h-4 w-4 mr-1" />
                                  今すぐ連携
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleGenerateConnectUrl(staff.id)}
                                  disabled={
                                    !calendarSettings.enabled ||
                                    !calendarSettings.clientId ||
                                    generatingUrl === staff.id
                                  }
                                >
                                  <Link2 className="h-4 w-4 mr-1" />
                                  {generatingUrl === staff.id ? "生成中..." : "URL生成"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-900 font-semibold mb-1">連携方法</p>
                <div className="text-sm text-green-800 space-y-3">
                  <div>
                    <p className="font-semibold mb-1">📱 方法1: 今すぐ連携（推奨）</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>スタッフが目の前にいる場合</li>
                      <li>「今すぐ連携」をクリックして即座にOAuth認証</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">🔗 方法2: URLを送信</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>スタッフがリモートの場合</li>
                      <li>「URL生成」→ 自動コピー → LINE/メールで送信</li>
                      <li>スタッフが各自で連携</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800 space-y-1">
                  ※ 連携URLの有効期限は24時間です<br />
                  ※ URLは一度使用すると無効になります
                </p>
              </div>
            </CardContent>
          </Card>

          {/* セットアップ手順（折りたたみ可能） */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowSetupGuide(!showSetupGuide)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    セットアップ手順を見る（初回設定時）
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Google Cloud Consoleでの初期設定手順とトラブルシューティング
                  </CardDescription>
                </div>
                {showSetupGuide ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
            {showSetupGuide && (
              <CardContent className="space-y-6">
                {/* ステップ1: Google Cloud Console 初期設定 */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-bold text-lg mb-3 text-purple-900">
                    ステップ1: Google Cloud Console 初期設定
                  </h3>
                  <p className="text-sm text-purple-800 mb-4 bg-purple-50 p-3 rounded">
                    この設定を完了しないと次のステップに進めません。Google Cloud Consoleで一度だけ設定を行います。
                  </p>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">1-1. Google Cloud Consoleでプロジェクトを作成</h4>
                      <p className="text-sm text-gray-600 ml-4">
                        <a
                          href="https://console.cloud.google.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Google Cloud Console
                        </a>
                        を開き、新しいプロジェクトを作成します。
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">1-2. Google Calendar APIを有効化</h4>
                      <div className="ml-4 text-sm text-gray-600 space-y-1">
                        <p>① 左メニューから「APIとサービス」→「ライブラリ」を選択</p>
                        <p>② 「Google Calendar API」を検索</p>
                        <p>③ 「有効にする」ボタンをクリック</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">1-3. OAuth 2.0 クライアント IDを作成</h4>
                      <div className="ml-4 text-sm text-gray-600 space-y-1">
                        <p>① 「APIとサービス」→「認証情報」を選択</p>
                        <p>② 「認証情報を作成」→「OAuth クライアント ID」をクリック</p>
                        <p>③ アプリケーションの種類：「ウェブアプリケーション」を選択</p>
                        <p>④ 名前：任意（例：Corevo Calendar Integration）</p>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-red-900">1-4. リダイレクトURIを追加【重要】</h4>
                      <p className="text-sm text-red-800 mb-2 font-semibold">
                        この設定を間違えると「redirect_uri_mismatch」エラーが発生します
                      </p>
                      <div className="ml-4 text-sm text-red-800 space-y-2">
                        <p>① OAuth クライアント IDの作成画面で「承認済みのリダイレクト URI」を探す</p>
                        <p>② 「URIを追加」ボタンをクリック</p>
                        <p>③ 以下のRedirect URIをコピー＆ペースト（完全一致が必要）：</p>
                        <div className="mt-2 p-2 bg-white rounded border border-red-300 font-mono text-xs break-all">
                          {redirectUri}
                        </div>
                        <p className="font-semibold">④ 必ず「保存」ボタンをクリック</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">1-5. OAuth同意画面の設定</h4>
                      <div className="ml-4 text-sm text-gray-600 space-y-2">
                        <p>① 「OAuth同意画面」タブを開く</p>
                        <p>② User Type：「外部」を選択して「作成」</p>
                        <p>③ アプリ情報を入力（アプリ名、サポートメールなど）</p>
                        <p className="font-semibold">スコープの設定：</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>https://www.googleapis.com/auth/calendar.readonly</li>
                          <li>https://www.googleapis.com/auth/calendar.events</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-amber-900">1-6. テストユーザーを追加【重要】</h4>
                      <p className="text-sm text-amber-800 mb-2 font-semibold">
                        この設定がないと「access_denied」エラーが発生します
                      </p>
                      <div className="ml-4 text-sm text-amber-800 space-y-1">
                        <p>① OAuth同意画面の編集ページで「テストユーザー」セクションを探す</p>
                        <p>② 「+ ADD USERS」ボタンをクリック</p>
                        <p>③ 連携するGoogleアカウントのメールアドレスを追加</p>
                        <p>④ 「保存」をクリック</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">1-7. Client IDとClient Secretをコピー</h4>
                      <div className="ml-4 text-sm text-gray-600 space-y-1">
                        <p>① 「認証情報」ページに戻る</p>
                        <p>② 作成したOAuth 2.0クライアントIDをクリック</p>
                        <p>③ Client IDとClient Secretをコピー</p>
                        <p className="font-semibold text-purple-700">④ 上記の「認証情報設定」に入力して保存</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* トラブルシューティング */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h3 className="font-bold text-lg mb-3 text-orange-900">
                    よくあるエラーと解決方法
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-red-900 mb-2">エラー 400: redirect_uri_mismatch</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">原因：</span>Google Cloud Consoleに登録されているリダイレクトURIと一致していません。
                      </p>
                      <p className="text-sm text-gray-700 font-semibold">解決方法：</p>
                      <ol className="text-sm text-gray-700 list-decimal list-inside ml-4 space-y-1">
                        <li>上記のRedirect URIが完全一致で登録されているか確認</li>
                        <li>末尾のスラッシュやスペースがないか確認</li>
                        <li>必ず「保存」ボタンをクリック後、数秒待ってから再試行</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-semibold text-orange-900 mb-2">エラー 403: access_denied</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">原因：</span>テストユーザーに追加されていません。
                      </p>
                      <p className="text-sm text-gray-700 font-semibold">解決方法：</p>
                      <ol className="text-sm text-gray-700 list-decimal list-inside ml-4 space-y-1">
                        <li>Google Cloud Console → OAuth同意画面を開く</li>
                        <li>「テストユーザー」セクションで連携するメールアドレスを追加</li>
                        <li>「保存」をクリックして再試行</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-2">「このアプリは Google で確認されていません」警告</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">状況：</span>これは開発中のアプリでは正常な警告です。エラーではありません。
                      </p>
                      <p className="text-sm text-gray-700 font-semibold">対処方法：</p>
                      <ol className="text-sm text-gray-700 list-decimal list-inside ml-4 space-y-1">
                        <li>警告画面で「詳細」または「Advanced」をクリック</li>
                        <li>「Corevoに移動（安全ではありません）」をクリック</li>
                        <li>権限の許可画面で「許可」をクリック</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </SettingsLayout>
  );
}
