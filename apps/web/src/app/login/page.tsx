"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// 開発用のテストアカウント
const DEV_ACCOUNT = {
  email: "test@corevo.dev",
  password: "test1234",
};

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      console.log("[Login] Attempting login with:", email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("[Login] Login successful, user:", user.uid);

      // Get token and claims
      const tokenResult = await user.getIdTokenResult(true);
      console.log("[Login] Token claims:", tokenResult.claims);

      // Save tenantId to localStorage for dev mode
      if (isDev) {
        const tenantIds = tokenResult.claims.tenantIds as string[] | undefined;
        if (tenantIds && tenantIds.length > 0) {
          localStorage.setItem("dev_tenantId", tenantIds[0]);
          console.log("[Login] Saved tenantId to localStorage:", tenantIds[0]);
        }
      }

      setMessage("ログイン成功！ダッシュボードに移動します...");

      // Wait a moment then redirect
      setTimeout(() => {
        console.log("[Login] Redirecting to dashboard");
        router.push("/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("[Login] Login error:", error);
      setError(error.message || "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevAutoFill = () => {
    setEmail(DEV_ACCOUNT.email);
    setPassword(DEV_ACCOUNT.password);
    setMessage("開発用アカウント情報を入力しました");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Corevo</CardTitle>
          <CardDescription>サロン経営OS - ログイン</CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="salon@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>

          {isDev && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-gray-500 text-center mb-3">
                開発環境専用
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDevAutoFill}
                disabled={isLoading}
              >
                テストアカウントで自動入力
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
