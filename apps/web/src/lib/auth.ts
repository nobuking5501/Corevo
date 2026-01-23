import { useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth";

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
