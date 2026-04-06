import { Subscription } from "./types";

const store: Record<string, Subscription[]> = {};

export const db = {
  getUserSubs(userId: string): Subscription[] {
    return store[userId] ?? [];
  },
  addSub(userId: string, sub: Subscription): Subscription[] {
    store[userId] = [...(store[userId] ?? []), sub];
    return store[userId];
  },
  deleteSub(userId: string, subId: string): Subscription[] {
    store[userId] = (store[userId] ?? []).filter(s => s.id !== subId);
    return store[userId];
  },
  updateSub(userId: string, subId: string, patch: Partial<Subscription>): Subscription[] {
    store[userId] = (store[userId] ?? []).map(s => s.id === subId ? { ...s, ...patch } : s);
    return store[userId];
  },
};