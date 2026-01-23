import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Sale,
  CreateSaleRequest,
  UpdateSaleRequest,
  GetSalesRequest,
  GetSalesResponse,
} from "@/types";

interface SalesState {
  sales: Sale[];
  loading: boolean;
  error: string | null;

  fetchSales: (params: GetSalesRequest) => Promise<void>;
  createSale: (data: Omit<CreateSaleRequest, "tenantId">, tenantId: string) => Promise<string>;
  updateSale: (data: Omit<UpdateSaleRequest, "tenantId">, tenantId: string) => Promise<void>;
  deleteSale: (saleId: string, tenantId: string) => Promise<void>;
  clearError: () => void;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  loading: false,
  error: null,

  fetchSales: async (params: GetSalesRequest) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getSalesFunc = httpsCallable<GetSalesRequest, GetSalesResponse>(
        functions,
        "getSales"
      );

      const result = await getSalesFunc(params);

      if (result.data.success) {
        set({ sales: result.data.sales, loading: false });
      } else {
        throw new Error("Failed to fetch sales");
      }
    } catch (error: any) {
      console.error("Error fetching sales:", error);
      set({ error: error.message || "Failed to fetch sales", loading: false });
    }
  },

  createSale: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const createSaleFunc = httpsCallable<CreateSaleRequest, { success: boolean; saleId: string }>(
        functions,
        "createSale"
      );

      const result = await createSaleFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh sales list
        await get().fetchSales({ tenantId, limit: 100 });
        set({ loading: false });
        return result.data.saleId;
      } else {
        throw new Error("Failed to create sale");
      }
    } catch (error: any) {
      console.error("Error creating sale:", error);
      set({ error: error.message || "Failed to create sale", loading: false });
      throw error;
    }
  },

  updateSale: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const updateSaleFunc = httpsCallable<UpdateSaleRequest, { success: boolean }>(
        functions,
        "updateSale"
      );

      const result = await updateSaleFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh sales list
        await get().fetchSales({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to update sale");
      }
    } catch (error: any) {
      console.error("Error updating sale:", error);
      set({ error: error.message || "Failed to update sale", loading: false });
      throw error;
    }
  },

  deleteSale: async (saleId, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const deleteSaleFunc = httpsCallable<{ tenantId: string; saleId: string }, { success: boolean }>(
        functions,
        "deleteSale"
      );

      const result = await deleteSaleFunc({ tenantId, saleId });

      if (result.data.success) {
        // Refresh sales list
        await get().fetchSales({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to delete sale");
      }
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      set({ error: error.message || "Failed to delete sale", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
