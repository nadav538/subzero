export type Category = "entertainment" | "music" | "software" | "storage" | "news" | "fitness" | "other";
export type Rating = "waste" | "medium" | "worth";

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  price: number;
  category: Category;
  rating: Rating;
  createdAt: string;
  notes?: string;
}

export interface Insight {
  type: "cancel_candidate" | "most_expensive" | "daily_tip";
  subId?: string;
  subName?: string;
  price?: number;
  message: string;
  savings?: number;
}