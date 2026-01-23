"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [authState, setAuthState] = useState<string>("初期化中...");

  const addLog = (message: string) => {
    console.log(message);
    setLogs((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    addLog("DebugPage: Component mounted");
    addLog(`Firebase Auth: ${auth ? "初期化済み" : "未初期化"}`);
    addLog(`Firestore: ${db ? "初期化済み" : "未初期化"}`);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        addLog(`onAuthStateChanged: ユーザーあり (uid: ${user.uid})`);
        setAuthState(`ログイン中: ${user.email}`);

        // Try to get token
        user.getIdTokenResult(false)
          .then((tokenResult) => {
            addLog(`Token claims: ${JSON.stringify(tokenResult.claims)}`);
          })
          .catch((error) => {
            addLog(`Token取得エラー: ${error.message}`);
          });
      } else {
        addLog("onAuthStateChanged: ユーザーなし");
        setAuthState("未ログイン");
      }
    });

    return () => {
      addLog("DebugPage: Component unmounting");
      unsubscribe();
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", fontSize: "14px" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Firebase デバッグページ</h1>

      <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f0f0f0" }}>
        <strong>認証状態:</strong> {authState}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <strong>環境変数チェック:</strong>
        <ul>
          <li>NEXT_PUBLIC_FIREBASE_API_KEY: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "設定済み" : "未設定"}</li>
          <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "未設定"}</li>
          <li>NEXT_PUBLIC_APP_ENV: {process.env.NEXT_PUBLIC_APP_ENV || "未設定"}</li>
        </ul>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <strong>ログ:</strong>
        <div style={{
          maxHeight: "400px",
          overflow: "auto",
          backgroundColor: "#000",
          color: "#0f0",
          padding: "10px",
          fontSize: "12px"
        }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>

      <div>
        <a href="/login" style={{ color: "blue", textDecoration: "underline" }}>ログインページへ</a>
        {" | "}
        <a href="/test" style={{ color: "blue", textDecoration: "underline" }}>テストページへ</a>
      </div>
    </div>
  );
}
