"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MainLayout } from "./MainLayout";
import { cn } from "@/lib/utils";
import { Building2, MessageSquare, Clock, Users, Bell, ChevronRight } from "lucide-react";

const settingsNavItems = [
  {
    title: "店舗管理",
    description: "組織内の店舗を追加・管理",
    href: "/settings/tenants",
    icon: Building2,
    available: true,
  },
  {
    title: "LINE連携設定",
    description: "LINE Official Accountと連携",
    href: "/settings/line",
    icon: MessageSquare,
    available: true,
  },
  {
    title: "営業時間設定",
    description: "営業時間と定休日を設定",
    href: "/settings/business-hours",
    icon: Clock,
    available: false,
  },
  {
    title: "スタッフ管理",
    description: "スタッフの招待と権限管理",
    href: "/settings/staff",
    icon: Users,
    available: true,
  },
  {
    title: "通知設定",
    description: "メール通知とアラート設定",
    href: "/settings/notifications",
    icon: Bell,
    available: false,
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <MainLayout>
      <div className="flex gap-6">
        {/* 左側のサイドバーメニュー */}
        <aside className="w-64 flex-shrink-0">
          <div className="sticky top-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 px-3">設定</h2>
            <nav className="space-y-1">
              {settingsNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.available ? item.href : "#"}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                      item.available
                        ? isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        : "text-gray-400 cursor-not-allowed opacity-60"
                    )}
                    onClick={(e) => {
                      if (!item.available) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        isActive && item.available
                          ? "text-blue-600"
                          : item.available
                          ? "text-gray-400 group-hover:text-gray-600"
                          : "text-gray-300"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isActive && item.available
                              ? "text-blue-700"
                              : "text-gray-900"
                          )}
                        >
                          {item.title}
                        </p>
                        {isActive && item.available && (
                          <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                      {!item.available && (
                        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-1">
                          準備中
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 右側のメインコンテンツ */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </MainLayout>
  );
}
