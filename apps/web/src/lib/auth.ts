import { useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth";
import { doc, getDoc } from "firebase/firestore";

/**
 * useAuth hook - Firebase認証状態とユーザー情報を取得
 * LINE設定ページなどで使用
 */
export function useAuth() {
  const { firebaseUser, loading } = useAuthStore();

  return {
    user: firebaseUser, // FirebaseUser object
    loading,
  };
}

/**
 * useAuthData hook - 完全な認証データを取得
 */
export function useAuthData() {
  const { firebaseUser, user, tenant, tenantIds, loading } = useAuthStore();

  return {
    firebaseUser,
    user,
    tenant,
    tenantIds,
    loading,
  };
}

/**
 * useFirebaseAuth hook - シンプルなFirebase認証フック（MainLayout互換）
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

/**
 * Platform Admin 用のメールアドレスホワイトリスト（暫定）
 * 販売開始前に Firestore フラグ方式に完全移行する予定
 */
const PLATFORM_ADMIN_EMAILS = [
  "admin@corevo.com",
  "test@test.com",
  "admin@test.com",
  "user@example.com",
  // 必要に応じて追加
];

/**
 * Platform Admin かどうかを判定する（ハイブリッド方式）
 *
 * 優先順位:
 * 1. Firestore の isPlatformAdmin フラグ（B案 - 本格運用）
 * 2. メールアドレスホワイトリスト（A案 - 暫定運用）
 *
 * @param uid Firebase Auth User ID
 * @param email ユーザーのメールアドレス
 * @returns Platform Admin の場合 true
 */
export async function isPlatformAdmin(
  uid: string,
  email: string
): Promise<boolean> {
  try {
    // 優先順位1: Firestore の isPlatformAdmin フラグをチェック
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData?.isPlatformAdmin === true) {
        return true;
      }
    }

    // 優先順位2: メールアドレスホワイトリスト（暫定）
    if (PLATFORM_ADMIN_EMAILS.includes(email)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking Platform Admin status:", error);
    return false;
  }
}

/**
 * ユーザーの役割に応じたリダイレクト先を決定する
 *
 * @param uid Firebase Auth User ID
 * @param email ユーザーのメールアドレス
 * @returns リダイレクト先のパス
 */
export async function getRedirectPathForUser(
  uid: string,
  email: string
): Promise<string> {
  const isAdmin = await isPlatformAdmin(uid, email);

  if (isAdmin) {
    return "/platform-admin";
  }

  // 通常のユーザー（Organization Owner / Tenant Manager / Staff）
  return "/dashboard";
}
