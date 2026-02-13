import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Storage は将来の機能用（今は不要）
// Blazeプランにアップグレード後に有効化する
export const storage = firebaseConfig.storageBucket
  ? getStorage(app)
  : null;

export const functions = getFunctions(app, "asia-northeast1");

// Emulator接続（開発環境のみ）
if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
  if (typeof window !== "undefined") {
    // クライアントサイドのみで実行（SSRエラー回避）
    try {
      // 既に接続済みの場合はスキップ（Hot Reloadエラー回避）
      // @ts-ignore - _settingsは内部プロパティ
      if (!auth._settings?.appVerificationDisabledForTesting) {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      }
      // @ts-ignore - _settingsは内部プロパティ
      if (!db._settings?.host?.includes("127.0.0.1")) {
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
      }
      // @ts-ignore - _urlは内部プロパティ
      if (!functions._url || (typeof functions._url === "string" && !functions._url.includes("127.0.0.1"))) {
        connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      }
    } catch (error) {
      // 既に接続済みの場合はエラーを無視
      console.log("[Firebase] Emulator already connected or error:", error);
    }
  }
}
