"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { isPlatformAdmin } from "@/lib/auth";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, DollarSign, ArrowLeft } from "lucide-react";
import type { Organization, Tenant, OrganizationStats } from "@/types";

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<OrganizationStats | null>(null);

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
      await loadOrganizationData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, organizationId]);

  const loadOrganizationData = async () => {
    try {
      const orgDoc = await getDoc(doc(db, "organizations", organizationId));
      if (!orgDoc.exists()) {
        console.error("Organization not found");
        return;
      }

      const orgData = orgDoc.data();
      setOrganization({
        id: orgDoc.id,
        ...orgData,
        createdAt: orgData.createdAt?.toDate(),
        updatedAt: orgData.updatedAt?.toDate(),
      } as Organization);

      const tenantsSnapshot = await getDocs(collection(db, "tenants"));
      const orgTenants: Tenant[] = [];
      let totalCustomers = 0;
      let totalAppointments = 0;

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantData = tenantDoc.data();
        if (tenantData.organizationId === organizationId) {
          orgTenants.push({
            id: tenantDoc.id,
            ...tenantData,
            createdAt: tenantData.createdAt?.toDate(),
            updatedAt: tenantData.updatedAt?.toDate(),
          } as Tenant);

          const customersSnapshot = await getDocs(
            collection(db, `tenants/${tenantDoc.id}/customers`)
          );
          totalCustomers += customersSnapshot.size;

          const appointmentsSnapshot = await getDocs(
            collection(db, `tenants/${tenantDoc.id}/appointments`)
          );
          totalAppointments += appointmentsSnapshot.size;
        }
      }

      setTenants(orgTenants);
      setStats({
        organizationId,
        tenantCount: orgTenants.length,
        totalCustomers,
        totalRevenue: 0,
        monthlyRevenue: 0,
        appointmentCount: totalAppointments,
      });
    } catch (error) {
      console.error("Error loading organization data:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "trial":
        return "bg-blue-100 text-blue-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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

  if (!organization) {
    return (
      <PlatformAdminLayout>
        <div className="text-center py-12">組織が見つかりません</div>
      </PlatformAdminLayout>
    );
  }

  return (
    <PlatformAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/platform-admin/organizations")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{organization.name}</h1>
              <Badge className={getStatusColor(organization.status)}>
                {organization.status}
              </Badge>
            </div>
            <p className="text-gray-500">組織ID: {organization.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">店舗数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.tenantCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                最大: {organization.maxTenants || "無制限"}
              </p>
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
              <CardTitle className="text-sm font-medium">予約数</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.appointmentCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">総予約数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">月次売上</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{stats?.monthlyRevenue?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Stripe連携後に表示</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>組織詳細</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">プラン</p>
                <p className="text-lg font-semibold">{organization.plan}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">ステータス</p>
                <p className="text-lg font-semibold">{organization.status}</p>
              </div>
              {organization.contactEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-500">連絡先メール</p>
                  <p className="text-lg">{organization.contactEmail}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">作成日</p>
                <p className="text-lg">
                  {organization.createdAt.toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>店舗一覧 ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-gray-500 text-sm">店舗がまだ登録されていません</p>
            ) : (
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{tenant.name}</h3>
                        <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>作成日: {tenant.createdAt.toLocaleDateString("ja-JP")}</p>
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
