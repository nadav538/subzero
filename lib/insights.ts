import { Subscription, Insight } from "./types";

const TIPS_EN = [
  (name: string, price: number) => `When did you last use ${name}? If you can't remember, that's ₪${price} wasted every month.`,
  (name: string, price: number) => `${name} costs ₪${price * 12} per year. Is it worth it?`,
  (name: string, _: number) => `Try going one week without ${name}. You might not miss it.`,
  (name: string, price: number) => `Cancelling ${name} saves ₪${price} this month — ₪${price * 12} a year.`,
];

const TIPS_HE = [
  (name: string, price: number) => `מתי השתמשת לאחרונה ב-${name}? אם אתה לא זוכר, זה ₪${price} לחינם כל חודש.`,
  (name: string, price: number) => `${name} עולה ₪${price * 12} בשנה. האם זה שווה?`,
  (name: string, _: number) => `נסה שבוע ללא ${name}. אולי לא תתגעגע.`,
  (name: string, price: number) => `ביטול ${name} חוסך ₪${price * 12} בשנה.`,
];

export function getInsights(subs: Subscription[], lang: "en" | "he"): Insight[] {
  const insights: Insight[] = [];
  if (!subs.length) return insights;

  const mostExpensive = [...subs].sort((a, b) => b.price - a.price)[0];
  if (mostExpensive) {
    insights.push({
      type: "most_expensive",
      subId: mostExpensive.id,
      subName: mostExpensive.name,
      price: mostExpensive.price,
      message: lang === "he"
        ? `${mostExpensive.name} הוא המנוי היקר ביותר שלך — ₪${mostExpensive.price}/חודש`
        : `${mostExpensive.name} is your most expensive subscription — ₪${mostExpensive.price}/mo`,
    });
  }

  const wasteSubs = subs.filter(s => s.rating === "waste");
  wasteSubs.forEach(s => {
    insights.push({
      type: "cancel_candidate",
      subId: s.id,
      subName: s.name,
      price: s.price,
      savings: s.price * 12,
      message: lang === "he"
        ? `ביטול ${s.name} יחסוך ₪${s.price * 12} בשנה`
        : `Cancelling ${s.name} saves ₪${s.price * 12}/year`,
    });
  });

  const tipTarget = subs[Math.floor(Math.random() * subs.length)];
  if (tipTarget) {
    const pool = lang === "he" ? TIPS_HE : TIPS_EN;
    const tip = pool[Math.floor(Math.random() * pool.length)];
    insights.push({
      type: "daily_tip",
      subId: tipTarget.id,
      subName: tipTarget.name,
      price: tipTarget.price,
      message: tip(tipTarget.name, tipTarget.price),
    });
  }

  return insights;
}

export function getTotals(subs: Subscription[]) {
  const monthly = subs.reduce((a, b) => a + b.price, 0);
  const yearly = monthly * 12;
  const wastedMonthly = subs.filter(s => s.rating === "waste").reduce((a, b) => a + b.price, 0);
  const wastedYearly = wastedMonthly * 12;
  return { monthly, yearly, wastedMonthly, wastedYearly };
}