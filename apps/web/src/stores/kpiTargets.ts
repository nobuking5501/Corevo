import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  KPITarget,
  UpdateKPITargetsRequest,
  GetKPITargetsRequest,
  GetKPITargetsResponse,
} from "@/types";

interface KPITargetsState {
  targets: KPITarget | null;
  loading: boolean;
  error: string | null;

  fetchKPITargets: (tenantId: string) => Promise<void>;
  updateKPITargets: (data: Omit<UpdateKPITargetsRequest, "tenantId">, tenantId: string) => Promise<void>;
  clearError: () => void;
}

export const useKPITargetsStore = create<KPITargetsState>((set, get) => ({
  targets: null,
  loading: false,
  error: null,

  fetchKPITargets: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getKPITargetsFunc = httpsCallable<GetKPITargetsRequest, GetKPITargetsResponse>(
        functions,
        "getKPITargets"
      );

      const result = await getKPITargetsFunc({ tenantId });

      if (result.data.success) {
        set({ targets: result.data.targets, loading: false });
      } else {
        throw new Error("Failed to fetch KPI targets");
      }
    } catch (error: any) {
      console.error("Error fetching KPI targets:", error);
      set({ error: error.message || "Failed to fetch KPI targets", loading: false });
    }
  },

  updateKPITargets: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const updateKPITargetsFunc = httpsCallable<UpdateKPITargetsRequest, { success: boolean }>(
        functions,
        "updateKPITargets"
      );

      const result = await updateKPITargetsFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh targets
        await get().fetchKPITargets(tenantId);
        set({ loading: false });
      } else {
        throw new Error("Failed to update KPI targets");
      }
    } catch (error: any) {
      console.error("Error updating KPI targets:", error);
      set({ error: error.message || "Failed to update KPI targets", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
