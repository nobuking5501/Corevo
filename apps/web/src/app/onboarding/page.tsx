"use client";

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [firstTenantName, setFirstTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantStoreCode, setTenantStoreCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    setIsLoading(true);
    setError("");

    try {
      const createOrganization = httpsCallable(functions, "createOrganization");
      const result = await createOrganization({
        organizationName,
        firstTenantName,
        tenantAddress,
        tenantPhone,
        tenantStoreCode,
        ownerEmail: firebaseUser.email,
        ownerName: firebaseUser.displayName || "オーナー",
      });

      console.log("[Onboarding] Organization created:", result.data);

      // Force token refresh to get new custom claims
      await firebaseUser.getIdToken(true);

      // Reload to trigger auth state update with new claims
      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("[Onboarding] Organization creation error:", error);
      setError(error.message || "組織の作成に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Corevoへようこそ！</CardTitle>
          <CardDescription>
            組織と最初の店舗情報を登録してください。後から追加の店舗を登録できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrganization} className="space-y-6">
            {/* 組織情報 */}
            <div className="space-y-4 rounded-lg border p-4 bg-blue-50/50">
              <h3 className="font-semibold text-lg">組織情報</h3>
              <div className="space-y-2">
                <Label htmlFor="organizationName">組織名 *</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="例: 美容室グループABC"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-600">
                  複数の店舗を運営している場合は、グループ名を入力してください
                </p>
              </div>
            </div>

            {/* 店舗情報 */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold text-lg">最初の店舗情報</h3>

              <div className="space-y-2">
                <Label htmlFor="firstTenantName">店舗名 *</Label>
                <Input
                  id="firstTenantName"
                  type="text"
                  placeholder="例: ABC東京店"
                  value={firstTenantName}
                  onChange={(e) => setFirstTenantName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantStoreCode">店舗コード</Label>
                <Input
                  id="tenantStoreCode"
                  type="text"
                  placeholder="例: TKY001"
                  value={tenantStoreCode}
                  onChange={(e) => setTenantStoreCode(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-600">
                  店舗を識別するためのコードを入力してください（任意）
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantAddress">住所</Label>
                <Input
                  id="tenantAddress"
                  type="text"
                  placeholder="例: 東京都渋谷区1-1-1"
                  value={tenantAddress}
                  onChange={(e) => setTenantAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantPhone">電話番号</Label>
                <Input
                  id="tenantPhone"
                  type="tel"
                  placeholder="例: 03-1234-5678"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                <p className="font-semibold">エラーが発生しました</p>
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "作成中..." : "組織を作成して開始"}
            </Button>

            <p className="text-xs text-center text-gray-500">
              作成後、ダッシュボードに移動します
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
