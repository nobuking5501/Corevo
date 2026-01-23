"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: "center", padding: "50px" }}>読み込み中...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
          ダッシュボード
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>サロン経営の統合管理</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        <div style={{ padding: "30px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>今日の売上</h3>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#111" }}>¥0</p>
        </div>

        <div style={{ padding: "30px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>週間売上</h3>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#111" }}>¥0</p>
        </div>

        <div style={{ padding: "30px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>予約数</h3>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#111" }}>0</p>
        </div>

        <div style={{ padding: "30px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>顧客数</h3>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#111" }}>0</p>
        </div>
      </div>

      <div style={{ padding: "24px", backgroundColor: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "8px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1e40af", marginBottom: "12px" }}>
          ようこそ Corevo へ！
        </h2>
        <p style={{ fontSize: "14px", color: "#1e3a8a", marginBottom: "12px" }}>
          サロン経営統合プラットフォームです。左側のメニューから各機能にアクセスできます。
        </p>
        <ul style={{ listStyle: "disc", paddingLeft: "24px", color: "#1e3a8a", fontSize: "14px", lineHeight: "1.8" }}>
          <li>予約管理で新規予約を登録</li>
          <li>顧客管理で顧客情報を管理</li>
          <li>メニュー管理でサービスを設定</li>
          <li>カレンダーで予約状況を確認</li>
        </ul>
      </div>
    </div>
    </MainLayout>
  );
}
