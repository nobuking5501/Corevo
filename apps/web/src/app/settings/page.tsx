"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import Link from "next/link";

export default function SettingsPage() {
  const settingsCards = [
    {
      title: "店舗管理",
      description: "組織内の店舗を追加・管理し、複数店舗を一元管理",
      href: "/settings/tenants",
      icon: "🏪",
      available: true,
    },
    {
      title: "LINE連携設定",
      description: "LINE Official Accountと連携して、顧客に予約リマインダーやメッセージを送信",
      href: "/settings/line",
      icon: "💬",
      badge: "Enterprise",
      available: true,
    },
    {
      title: "Googleカレンダー連携",
      description: "スタッフのGoogleカレンダーと同期して、予約管理を効率化",
      href: "/settings/google-calendar",
      icon: "📅",
      available: true,
    },
    {
      title: "営業時間設定",
      description: "サロンの営業時間、定休日、予約可能時間帯を設定",
      href: "/settings/business-hours",
      icon: "🕐",
      available: false,
    },
    {
      title: "スタッフ管理",
      description: "スタッフの招待・管理、役割と権限の設定",
      href: "/settings/staff",
      icon: "👥",
      available: true,
    },
    {
      title: "通知設定",
      description: "メール通知、アラート、リマインダーの設定をカスタマイズ",
      href: "/settings/notifications",
      icon: "🔔",
      available: false,
    },
  ];

  return (
    <MainLayout>
      <div>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
            設定
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280" }}>システム設定と機能管理</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {settingsCards.map((card) => (
            <Link
              key={card.title}
              href={card.available ? card.href : "#"}
              style={{
                display: "block",
                padding: "24px",
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textDecoration: "none",
                transition: "all 0.2s",
                position: "relative",
                cursor: card.available ? "pointer" : "not-allowed",
                opacity: card.available ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (card.available) {
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontSize: "32px" }}>{card.icon}</div>
                {card.badge && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "4px 8px",
                      backgroundColor: "#dbeafe",
                      color: "#1e40af",
                      borderRadius: "4px",
                    }}
                  >
                    {card.badge}
                  </span>
                )}
                {!card.available && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "4px 8px",
                      backgroundColor: "#f3f4f6",
                      color: "#6b7280",
                      borderRadius: "4px",
                    }}
                  >
                    準備中
                  </span>
                )}
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: "8px",
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: "1.5",
                }}
              >
                {card.description}
              </p>
              {card.available && (
                <div
                  style={{
                    marginTop: "16px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#3b82f6",
                  }}
                >
                  設定を開く
                  <span style={{ marginLeft: "4px" }}>→</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
