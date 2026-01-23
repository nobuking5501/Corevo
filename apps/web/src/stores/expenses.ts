import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Expense,
  UpsertExpenseRequest,
  GetExpenseRequest,
  GetExpenseResponse,
} from "@/types";

interface ExpensesState {
  expenses: Record<string, Expense>; // key: month (YYYY-MM)
  loading: boolean;
  error: string | null;

  fetchExpense: (tenantId: string, month: string) => Promise<void>;
  upsertExpense: (data: Omit<UpsertExpenseRequest, "tenantId">, tenantId: string) => Promise<void>;
  clearError: () => void;
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: {},
  loading: false,
  error: null,

  fetchExpense: async (tenantId: string, month: string) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getExpenseFunc = httpsCallable<GetExpenseRequest, GetExpenseResponse>(
        functions,
        "getExpense"
      );

      const result = await getExpenseFunc({ tenantId, month });

      if (result.data.success) {
        const { expense } = result.data;
        if (expense) {
          set((state) => ({
            expenses: {
              ...state.expenses,
              [month]: expense,
            },
            loading: false,
          }));
        } else {
          // No expense data for this month
          set({ loading: false });
        }
      } else {
        throw new Error("Failed to fetch expense");
      }
    } catch (error: any) {
      console.error("Error fetching expense:", error);
      set({ error: error.message || "Failed to fetch expense", loading: false });
    }
  },

  upsertExpense: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const upsertExpenseFunc = httpsCallable<UpsertExpenseRequest, { success: boolean; expenseId: string }>(
        functions,
        "upsertExpense"
      );

      const result = await upsertExpenseFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh the expense for this month
        await get().fetchExpense(tenantId, data.month);
        set({ loading: false });
      } else {
        throw new Error("Failed to save expense");
      }
    } catch (error: any) {
      console.error("Error saving expense:", error);
      set({ error: error.message || "Failed to save expense", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
