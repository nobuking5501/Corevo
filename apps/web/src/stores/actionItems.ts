import { create } from "zustand";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  ActionItem,
  CreateActionItemRequest,
  UpdateActionItemRequest,
  DeleteActionItemRequest,
  GetActionItemsRequest,
  GetActionItemsResponse,
} from "@/types";

interface ActionItemsState {
  actionItems: ActionItem[];
  loading: boolean;
  error: string | null;

  fetchActionItems: (params: GetActionItemsRequest) => Promise<void>;
  createActionItem: (data: Omit<CreateActionItemRequest, "tenantId">, tenantId: string) => Promise<string>;
  updateActionItem: (data: Omit<UpdateActionItemRequest, "tenantId">, tenantId: string) => Promise<void>;
  deleteActionItem: (actionId: string, tenantId: string) => Promise<void>;
  clearError: () => void;
}

export const useActionItemsStore = create<ActionItemsState>((set, get) => ({
  actionItems: [],
  loading: false,
  error: null,

  fetchActionItems: async (params: GetActionItemsRequest) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getActionItemsFunc = httpsCallable<GetActionItemsRequest, GetActionItemsResponse>(
        functions,
        "getActionItems"
      );

      const result = await getActionItemsFunc(params);

      if (result.data.success) {
        set({ actionItems: result.data.actionItems, loading: false });
      } else {
        throw new Error("Failed to fetch action items");
      }
    } catch (error: any) {
      console.error("Error fetching action items:", error);
      set({ error: error.message || "Failed to fetch action items", loading: false });
    }
  },

  createActionItem: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const createActionItemFunc = httpsCallable<CreateActionItemRequest, { success: boolean; actionId: string }>(
        functions,
        "createActionItem"
      );

      const result = await createActionItemFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh action items list
        await get().fetchActionItems({ tenantId, limit: 100 });
        set({ loading: false });
        return result.data.actionId;
      } else {
        throw new Error("Failed to create action item");
      }
    } catch (error: any) {
      console.error("Error creating action item:", error);
      set({ error: error.message || "Failed to create action item", loading: false });
      throw error;
    }
  },

  updateActionItem: async (data, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const updateActionItemFunc = httpsCallable<UpdateActionItemRequest, { success: boolean }>(
        functions,
        "updateActionItem"
      );

      const result = await updateActionItemFunc({ ...data, tenantId });

      if (result.data.success) {
        // Refresh action items list
        await get().fetchActionItems({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to update action item");
      }
    } catch (error: any) {
      console.error("Error updating action item:", error);
      set({ error: error.message || "Failed to update action item", loading: false });
      throw error;
    }
  },

  deleteActionItem: async (actionId, tenantId) => {
    set({ loading: true, error: null });
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const deleteActionItemFunc = httpsCallable<DeleteActionItemRequest, { success: boolean }>(
        functions,
        "deleteActionItem"
      );

      const result = await deleteActionItemFunc({ tenantId, actionId });

      if (result.data.success) {
        // Refresh action items list
        await get().fetchActionItems({ tenantId, limit: 100 });
        set({ loading: false });
      } else {
        throw new Error("Failed to delete action item");
      }
    } catch (error: any) {
      console.error("Error deleting action item:", error);
      set({ error: error.message || "Failed to delete action item", loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
