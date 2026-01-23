import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Ad,
  CreateAdRequest,
  UpdateAdRequest,
  GetAdsRequest,
  GetAdsResponse,
} from "@/types";

interface AdsState {
  ads: Ad[];
  loading: boolean;
  error: string | null;

  fetchAds: (params: GetAdsRequest) => Promise<void>;
  createAd: (data: Omit<CreateAdRequest, "tenantId">, tenantId: string) => Promise<string>;
  updateAd: (data: Omit<UpdateAdRequest, "tenantId">, tenantId: string) => Promise<void>;
  deleteAd: (adId: string, tenantId: string) => Promise<void>;
  clearError: () => void;
}

export const useAdsStore = create<AdsState>((set, get) => ({
  ads: [],
  loading: false,
  error: null,

  fetchAds: async (params: GetAdsRequest) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getAdsFunc = httpsCallable<GetAdsRequest, GetAdsResponse>(
        functions,
        "getAds"
      );

      const result = await getAdsFunc(params);

      if (result.data.success) {
        set({ ads: result.data.ads, loading: false });
      } else {
        throw new Error("Failed to fetch ads");
      }
    } catch (error: any) {
      console.error("Error fetching ads:", error);
      set({ error: error.message || "Failed to fetch ads", loading: false });
    }
  },

  createAd: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const createAdFunc = httpsCallable<CreateAdRequest, { success: boolean; adId: string }>(
        functions,
        "createAd"
      );

      const result = await createAdFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh ads list
        await get().fetchAds({ tenantId, limit: 100 });
        set({ loading: false });
        return result.data.adId;
      } else {
        throw new Error("Failed to create ad");
      }
    } catch (error: any) {
      console.error("Error creating ad:", error);
      set({ error: error.message || "Failed to create ad", loading: false });
      throw error;
    }
  },

  updateAd: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const updateAdFunc = httpsCallable<UpdateAdRequest, { success: boolean }>(
        functions,
        "updateAd"
      );

      const result = await updateAdFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh ads list
        await get().fetchAds({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to update ad");
      }
    } catch (error: any) {
      console.error("Error updating ad:", error);
      set({ error: error.message || "Failed to update ad", loading: false });
      throw error;
    }
  },

  deleteAd: async (adId, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const deleteAdFunc = httpsCallable<{ tenantId: string; adId: string }, { success: boolean }>(
        functions,
        "deleteAd"
      );

      const result = await deleteAdFunc({ tenantId, adId });

      if (result.data.success) {
        // Refresh ads list
        await get().fetchAds({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to delete ad");
      }
    } catch (error: any) {
      console.error("Error deleting ad:", error);
      set({ error: error.message || "Failed to delete ad", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
