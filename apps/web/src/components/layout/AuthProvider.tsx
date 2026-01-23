"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth";
import { User, Tenant, Organization, UserRole } from "@/types";

const PUBLIC_PATHS = ["/login"];
const TENANT_SELECTION_PATH = "/select-tenant";
const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    setFirebaseUser,
    setOrganization,
    setOrganizationId,
    setCurrentTenant,
    setCurrentTenantId,
    setUser,
    setTenants,
    setTenantIds,
    setRoles,
    setLoading,
    logout,
  } = useAuthStore();

  useEffect(() => {
    console.log("[AuthProvider] useEffect triggered, pathname:", pathname);

    const timeoutId = setTimeout(() => {
      console.error("[AuthProvider] TIMEOUT: Loading took more than 10 seconds");
      setLoading(false);
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthProvider] onAuthStateChanged fired, user:", firebaseUser?.uid || "null");
      setLoading(true);

      if (!firebaseUser) {
        console.log("[AuthProvider] No user, logging out");
        logout();
        setLoading(false);
        clearTimeout(timeoutId);
        if (!PUBLIC_PATHS.includes(pathname) && pathname !== TENANT_SELECTION_PATH) {
          router.push("/login");
        }
        return;
      }

      try {
        setFirebaseUser(firebaseUser);

        // Get custom claims (force refresh to get latest claims)
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const organizationId = tokenResult.claims.organizationId as string | undefined;
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];
        const roles = (tokenResult.claims.roles as Record<string, UserRole>) || {};

        console.log("[AuthProvider] Claims:", { organizationId, tenantIds, roles });

        // 開発モード：Custom Claimsがない場合は自動的にテナントを検索
        if (isDev && tenantIds.length === 0) {
          console.log("[AuthProvider] Dev mode: No custom claims, searching for user's tenants...");

          // 開発モード：全テナントを検索してユーザーが所属するテナントを見つける
          console.log("[AuthProvider] Searching Firestore for user's tenants...");
          try {
            const tenantsSnapshot = await getDocs(collection(db, "tenants"));
            const userTenantIds: string[] = [];

            for (const tenantDoc of tenantsSnapshot.docs) {
              const userDocRef = doc(db, `tenants/${tenantDoc.id}/users`, firebaseUser.uid);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                console.log("[AuthProvider] Found user in tenant:", tenantDoc.id);
                userTenantIds.push(tenantDoc.id);
              }
            }

            if (userTenantIds.length > 0) {
              tenantIds = userTenantIds;
              console.log("[AuthProvider] Auto-detected tenants:", userTenantIds);
            } else {
              console.error("[AuthProvider] No tenants found for user!");
            }
          } catch (error) {
            console.error("[AuthProvider] Error searching for user's tenants:", error);
          }

          if (tenantIds.length > 0) {
            setTenantIds(tenantIds);
            // Dev modeではowner権限を付与
            const devRoles: Record<string, UserRole> = {};
            tenantIds.forEach(tid => { devRoles[tid] = "owner"; });
            setRoles(devRoles);

            // 開発用：ダミー組織を作成
            const dummyOrgId = `dev_org_${tenantIds[0]}`;
            setOrganizationId(dummyOrgId);
            setOrganization({
              id: dummyOrgId,
              name: "開発用組織",
              ownerId: firebaseUser.uid,
              plan: "trial",
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            console.log("[AuthProvider] Created dummy organization:", dummyOrgId);
          }
        }

        // No organization and no tenants → redirect to onboarding
        if (!organizationId && tenantIds.length === 0) {
          console.log("[AuthProvider] No organization, redirecting to onboarding");
          setLoading(false);
          clearTimeout(timeoutId);
          if (pathname !== "/onboarding") {
            router.push("/onboarding");
          }
          return;
        }

        // Set organization and tenants
        setOrganizationId(organizationId || null);
        setTenantIds(tenantIds);
        setRoles(roles);

        // Load organization data
        if (organizationId && !organizationId.startsWith("dev_org_")) {
          try {
            const orgDoc = await getDoc(doc(db, "organizations", organizationId));
            if (orgDoc.exists()) {
              const orgData = orgDoc.data() as Organization;
              setOrganization({ ...orgData, id: orgDoc.id });
            }
          } catch (error) {
            console.warn("[AuthProvider] Could not load organization:", error);
          }
        }

        // Load all accessible tenants
        const tenantsData: Tenant[] = [];
        for (const tenantId of tenantIds) {
          try {
            const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
            if (tenantDoc.exists()) {
              const tenantData = tenantDoc.data();
              tenantsData.push({
                id: tenantDoc.id,
                organizationId: organizationId || `dev_org_${tenantId}`,
                name: tenantData.name || "店舗",
                slug: tenantData.slug || tenantId,
                status: tenantData.status || "active",
                createdAt: tenantData.createdAt?.toDate() || new Date(),
                updatedAt: tenantData.updatedAt?.toDate() || new Date(),
              } as Tenant);
            }
          } catch (error) {
            console.warn(`[AuthProvider] Could not load tenant ${tenantId}:`, error);
          }
        }
        setTenants(tenantsData);

        // Determine current tenant
        let currentTenantId = localStorage.getItem("currentTenantId");

        // If no saved tenant or saved tenant is not accessible, use first tenant
        if (!currentTenantId || !tenantIds.includes(currentTenantId)) {
          currentTenantId = tenantIds[0];
          localStorage.setItem("currentTenantId", currentTenantId);
        }
        console.log("[AuthProvider] Using tenant:", currentTenantId);

        // If multiple tenants and no tenant selected, redirect to selection
        if (
          tenantIds.length > 1 &&
          pathname !== TENANT_SELECTION_PATH &&
          !PUBLIC_PATHS.includes(pathname) &&
          pathname !== "/onboarding"
        ) {
          const savedTenant = localStorage.getItem("currentTenantId");
          if (!savedTenant || !tenantIds.includes(savedTenant)) {
            setLoading(false);
            clearTimeout(timeoutId);
            router.push(TENANT_SELECTION_PATH);
            return;
          }
        }

        setCurrentTenantId(currentTenantId);

        // Load current tenant data
        const currentTenantFromList = tenantsData.find(t => t.id === currentTenantId);
        if (currentTenantFromList) {
          setCurrentTenant(currentTenantFromList);
        } else {
          try {
            const currentTenantDoc = await getDoc(doc(db, "tenants", currentTenantId));
            if (currentTenantDoc.exists()) {
              const tenantData = currentTenantDoc.data();
              setCurrentTenant({
                id: currentTenantDoc.id,
                organizationId: organizationId || `dev_org_${currentTenantId}`,
                name: tenantData.name || "店舗",
                slug: tenantData.slug || currentTenantId,
                status: tenantData.status || "active",
                createdAt: tenantData.createdAt?.toDate() || new Date(),
                updatedAt: tenantData.updatedAt?.toDate() || new Date(),
              } as Tenant);
            }
          } catch (error) {
            console.warn("[AuthProvider] Could not load current tenant:", error);
          }
        }

        // Load user data from current tenant
        try {
          const userDocRef = doc(db, `tenants/${currentTenantId}/users`, firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: userDoc.id,
              organizationId: organizationId || `dev_org_${currentTenantId}`,
              tenantIds: tenantIds,
              email: userData.email || firebaseUser.email || "",
              displayName: userData.displayName || firebaseUser.displayName || "ユーザー",
              roles: roles,
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date(),
            } as User);
          }
        } catch (error) {
          console.warn("[AuthProvider] Could not load user data:", error);
        }

        setLoading(false);
        clearTimeout(timeoutId);

        // Redirect from login if authenticated
        if (pathname === "/login") {
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("[AuthProvider] Error:", error);
        logout();
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [
    pathname,
    router,
    setFirebaseUser,
    setOrganization,
    setOrganizationId,
    setCurrentTenant,
    setCurrentTenantId,
    setUser,
    setTenants,
    setTenantIds,
    setRoles,
    setLoading,
    logout,
  ]);

  return <>{children}</>;
}
