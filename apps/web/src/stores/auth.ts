import { create } from "zustand";
import { User as FirebaseUser } from "firebase/auth";
import { User, Tenant, Organization, UserRole } from "@/types";

interface AuthState {
  // Firebase User
  firebaseUser: FirebaseUser | null;

  // Organization (組織)
  organization: Organization | null;
  organizationId: string | null;

  // Current Tenant (現在選択中の店舗)
  currentTenant: Tenant | null;
  currentTenantId: string | null;

  // User info in current tenant
  user: User | null;

  // All accessible tenants (アクセス可能な全店舗)
  tenants: Tenant[];
  tenantIds: string[];

  // User roles per tenant
  roles: Record<string, UserRole>;

  loading: boolean;

  // Actions
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setOrganization: (org: Organization | null) => void;
  setOrganizationId: (id: string | null) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setCurrentTenantId: (id: string | null) => void;
  setUser: (user: User | null) => void;
  setTenants: (tenants: Tenant[]) => void;
  setTenantIds: (ids: string[]) => void;
  setRoles: (roles: Record<string, UserRole>) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  organization: null,
  organizationId: null,
  currentTenant: null,
  currentTenantId: null,
  user: null,
  tenants: [],
  tenantIds: [],
  roles: {},
  loading: true,

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setOrganization: (organization) => set({ organization }),
  setOrganizationId: (organizationId) => set({ organizationId }),
  setCurrentTenant: (currentTenant) => set({ currentTenant }),
  setCurrentTenantId: (currentTenantId) => set({ currentTenantId }),
  setUser: (user) => set({ user }),
  setTenants: (tenants) => set({ tenants }),
  setTenantIds: (tenantIds) => set({ tenantIds }),
  setRoles: (roles) => set({ roles }),
  setLoading: (loading) => set({ loading }),

  logout: () =>
    set({
      firebaseUser: null,
      organization: null,
      organizationId: null,
      currentTenant: null,
      currentTenantId: null,
      user: null,
      tenants: [],
      tenantIds: [],
      roles: {},
    }),
}));
