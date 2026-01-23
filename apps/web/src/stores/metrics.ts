import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  MetricsExtended,
  GetMetricsRequest,
  GetMetricsResponse,
  CalculateMetricsRequest,
  CalculateMetricsResponse,
} from "@/types";

interface MetricsState {
  metrics: MetricsExtended[];
  loading: boolean;
  error: string | null;

  fetchMetrics: (params: GetMetricsRequest) => Promise<void>;
  calculateMetrics: (data: CalculateMetricsRequest) => Promise<string>;
  clearError: () => void;
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  metrics: [],
  loading: false,
  error: null,

  fetchMetrics: async (params: GetMetricsRequest) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getMetricsFunc = httpsCallable<GetMetricsRequest, GetMetricsResponse>(
        functions,
        "getMetrics"
      );

      const result = await getMetricsFunc(params);

      if (result.data.success) {
        set({ metrics: result.data.metrics, loading: false });
      } else {
        throw new Error("Failed to fetch metrics");
      }
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      set({ error: error.message || "Failed to fetch metrics", loading: false });
    }
  },

  calculateMetrics: async (data: CalculateMetricsRequest) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const calculateMetricsFunc = httpsCallable<CalculateMetricsRequest, CalculateMetricsResponse>(
        functions,
        "calculateDailyMetrics"
      );

      const result = await calculateMetricsFunc(data);

      if (result.data.success) {
        // Refresh metrics list after calculation
        await get().fetchMetrics({
          tenantId: data.tenantId,
          period: data.period,
          limit: 30,
        });
        set({ loading: false });
        return result.data.metricId;
      } else {
        throw new Error("Failed to calculate metrics");
      }
    } catch (error: any) {
      console.error("Error calculating metrics:", error);
      set({ error: error.message || "Failed to calculate metrics", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
