"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { isPlatformAdmin } from "@/lib/auth";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus } from "lucide-react";
import type { Organization } from "@/types";

export default function OrganizationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
      await loadOrganizations();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOrganizations(filtered);
    } else {
      setFilteredOrganizations(organizations);
    }
  }, [searchTerm, organizations]);

  const loadOrganizations = async () => {
    try {
      const orgsSnapshot = await getDocs(collection(db, "organizations"));
      const orgsData: Organization[] = [];

      for (const doc of orgsSnapshot.docs) {
        const data = doc.data();
        orgsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Organization);
      }

      const sorted = orgsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrganizations(sorted);
      setFilteredOrganizations(sorted);
    } catch (error) {
      console.error("Error loading organizations:", error);
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

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case "trial":
        return "Trial";
      case "basic":
        return "Basic";
      case "pro":
        return "Pro";
      case "enterprise":
        return "Enterprise";
      default:
        return plan;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">クライアント管理</h1>
            <p className="text-gray-500">すべてのクライアント組織を管理</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>全クライアント ({filteredOrganizations.length})</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="名前またはIDで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrganizations.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                {searchTerm ? "一致するクライアントが見つかりません" : "クライアントがまだ登録されていません"}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredOrganizations.map((org) => (
                  <div
                    key={org.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/platform-admin/organizations/${org.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Building2 className="h-8 w-8 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{org.name}</h3>
                            <Badge className={getStatusColor(org.status)}>
                              {org.status}
                            </Badge>
                            <Badge variant="outline">{getPlanLabel(org.plan)}</Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            ID: {org.id}
                          </p>
                          {org.contactEmail && (
                            <p className="text-sm text-gray-500">
                              Contact: {org.contactEmail}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>作成日: {org.createdAt.toLocaleDateString("ja-JP")}</p>
                        {org.maxTenants && (
                          <p className="mt-1">最大店舗数: {org.maxTenants}</p>
                        )}
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
