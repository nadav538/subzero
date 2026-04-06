"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Subscription, Category, Rating } from "@/lib/types";
import { getInsights, getTotals } from "@/lib/insights";

// ─── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "en" | "he";
const T = {
  en: {
    greeting: "Hello", dashSub: "Your subscription overview",
    totalMo: "Monthly Total", totalYr: "Yearly Total",
    wasted: "Being Wasted", wastedYr: "Wasted Per Year",
    noSubs: "No subscriptions yet. Add your first one below!",
    addTitle: "Add Subscription", nameLbl: "Service Name", namePh: "Netflix, Spotify...",
    priceLbl: "Monthly Price (₪)", catLbl: "Category", ratingLbl: "Rating",
    addBtn: "Add", cancel: "Cancel", delete: "Delete",
    cats: { entertainment:"Entertainment", music:"Music", software:"Software", storage:"Storage", news:"News", fitness:"Fitness", other:"Other" },
    ratings: { waste:"🔴 Waste", medium:"🟡 Medium", worth:"🟢 Worth it" },
    insightsTitle: "Smart Insights", cancelCandidate: "Consider cancelling",
    mostExpensive: "Most expensive", dailyTip: "Daily tip",
    savingsTitle: "Savings Calculator", cancelAllWaste: "Cancel all 🔴 subs",
    youSave: "You'd save", perYear: "per year",
    filterAll: "All", filterWaste: "🔴 Waste", filterMed: "🟡 Medium", filterWorth: "🟢 Worth it",
    subsTitle: "My Subscriptions", perMonth: "/mo",
    langBtn: "עברית 🇮🇱",
    confirmDel: "Delete this subscription?",
  },
  he: {
    greeting: "שלום", dashSub: "סקירת המנויים שלך",
    totalMo: "סה״כ חודשי", totalYr: "סה״כ שנתי",
    wasted: "הולך לאיבוד", wastedYr: "בזבוז שנתי",
    noSubs: "אין מנויים עדיין. הוסף את הראשון!",
    addTitle: "הוסף מנוי", nameLbl: "שם השירות", namePh: "Netflix, Spotify...",
    priceLbl: "מחיר חודשי (₪)", catLbl: "קטגוריה", ratingLbl: "דירוג",
    addBtn: "הוסף", cancel: "ביטול", delete: "מחק",
    cats: { entertainment:"בידור", music:"מוזיקה", software:"תוכנה", storage:"אחסון", news:"חדשות", fitness:"כושר", other:"אחר" },
    ratings: { waste:"🔴 בזבוז", medium:"🟡 בינוני", worth:"🟢 משתלם" },
    insightsTitle: "תובנות חכמות", cancelCandidate: "כדאי לבטל",
    mostExpensive: "הכי יקר", dailyTip: "טיפ יומי",
    savingsTitle: "מחשבון חיסכון", cancelAllWaste: "בטל את כל ה-🔴",
    youSave: "תחסוך", perYear: "בשנה",
    filterAll: "הכל", filterWaste: "🔴 בזבוז", filterMed: "🟡 בינוני", filterWorth: "🟢 משתלם",
    subsTitle: "המנויים שלי", perMonth: "/חודש",
    langBtn: "English 🇺🇸",
    confirmDel: "למחוק את המנוי הזה?",
  },
} as const;

const CATS: Category[] = ["entertainment","music","software","storage","news","fitness","other"];
const RATINGS: Rating[] = ["waste","medium","worth"];

const CSS = `
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.dash{min-height:100vh;background:var(--bg)}
.topbar{background:var(--s1);border-bottom:1px solid var(--br);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}
.logo{font-size:20px;font-weight:800}
.logo-em{color:var(--teal)}
.topbar-right{display:flex;align-items:center;gap:12px}
.lang-btn{background:var(--s2);border:1px solid var(--br);color:var(--t2);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;transition:all .2s}
.lang-btn:hover{border-color:var(--br2);color:var(--t1)}
.main{max-width:900px;margin:0 auto;padding:28px 20px}
.section{margin-bottom:28px;animation:up .35s ease}
.section-title{font-size:16px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:11px;margin-bottom:24px}
.mc{background:var(--card);border:1px solid var(--br);border-radius:var(--r);padding:16px 15px;position:relative;overflow:hidden}
.mc-ico{font-size:18px;margin-bottom:8px}
.mc-val{font-size:22px;font-weight:800;line-height:1;margin-bottom:3px}
.mc-val.blue{color:var(--blue)}.mc-val.red{color:var(--red)}.mc-val.teal{color:var(--teal)}.mc-val.gold{color:var(--gold)}
.mc-lbl{font-size:11px;color:var(--t2)}
.add-card{background:var(--card);border:1px solid var(--br);border-radius:var(--r);padding:20px}
.add-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.add-form.mobile{grid-template-columns:1fr}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.5px}
.field input,.field select{background:var(--s2);border:1.5px solid var(--br);border-radius:10px;padding:11px 13px;color:var(--t1);font-size:14px;outline:none;transition:all .2s;font-family:inherit}
.field input:focus,.field select:focus{border-color:rgba(79,127,255,.5);box-shadow:0 0 0 3px rgba(79,127,255,.1)}
.field select option{background:var(--s2)}
.btn-add{background:linear-gradient(135deg,var(--blue),#3a60cc);color:#fff;border:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;width:100%;margin-top:4px}
.btn-add:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,127,255,.3)}
.btn-add:disabled{opacity:.5;cursor:not-allowed}
.filter-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:13px}
.fb{background:var(--s2);border:1px solid var(--br);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--t2);cursor:pointer;transition:all .15s;white-space:nowrap}
.fb.on,.fb:hover{background:rgba(79,127,255,.1);border-color:rgba(79,127,255,.3);color:var(--blue)}
.sub-list{display:flex;flex-direction:column;gap:8px}
.sub-row{background:var(--card);border:1px solid var(--br);border-radius:13px;padding:13px 16px;display:flex;align-items:center;gap:12px;animation:up .3s ease both;transition:all .2s}
.sub-row:hover{border-color:var(--br2)}
.sub-badge{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sub-info{flex:1;min-width:0}
.sub-name{font-weight:600;font-size:14px;display:flex;align-items:center;gap:7px;margin-bottom:2px;flex-wrap:wrap}
.rating-dot{font-size:13px}
.sub-meta{font-size:11px;color:var(--t2)}
.sub-price{font-size:15px;font-weight:700;flex-shrink:0;color:var(--t1)}
.btn-del{background:rgba(255,85,119,.1);border:1px solid rgba(255,85,119,.15);color:var(--red);border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer;transition:all .2s;flex-shrink:0}
.btn-del:hover{background:rgba(255,85,119,.2)}
.no-subs{text-align:center;padding:36px 20px;color:var(--t2);background:var(--card);border:1px solid var(--br);border-radius:var(--r);font-size:14px}
.insight-list{display:flex;flex-direction:column;gap:9px}
.ins-card{background:var(--card);border:1px solid var(--br);border-radius:var(--r);padding:15px 17px;display:flex;align-items:flex-start;gap:12px;animation:up .35s ease both}
.ins-ico{font-size:22px;flex-shrink:0}
.ins-b{flex:1}
.ins-t{font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.ins-msg{font-size:14px;line-height:1.55}
.ins-save{font-size:13px;color:var(--teal);font-weight:600;margin-top:3px}
.savings-card{background:var(--card);border:1px solid var(--br);border-radius:var(--r);padding:20px}
.savings-big{font-size:36px;font-weight:800;color:var(--teal);margin:8px 0 4px}
.savings-sub{font-size:13px;color:var(--t2)}
.savings-mo{font-size:15px;color:var(--t2);margin-top:3px}
.empty-insights{text-align:center;padding:24px;color:var(--t2);background:var(--card);border:1px solid var(--br);border-radius:var(--r);font-size:14px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid rgba(0,212,168,.3);border-radius:12px;padding:11px 18px;font-size:13px;font-weight:500;color:var(--teal);z-index:500;animation:up .3s ease;white-space:nowrap}
@media(max-width:600px){.metrics{grid-template-columns:1fr 1fr}.add-form{grid-template-columns:1fr}.topbar{padding:12px 16px}.main{padding:20px 14px}}
`;

const CAT_ICONS: Record<Category, string> = {
  entertainment:"🎬",music:"🎵",software:"💻",storage:"☁️",news:"📰",fitness:"💪",other:"📦"
};

export default function Dashboard() {
  const { user } = useUser();
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const dir = lang === "he" ? "rtl" : "ltr";
  const font = lang === "he" ? "'Noto Sans Hebrew', sans-serif" : "'Outfit', sans-serif";

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<"all"|Rating>("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [fName, setFName] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fCat, setFCat] = useState<Category>("entertainment");
  const [fRating, setFRating] = useState<Rating>("medium");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load subs
  useEffect(() => {
    fetch("/api/subs")
      .then(r => r.json())
      .then((data: Subscription[]) => { setSubs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!fName.trim() || !fPrice) return;
    setAdding(true);
    try {
      const res = await fetch("/api/subs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fName.trim(), price: Number(fPrice), category: fCat, rating: fRating }),
      });
      const updated = await res.json() as Subscription[];
      setSubs(updated);
      setFName(""); setFPrice(""); setFCat("entertainment"); setFRating("medium");
      showToast(lang === "he" ? "✓ מנוי נוסף!" : "✓ Subscription added!");
    } catch {
      showToast(lang === "he" ? "שגיאה בהוספה" : "Error adding subscription");
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t.confirmDel} (${name})`)) return;
    const res = await fetch("/api/subs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const updated = await res.json() as Subscription[];
    setSubs(updated);
    showToast(lang === "he" ? `✓ ${name} נמחק` : `✓ ${name} deleted`);
  };

  const totals = getTotals(subs);
  const insights = getInsights(subs, lang);
  const wastedSubs = subs.filter(s => s.rating === "waste");
  const filteredSubs = filter === "all" ? subs : subs.filter(s => s.rating === filter);

  return (
    <>
      <style>{CSS}</style>
      <div className="dash" dir={dir} style={{ fontFamily: font }}>
        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo">Sub<span className="logo-em">Zero</span></div>
          <div className="topbar-right">
            <button className="lang-btn" onClick={() => setLang(l => l === "en" ? "he" : "en")}>
              {t.langBtn}
            </button>
            <UserButton  />
          </div>
        </div>

        <div className="main">
          {/* GREETING */}
          <div style={{ marginBottom: 24, animation: "up .4s ease" }}>
            <div style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, marginBottom: 4 }}>
              {t.greeting}, {user?.firstName ?? "there"} 👋
            </div>
            <div style={{ color: "var(--t2)", fontSize: 13 }}>{t.dashSub}</div>
          </div>

          {/* METRICS */}
          <div className="metrics">
            {[
              { ico: "💳", val: `₪${totals.monthly}`, lbl: t.totalMo, cls: "blue" },
              { ico: "📅", val: `₪${totals.yearly}`, lbl: t.totalYr, cls: "teal" },
              { ico: "🔥", val: `₪${totals.wastedMonthly}`, lbl: t.wasted, cls: "red" },
              { ico: "📉", val: `₪${totals.wastedYearly}`, lbl: t.wastedYr, cls: "gold" },
            ].map((m, i) => (
              <div key={i} className="mc" style={{ animationDelay: `${i * .07}s` }}>
                <div className="mc-ico">{m.ico}</div>
                <div className={`mc-val ${m.cls}`}>{m.val}</div>
                <div className="mc-lbl">{m.lbl}</div>
              </div>
            ))}
          </div>

          {/* ADD SUBSCRIPTION */}
          <div className="section">
            <div className="section-title">➕ {t.addTitle}</div>
            <div className="add-card">
              <div className="add-form">
                <div className="field">
                  <label>{t.nameLbl}</label>
                  <input placeholder={t.namePh} value={fName} onChange={e => setFName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdd()} />
                </div>
                <div className="field">
                  <label>{t.priceLbl}</label>
                  <input type="number" min="1" placeholder="49" value={fPrice}
                    onChange={e => setFPrice(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
                </div>
                <div className="field">
                  <label>{t.catLbl}</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value as Category)}>
                    {CATS.map(c => <option key={c} value={c}>{t.cats[c]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t.ratingLbl}</label>
                  <select value={fRating} onChange={e => setFRating(e.target.value as Rating)}>
                    {RATINGS.map(r => <option key={r} value={r}>{t.ratings[r]}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn-add" onClick={handleAdd} disabled={adding || !fName.trim() || !fPrice}>
                {adding ? "..." : `➕ ${t.addBtn}`}
              </button>
            </div>
          </div>

          {/* MY SUBSCRIPTIONS */}
          <div className="section">
            <div className="section-title">📋 {t.subsTitle}</div>
            <div className="filter-row">
              {[
                ["all", t.filterAll],
                ["waste", t.filterWaste],
                ["medium", t.filterMed],
                ["worth", t.filterWorth],
              ].map(([k, l]) => (
                <div key={k} className={`fb${filter === k ? " on" : ""}`} onClick={() => setFilter(k as "all" | Rating)}>{l}</div>
              ))}
            </div>
            {loading ? (
              <div className="no-subs">Loading...</div>
            ) : filteredSubs.length === 0 ? (
              <div className="no-subs">{subs.length === 0 ? t.noSubs : "No subscriptions in this filter."}</div>
            ) : (
              <div className="sub-list">
                {filteredSubs.map((s, i) => (
                  <div key={s.id} className="sub-row" style={{ animationDelay: `${i * .04}s` }}>
                    <div className="sub-badge" style={{ background: `rgba(79,127,255,.1)` }}>
                      {CAT_ICONS[s.category]}
                    </div>
                    <div className="sub-info">
                      <div className="sub-name">
                        <span>{s.name}</span>
                        <span className="rating-dot" title={t.ratings[s.rating]}>
                          {s.rating === "waste" ? "🔴" : s.rating === "medium" ? "🟡" : "🟢"}
                        </span>
                      </div>
                      <div className="sub-meta">{t.cats[s.category]} · {t.ratings[s.rating]}</div>
                    </div>
                    <div className="sub-price">₪{s.price}<span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 400 }}>{t.perMonth}</span></div>
                    <button className="btn-del" onClick={() => handleDelete(s.id, s.name)}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INSIGHTS */}
          <div className="section">
            <div className="section-title">🧠 {t.insightsTitle}</div>
            {insights.length === 0 ? (
              <div className="empty-insights">
                {lang === "he" ? "הוסף מנויים כדי לקבל תובנות חכמות." : "Add subscriptions to get smart insights."}
              </div>
            ) : (
              <div className="insight-list">
                {insights.map((ins, i) => (
                  <div key={i} className="ins-card" style={{ animationDelay: `${i * .07}s` }}>
                    <div className="ins-ico">
                      {ins.type === "most_expensive" ? "💸" : ins.type === "cancel_candidate" ? "⚠️" : "💡"}
                    </div>
                    <div className="ins-b">
                      <div className="ins-t">
                        {ins.type === "most_expensive" ? t.mostExpensive : ins.type === "cancel_candidate" ? t.cancelCandidate : t.dailyTip}
                      </div>
                      <div className="ins-msg">{ins.message}</div>
                      {ins.savings && (
                        <div className="ins-save">
                          {lang === "he" ? `חיסכון שנתי: ₪${ins.savings}` : `Annual savings: ₪${ins.savings}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAVINGS CALCULATOR */}
          {wastedSubs.length > 0 && (
            <div className="section">
              <div className="section-title">💰 {t.savingsTitle}</div>
              <div className="savings-card">
                <div style={{ fontSize: 13, color: "var(--t2)" }}>{t.cancelAllWaste} →</div>
                <div className="savings-big">₪{wastedSubs.reduce((a, b) => a + b.price * 12, 0)}</div>
                <div className="savings-sub">{t.youSave} {t.perYear}</div>
                <div className="savings-mo" style={{ marginTop: 8 }}>
                  {lang === "he"
                    ? `חיסכון חודשי: ₪${wastedSubs.reduce((a, b) => a + b.price, 0)}`
                    : `Monthly savings: ₪${wastedSubs.reduce((a, b) => a + b.price, 0)}`}
                </div>
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {wastedSubs.map(s => (
                    <div key={s.id} style={{
                      background: "rgba(255,85,119,.1)", border: "1px solid rgba(255,85,119,.2)",
                      borderRadius: 8, padding: "5px 11px", fontSize: 12, color: "var(--red)",
                    }}>
                      {s.name} — ₪{s.price}/mo
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}