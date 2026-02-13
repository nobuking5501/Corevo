"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { isPlatformAdmin } from "@/lib/auth";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, DollarSign } from "lucide-react";
import type { Organization, PlatformAdminStats } from "@/types";

export default function PlatformAdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<PlatformAdminStats | null>(null);
  const [recentOrganizations, setRecentOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      const isAdmin = await isPlatformAdmin(user.uid, user.email || "");
      if (!isAdmin) {
        router.push("/dashboard");
        return;
      }

      setAuthorized(true);
      await loadDashboardData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadDashboardData = async () => {
    try {
      const orgsSnapshot = await getDocs(collection(db, "organizations"));
      const organizations: Organization[] = [];

      for (const doc of orgsSnapshot.docs) {
        const data = doc.data();
        organizations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Organization);
      }

      const activeOrgs = organizations.filter((org) => org.status === "active");
      const trialOrgs = organizations.filter((org) => org.plan === "trial");
      const suspendedOrgs = organizations.filter((org) => org.status === "suspended");

      let totalTenants = 0;
      let totalCustomers = 0;

      for (const org of organizations) {
        const tenantsSnapshot = await getDocs(collection(db, "tenants"));
        const orgTenants = tenantsSnapshot.docs.filter(
          (doc) => doc.data().organizationId === org.id
        );
        totalTenants += orgTenants.length;

        for (const tenant of orgTenants) {
          const customersSnapshot = await getDocs(
            collection(db, `tenants/${tenant.id}/customers`)
          );
          totalCustomers += customersSnapshot.size;
        }
      }

      setStats({
        totalOrganizations: organizations.length,
        totalTenants,
        totalCustomers,
        totalRevenue: 0,
        activeOrganizations: activeOrgs.length,
        trialOrganizations: trialOrgs.length,
        suspendedOrganizations: suspendedOrgs.length,
      });

      const sorted = organizations.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      setRecentOrganizations(sorted.slice(0, 5));
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  if (loading) {
    return (
      <PlatformAdminLayout>
        <div className="text-center py-12">読み込み中...</div>
      </PlatformAdminLayout>
    );
  }

  if (!authorized) {
    return (
      <PlatformAdminLayout>
        <div className="text-center py-12">アクセスが拒否されました</div>
      </PlatformAdminLayout>
    );
  }

  return (
    <PlatformAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">総合管理画面</h1>
          <p className="text-gray-500">Corevo SaaS 運営管理</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">クライアント数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrganizations || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                稼働中: {stats?.activeOrganizations || 0} | トライアル: {stats?.trialOrganizations || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">店舗数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTenants || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">全クライアント</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総顧客数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">全店舗</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">月次売上</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{stats?.totalRevenue?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Stripe連携後に表示</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={() => router.push("/platform-admin/organizations")}>
              <Building2 className="mr-2 h-4 w-4" />
              クライアント一覧
            </Button>
            <Button variant="outline" onClick={() => router.push("/platform-admin/settings")}>
              システム設定
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近のクライアント</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrganizations.length === 0 ? (
              <p className="text-gray-500 text-sm">クライアントがまだ登録されていません</p>
            ) : (
              <div className="space-y-2">
                {recentOrganizations.map((org) => (
                  <div
                    key={org.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/platform-admin/organizations/${org.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{org.name}</h3>
                        <p className="text-sm text-gray-500">
                          プラン: {org.plan} | ステータス: {org.status}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {org.createdAt.toLocaleDateString("ja-JP")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformAdminLayout>
  );
}
