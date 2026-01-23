"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "ダッシュボード", href: "/dashboard" },
  { name: "予約管理", href: "/appointments" },
  { name: "レジ", href: "/register" },
  { name: "カレンダー", href: "/calendar" },
  { name: "顧客管理", href: "/customers" },
  { name: "施術記録", href: "/records" },
  { name: "施術スタッフ", href: "/staff-members" },
  { name: "シフト管理", href: "/shifts" },
  { name: "メニュー", href: "/services" },
  { name: "設定", href: "/settings" },
];

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);

  const {
    organization,
    currentTenant,
    tenants,
    firebaseUser,
    loading: authLoading,
  } = useAuthStore();

  // Debug log
  useEffect(() => {
    console.log("[MainLayout] Auth state:", {
      organization,
      currentTenant,
      tenants: tenants.length,
      firebaseUser: firebaseUser?.email,
      authLoading,
    });
  }, [organization, currentTenant, tenants, firebaseUser, authLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleTenantSwitch = (tenantId: string) => {
    localStorage.setItem("currentTenantId", tenantId);
    setShowTenantDropdown(false);
    window.location.href = "/dashboard";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">認証確認中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm flex flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-4">
          <h1 className="text-xl font-bold text-blue-500">Corevo</h1>
        </div>

        {/* Tenant Switcher (Multiple tenants) */}
        {tenants.length > 1 && currentTenant && (
          <div className="p-3 border-b border-gray-200 relative">
            <div className="text-xs text-gray-400 mb-1 font-medium">
              {organization?.name || "組織"}
            </div>
            <button
              onClick={() => setShowTenantDropdown(!showTenantDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-blue-500 transition-all text-sm font-medium text-gray-900"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span>🏪</span>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {currentTenant.name}
                </span>
              </div>
              <span className="text-xs">▼</span>
            </button>

            {/* Dropdown Menu */}
            {showTenantDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTenantDropdown(false)}
                />
                {/* Dropdown */}
                <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSwitch(tenant.id)}
                      className={`w-full flex items-center justify-between px-3 py-3 text-sm text-left border-b border-gray-100 last:border-0 transition-colors ${
                        tenant.id === currentTenant.id
                          ? "bg-blue-50 font-semibold"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>🏪</span>
                        <span className="text-gray-900">{tenant.name}</span>
                      </div>
                      {tenant.id === currentTenant.id && (
                        <span className="text-blue-500 text-base">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Single Tenant Info */}
        {tenants.length === 1 && currentTenant && (
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs text-gray-400 mb-1 font-medium">
              {organization?.name || "組織"}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md text-sm font-medium text-gray-900">
              <span>🏪</span>
              <span>{currentTenant.name}</span>
            </div>
          </div>
        )}

        {/* Fallback when no tenants are loaded yet */}
        {tenants.length === 0 && !authLoading && (
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs text-gray-400 mb-1 font-medium">
              読み込み中...
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md text-sm font-medium text-gray-500">
              <span>⏳</span>
              <span>店舗情報を取得中</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 text-sm">
            <div className="font-semibold text-gray-900">ログイン中</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
          >
            ログアウト
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
