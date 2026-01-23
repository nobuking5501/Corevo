"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SelectTenantPage() {
  const router = useRouter();
  const { tenants, organization, roles, loading, currentTenantId } = useAuthStore();

  useEffect(() => {
    // If user has no tenants, redirect to onboarding
    if (!loading && tenants.length === 0) {
      router.push("/onboarding");
      return;
    }

    // If user has only one tenant, auto-select and redirect
    if (!loading && tenants.length === 1) {
      const tenantId = tenants[0].id;
      localStorage.setItem("currentTenantId", tenantId);
      router.push("/dashboard");
      return;
    }
  }, [loading, tenants, router]);

  const handleSelectTenant = (tenantId: string) => {
    localStorage.setItem("currentTenantId", tenantId);
    // Force reload to trigger AuthProvider to load the selected tenant
    window.location.href = "/dashboard";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            店舗を選択
          </h1>
          <p className="text-gray-600">
            {organization?.name && `${organization.name} - `}
            アクセスする店舗を選択してください
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tenants.map((tenant) => {
            const role = roles[tenant.id];
            const isSelected = currentTenantId === tenant.id;

            return (
              <Card
                key={tenant.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""
                }`}
                onClick={() => handleSelectTenant(tenant.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{tenant.name}</CardTitle>
                    {isSelected && (
                      <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                        選択中
                      </span>
                    )}
                  </div>
                  <CardDescription className="space-y-2 mt-3">
                    {tenant.slug && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🔗</span>
                        <span>{tenant.slug}</span>
                      </div>
                    )}
                    {role && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>👤</span>
                        <span>
                          {role === "owner" && "オーナー"}
                          {role === "manager" && "マネージャー"}
                          {role === "staff" && "スタッフ"}
                          {role === "accountant" && "経理"}
                        </span>
                      </div>
                    )}
                    {tenant.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📍</span>
                        <span>{tenant.address}</span>
                      </div>
                    )}
                    {tenant.status && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>⚡</span>
                        <span className={tenant.status === "active" ? "text-green-600" : "text-red-600"}>
                          {tenant.status === "active" ? "稼働中" : "非稼働"}
                        </span>
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {tenants.length === 0 && !loading && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg text-gray-600 mb-4">
                アクセス可能な店舗がありません
              </p>
              <p className="text-sm text-gray-400">
                組織の管理者にお問い合わせください
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
