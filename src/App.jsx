import { useState, useRef, useEffect } from "react";

// ── Points to our secure Vercel backend function ──────────────────────────────
const API_URL = "/api/generate-quote";

// ── localStorage helpers ──────────────────────────────────────────────────────
const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Generate quote via Claude ─────────────────────────────────────────────────
async function generateQuote(businessName, tradeType, jobDescription, clientName, materials) {
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const quoteNum = "Q" + Date.now().toString().slice(-6);

  const materialsContext = materials.length > 0
    ? `\n\nThe business has these materials in their price library — USE THESE EXACT PRICES where relevant:\n${materials.map(m => `- ${m.name}: $${m.price} per ${m.unit}`).join("\n")}`
    : "";

  const prompt = `You are a professional quoting assistant for an Australian ${tradeType} business called "${businessName}".

Generate a detailed, professional quote for the following job:
"${jobDescription}"

Client: ${clientName || "Valued Client"}
Quote: ${quoteNum}
Date: ${today}${materialsContext}

Return ONLY valid JSON, no markdown, no extra text:
{
  "quoteNumber": "${quoteNum}",
  "date": "${today}",
  "clientName": "${clientName || "Valued Client"}",
  "jobTitle": "brief job title (5 words max)",
  "jobSummary": "2-3 sentence professional summary",
  "lineItems": [
    { "description": "item description", "qty": 1, "unit": "ea/hr/m/m2/lot", "unitPrice": 0, "total": 0 }
  ],
  "subtotal": 0,
  "gst": 0,
  "total": 0,
  "notes": "payment terms, warranty info (2-3 sentences)",
  "validDays": 30
}

Rules:
- 4-8 realistic line items broken down by labour and materials
- Where a library material matches the job, use its exact price
- Use realistic 2025 Australian market pricing for ${tradeType} work
- GST = exactly 10% of subtotal. Total = subtotal + GST
- All prices AUD. Be specific, not generic`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const text = data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function recalcTotals(items) {
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst,
    total: Math.round((subtotal + gst) * 100) / 100,
  };
}

const TRADES = [
  "Electrician", "Plumber", "Builder / Carpenter", "Painter",
  "Landscaper", "Concreter", "Tiler", "Roofer", "Air Conditioning",
  "Plasterer", "Fencer", "Cabinet Maker", "Other Tradie",
];

const TABS = [
  { id: "quote",     label: "New Quote",        icon: "⚡" },
  { id: "history",  label: "Quote History",     icon: "📁" },
  { id: "materials",label: "Materials Library", icon: "📦" },
  { id: "settings", label: "Business Setup",    icon: "⚙️" },
];

export default function App() {
  const [tab, setTab] = useState("settings");

  // Business profile
  const [businessName, setBusinessName] = useState("");
  const [tradeType,    setTradeType]    = useState("");
  const [phone,        setPhone]        = useState("");
  const [email,        setEmail]        = useState("");
  const [abn,          setAbn]          = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Quote form
  const [clientName,    setClientName]    = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [jobDescription,setJobDescription]= useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  // Quote result + editing
  const [quote,        setQuote]        = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [editingNotes, setEditingNotes] = useState("");
  const [isEditing,    setIsEditing]    = useState(false);

  // History & materials
  const [history,   setHistory]   = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newMat,    setNewMat]    = useState({ name: "", price: "", unit: "ea" });
  const [matError,  setMatError]  = useState("");

  // Load saved data on mount
  useEffect(() => {
    const profile = store.get("qk_profile");
    if (profile) {
      setBusinessName(profile.businessName || "");
      setTradeType(profile.tradeType || "");
      setPhone(profile.phone || "");
      setEmail(profile.email || "");
      setAbn(profile.abn || "");
      setProfileSaved(true);
      setTab("quote");
    }
    setHistory(store.get("qk_history") || []);
    setMaterials(store.get("qk_materials") || []);
  }, []);

  function saveProfile() {
    const p = { businessName, tradeType, phone, email, abn };
    store.set("qk_profile", p);
    setProfileSaved(true);
    setTab("quote");
  }

  function addMaterial() {
    if (!newMat.name.trim() || !newMat.price) { setMatError("Name and price required"); return; }
    const updated = [...materials, { id: Date.now(), ...newMat, price: parseFloat(newMat.price) }];
    setMaterials(updated);
    store.set("qk_materials", updated);
    setNewMat({ name: "", price: "", unit: "ea" });
    setMatError("");
  }

  function removeMaterial(id) {
    const updated = materials.filter(m => m.id !== id);
    setMaterials(updated);
    store.set("qk_materials", updated);
  }

  async function handleGenerate() {
    if (!jobDescription.trim()) return;
    setLoading(true);
    setError("");
    setQuote(null);
    try {
      const q = await generateQuote(businessName, tradeType, jobDescription, clientName, materials);
      q.clientAddress = clientAddress;
      setQuote(q);
      setEditingItems(q.lineItems.map(i => ({ ...i })));
      setEditingNotes(q.notes);
      setIsEditing(false);
      const h = [{ ...q, jobDescription, savedAt: new Date().toISOString() }, ...(store.get("qk_history") || [])].slice(0, 20);
      store.set("qk_history", h);
      setHistory(h);
    } catch (e) {
      setError("Failed to generate quote: " + (e?.message || "Unknown error"));
    }
    setLoading(false);
  }

  function updateItem(index, field, value) {
    const updated = editingItems.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "qty" || field === "unitPrice") {
        next.total = Math.round((parseFloat(next.qty) || 0) * (parseFloat(next.unitPrice) || 0) * 100) / 100;
      }
      return next;
    });
    setEditingItems(updated);
  }

  function addItem() { setEditingItems([...editingItems, { description: "New item", qty: 1, unit: "ea", unitPrice: 0, total: 0 }]); }
  function removeItem(index) { setEditingItems(editingItems.filter((_, i) => i !== index)); }

  function applyEdits() {
    const totals = recalcTotals(editingItems);
    setQuote({ ...quote, lineItems: editingItems, notes: editingNotes, ...totals });
    setIsEditing(false);
  }

  function resetForm() {
    setQuote(null); setClientName(""); setClientAddress("");
    setJobDescription(""); setError(""); setIsEditing(false);
  }

  const displayItems  = isEditing ? editingItems : (quote?.lineItems || []);
  const displayTotals = isEditing ? recalcTotals(editingItems) : { subtotal: quote?.subtotal, gst: quote?.gst, total: quote?.total };
  const fmt = (n) => Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const profileComplete = businessName.trim() && tradeType;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f1ed", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Barlow+Condensed:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --orange: #e85d04; --orange-d: #c44f00;
          --dark: #1a1a1a; --mid: #555;
          --border: #ddd8d0; --green: #2d6a4f; --red: #c0392b;
        }
        body { margin: 0; background: #f4f1ed; }

        .hdr { background: var(--dark); height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 200; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-q { width: 34px; height: 34px; background: var(--orange); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed'; font-weight: 800; font-size: 18px; color: white; transform: skewX(-8deg); border-radius: 3px; }
        .logo-txt { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 20px; color: white; letter-spacing: 1px; text-transform: uppercase; }
        .logo-sub { font-size: 9px; color: #666; letter-spacing: 3px; text-transform: uppercase; display: block; }
        .ai-badge { background: #252525; border: 1px solid #333; border-radius: 4px; padding: 5px 12px; font-size: 10px; color: #666; letter-spacing: 1px; text-transform: uppercase; font-family: 'Barlow Condensed'; font-weight: 600; }
        .ai-badge span { color: var(--orange); }

        .nav { background: white; border-bottom: 1px solid var(--border); display: flex; padding: 0 24px; overflow-x: auto; }
        .nav-tab { padding: 14px 18px; font-family: 'Barlow Condensed'; font-weight: 600; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #aaa; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap; background: none; border-top: none; border-left: none; border-right: none; display: flex; align-items: center; gap: 6px; }
        .nav-tab:hover { color: var(--mid); }
        .nav-tab.active { color: var(--orange); border-bottom-color: var(--orange); }

        .main { max-width: 820px; margin: 0 auto; padding: 32px 24px 80px; }

        .card { background: white; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
        .card-hdr { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .card-icon { width: 36px; height: 36px; background: var(--orange); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
        .card-title { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 17px; text-transform: uppercase; letter-spacing: 1px; color: var(--dark); }
        .card-sub { font-size: 12px; color: #999; margin-top: 1px; }
        .card-body { padding: 24px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .form-grid.single { grid-template-columns: 1fr; }
        .form-grid.three { grid-template-columns: 1fr 1fr 1fr; }
        .fld { display: flex; flex-direction: column; gap: 5px; }
        .lbl { font-size: 10px; font-weight: 700; color: var(--mid); text-transform: uppercase; letter-spacing: 1px; }
        .inp { background: #faf9f7; border: 1.5px solid var(--border); border-radius: 6px; padding: 11px 13px; font-family: 'DM Sans'; font-size: 14px; color: var(--dark); outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%; }
        .inp:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,93,4,0.08); background: white; }
        .inp::placeholder { color: #c0bbb3; }
        .textarea { resize: vertical; min-height: 110px; line-height: 1.6; }

        .btn { border: none; border-radius: 6px; padding: 12px 22px; font-family: 'Barlow Condensed'; font-weight: 700; font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 7px; }
        .btn-full { width: 100%; justify-content: center; }
        .btn-primary { background: var(--orange); color: white; }
        .btn-primary:hover { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(232,93,4,0.28); }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-dark { background: var(--dark); color: white; }
        .btn-dark:hover { background: #2a2a2a; }
        .btn-ghost { background: white; color: var(--dark); border: 1.5px solid var(--border); }
        .btn-ghost:hover { border-color: var(--dark); }
        .btn-sm { padding: 7px 14px; font-size: 12px; }
        .btn-danger { background: #fff0ee; color: var(--red); border: 1px solid #fcc; }
        .btn-danger:hover { background: #ffe0dc; }
        .btn-success { background: var(--green); color: white; }
        .btn-success:hover { background: #235a40; }
        .btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .trade-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-bottom: 20px; }
        .trade-btn { background: #faf9f7; border: 1.5px solid var(--border); border-radius: 6px; padding: 9px 12px; font-size: 13px; font-weight: 500; color: var(--mid); cursor: pointer; transition: all 0.15s; text-align: left; font-family: 'DM Sans'; }
        .trade-btn:hover { border-color: var(--orange); color: var(--orange); }
        .trade-btn.selected { background: var(--orange); border-color: var(--orange); color: white; font-weight: 700; }

        .hint { background: #fffbf5; border: 1px solid #f4e0c0; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #8a6a3a; line-height: 1.6; margin-bottom: 16px; }
        .hint strong { color: var(--orange); }
        .err { background: #fff5f5; border: 1px solid #fcc; border-radius: 6px; padding: 12px 16px; color: var(--red); font-size: 13px; margin-bottom: 16px; }
        .success-bar { background: #f0faf5; border: 1px solid #a8d5b8; border-radius: 6px; padding: 12px 16px; color: var(--green); font-size: 13px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

        .loading { text-align: center; padding: 48px 24px; }
        .spinner { width: 42px; height: 42px; border: 3px solid #e8e2d8; border-top-color: var(--orange); border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 18px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-title { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 20px; letter-spacing: 2px; text-transform: uppercase; color: var(--dark); margin-bottom: 6px; }
        .loading-sub { font-size: 13px; color: #999; }

        .action-bar { background: white; border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .action-bar-txt strong { display: block; font-size: 14px; color: var(--dark); margin-bottom: 2px; }
        .action-bar-txt span { font-size: 12px; color: #999; }

        .quote-doc { background: white; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .quote-top { background: var(--dark); padding: 30px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .q-biz { font-family: 'Barlow Condensed'; font-weight: 800; font-size: 26px; color: white; letter-spacing: 1px; text-transform: uppercase; }
        .q-trade { display: inline-block; background: var(--orange); color: white; font-family: 'Barlow Condensed'; font-weight: 600; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; padding: 2px 9px; border-radius: 2px; margin-top: 5px; }
        .q-contact { font-size: 11px; color: #777; margin-top: 6px; line-height: 1.7; }
        .q-meta { text-align: right; flex-shrink: 0; }
        .q-word { font-family: 'Barlow Condensed'; font-weight: 800; font-size: 34px; color: var(--orange); letter-spacing: 3px; text-transform: uppercase; line-height: 1; }
        .q-num { font-size: 12px; color: #888; margin-top: 3px; }
        .q-date { font-size: 11px; color: #666; }

        .q-body { padding: 28px 36px; }
        .q-client-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding-bottom: 22px; border-bottom: 1px solid var(--border); margin-bottom: 22px; }
        .q-sec-lbl { font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 3px; }
        .q-client-name { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 19px; color: var(--dark); }
        .q-address { font-size: 12px; color: #999; margin-top: 2px; }
        .q-job-title { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 19px; color: var(--dark); }
        .q-summary { font-size: 12px; color: var(--mid); line-height: 1.6; margin-top: 3px; }

        .items-tbl { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-tbl th { background: #f8f5f1; padding: 9px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid var(--border); }
        .items-tbl th:not(:first-child) { text-align: center; }
        .items-tbl th:last-child { text-align: right; }
        .items-tbl td { padding: 11px 10px; font-size: 13px; border-bottom: 1px solid #f0ebe3; vertical-align: middle; }
        .items-tbl tr:last-child td { border-bottom: none; }
        .items-tbl td:not(:first-child) { text-align: center; }
        .items-tbl td:last-child { text-align: right; font-weight: 600; }
        .item-desc { font-weight: 500; color: var(--dark); }
        .item-meta { color: #aaa; font-size: 12px; }

        .edit-inp { background: #faf9f7; border: 1px solid var(--border); border-radius: 4px; padding: 5px 8px; font-size: 12px; font-family: 'DM Sans'; color: var(--dark); outline: none; width: 100%; }
        .edit-inp:focus { border-color: var(--orange); background: white; }
        .edit-inp.num { width: 70px; text-align: center; }
        .remove-row { background: none; border: none; color: #ddd; cursor: pointer; font-size: 16px; padding: 0 4px; transition: color 0.1s; }
        .remove-row:hover { color: var(--red); }

        .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-box { width: 240px; }
        .tot-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: var(--mid); border-bottom: 1px solid #f0ebe3; }
        .tot-row:last-child { border-bottom: none; }
        .tot-row.big { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 20px; color: var(--dark); padding-top: 10px; }
        .tot-row.big span:last-child { color: var(--orange); }

        .q-notes { background: #faf9f7; border: 1px solid var(--border); border-radius: 6px; padding: 14px; font-size: 12px; color: #888; line-height: 1.7; }
        .q-notes strong { color: var(--mid); }
        .q-validity { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 10px; color: #bbb; letter-spacing: 1px; text-transform: uppercase; }

        .mat-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .mat-table th { background: #f8f5f1; padding: 8px 12px; text-align: left; font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid var(--border); }
        .mat-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0ebe3; color: var(--dark); }
        .mat-table tr:last-child td { border-bottom: none; }
        .mat-badge { display: inline-block; background: #f0faf5; color: var(--green); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; border: 1px solid #a8d5b8; }

        .hist-item { padding: 14px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .hist-item:hover { background: #faf9f7; }
        .hist-item:last-child { border-bottom: none; }
        .hist-num { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 13px; color: var(--orange); }
        .hist-client { font-weight: 600; font-size: 14px; color: var(--dark); }
        .hist-job { font-size: 12px; color: #999; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
        .hist-total { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 18px; color: var(--dark); }
        .hist-date { font-size: 10px; color: #bbb; }

        .empty-state { text-align: center; padding: 48px 24px; color: #bbb; }
        .empty-icon { font-size: 40px; margin-bottom: 12px; }
        .empty-txt { font-family: 'Barlow Condensed'; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; }

        .profile-bar { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
        .profile-icon { width: 32px; height: 32px; background: var(--orange); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .profile-name { font-family: 'Barlow Condensed'; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; }
        .profile-trade { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; }

        @media (max-width: 600px) {
          .main { padding: 20px 14px 60px; }
          .form-grid { grid-template-columns: 1fr; }
          .form-grid.three { grid-template-columns: 1fr 1fr; }
          .quote-top { flex-direction: column; }
          .q-meta { text-align: left; }
          .q-client-row { grid-template-columns: 1fr; }
          .q-body { padding: 20px; }
          .quote-top { padding: 22px 20px; }
          .action-bar { flex-direction: column; }
          .nav { padding: 0 12px; }
          .nav-tab { padding: 12px 12px; font-size: 12px; }
        }

        @media print {
          .hdr, .nav, .action-bar, .hint, .profile-bar, .btn-row { display: none !important; }
          .main { padding: 0; max-width: 100%; }
          .quote-doc { border: none; border-radius: 0; box-shadow: none; }
          body { background: white; }
        }

        .fade-up { animation: fadeUp 0.3s ease forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Header ── */}
      <div className="hdr">
        <div className="logo">
          <div className="logo-q">Q</div>
          <div>
            <div className="logo-txt">QuoteKit</div>
            <span className="logo-sub">AI Quote Generator for Tradies</span>
          </div>
        </div>
        <div className="ai-badge">Powered by <span>Claude AI</span></div>
      </div>

      {/* ── Nav ── */}
      <div className="nav">
        {TABS.map(t => (
          <button key={t.id} className={`nav-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="main">

        {/* ══ SETTINGS ══════════════════════════════════════════ */}
        {tab === "settings" && (
          <div className="fade-up">
            <div className="card">
              <div className="card-hdr">
                <div className="card-icon">🏗️</div>
                <div>
                  <div className="card-title">Business Details</div>
                  <div className="card-sub">Your info appears on every quote you generate</div>
                </div>
              </div>
              <div className="card-body">
                {profileSaved && <div className="success-bar">✅ Profile saved — your details appear on all quotes</div>}
                <div className="form-grid single">
                  <div className="fld">
                    <label className="lbl">Business Name *</label>
                    <input className="inp" placeholder="e.g. Smith Electrical Services" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="fld">
                    <label className="lbl">Phone</label>
                    <input className="inp" placeholder="0400 000 000" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label className="lbl">Email</label>
                    <input className="inp" placeholder="info@yourbusiness.com.au" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid single" style={{ marginBottom: 20 }}>
                  <div className="fld">
                    <label className="lbl">ABN (Optional)</label>
                    <input className="inp" placeholder="12 345 678 901" value={abn} onChange={e => setAbn(e.target.value)} />
                  </div>
                </div>
                <div className="fld" style={{ marginBottom: 20 }}>
                  <label className="lbl" style={{ marginBottom: 8 }}>Your Trade *</label>
                  <div className="trade-grid">
                    {TRADES.map(t => (
                      <button key={t} className={`trade-btn ${tradeType === t ? "selected" : ""}`} onClick={() => setTradeType(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-full" disabled={!profileComplete} onClick={saveProfile}>
                  Save & Start Quoting →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MATERIALS ════════════════════════════════════════ */}
        {tab === "materials" && (
          <div className="fade-up">
            <div className="card">
              <div className="card-hdr">
                <div className="card-icon">📦</div>
                <div>
                  <div className="card-title">Materials & Products Library</div>
                  <div className="card-sub">AI uses your exact prices when generating quotes</div>
                </div>
              </div>
              <div className="card-body">
                <div className="hint">
                  <strong>How it works:</strong> Add your go-to supplies with your actual trade prices. When you generate a quote, the AI automatically uses these where relevant — giving you accurate, consistent pricing every time.
                </div>
                {matError && <div className="err">{matError}</div>}
                <div className="form-grid three" style={{ marginBottom: 12 }}>
                  <div className="fld" style={{ gridColumn: "1 / 2" }}>
                    <label className="lbl">Product / Material</label>
                    <input className="inp" placeholder="e.g. 20MPa Concrete" value={newMat.name} onChange={e => setNewMat({ ...newMat, name: e.target.value })} onKeyDown={e => e.key === "Enter" && addMaterial()} />
                  </div>
                  <div className="fld">
                    <label className="lbl">Your Price ($)</label>
                    <input className="inp" type="number" placeholder="185" value={newMat.price} onChange={e => setNewMat({ ...newMat, price: e.target.value })} />
                  </div>
                  <div className="fld">
                    <label className="lbl">Unit</label>
                    <select className="inp" value={newMat.unit} onChange={e => setNewMat({ ...newMat, unit: e.target.value })} style={{ appearance: "none" }}>
                      {["ea","m3","m2","m","L","kg","bag","sheet","roll","lot","hr"].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={addMaterial} style={{ marginBottom: 24 }}>+ Add to Library</button>

                {materials.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <div className="empty-txt">No materials added yet</div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>Add your common supplies above</div>
                  </div>
                ) : (
                  <table className="mat-table">
                    <thead><tr><th>Product</th><th>Your Price</th><th>Unit</th><th></th></tr></thead>
                    <tbody>
                      {materials.map(m => (
                        <tr key={m.id}>
                          <td><strong>{m.name}</strong></td>
                          <td><span className="mat-badge">${m.price}</span></td>
                          <td style={{ color: "#999", fontSize: 12 }}>per {m.unit}</td>
                          <td><button className="btn btn-danger btn-sm" onClick={() => removeMaterial(m.id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ HISTORY ══════════════════════════════════════════ */}
        {tab === "history" && (
          <div className="fade-up">
            <div className="card">
              <div className="card-hdr">
                <div className="card-icon">📁</div>
                <div>
                  <div className="card-title">Quote History</div>
                  <div className="card-sub">Your last 20 quotes — click any to reload</div>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-txt">No quotes yet</div>
                  <div style={{ fontSize: 13, marginTop: 8 }}>Generate your first quote to see it here</div>
                </div>
              ) : (
                <div>
                  {history.map((q, i) => (
                    <div key={i} className="hist-item" onClick={() => {
                      setQuote(q);
                      setEditingItems(q.lineItems?.map(item => ({ ...item })) || []);
                      setEditingNotes(q.notes || "");
                      setIsEditing(false);
                      setTab("quote");
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="hist-num">{q.quoteNumber}</div>
                        <div className="hist-client">{q.clientName}</div>
                        <div className="hist-job">{q.jobDescription}</div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div className="hist-total">${fmt(q.total)}</div>
                        <div className="hist-date">{q.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ QUOTE ════════════════════════════════════════════ */}
        {tab === "quote" && (
          <div className="fade-up">

            {/* Not set up */}
            {!profileSaved && (
              <div className="card">
                <div className="card-body" style={{ textAlign: "center", padding: "40px 24px" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🏗️</div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Set Up Your Business First</div>
                  <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>Add your business details before generating quotes</div>
                  <button className="btn btn-primary" onClick={() => setTab("settings")}>Go to Business Setup →</button>
                </div>
              </div>
            )}

            {/* Quote form */}
            {profileSaved && !quote && (
              <>
                <div className="profile-bar">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="profile-icon">🔧</div>
                    <div>
                      <div className="profile-name">{businessName}</div>
                      <div className="profile-trade">{tradeType}</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab("settings")}>Edit</button>
                </div>

                <div className="card">
                  <div className="card-hdr">
                    <div className="card-icon">📋</div>
                    <div>
                      <div className="card-title">Describe the Job</div>
                      <div className="card-sub">Plain English — AI generates a professional quote instantly</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="hint">
                      <strong>Tip:</strong> More detail = more accurate quote. Include size, materials preferred, access difficulty, number of fixtures, anything unusual about the job.
                    </div>
                    {error && <div className="err">⚠ {error}</div>}
                    <div className="form-grid" style={{ marginBottom: 14 }}>
                      <div className="fld">
                        <label className="lbl">Client Name</label>
                        <input className="inp" placeholder="e.g. John & Sarah Thompson" value={clientName} onChange={e => setClientName(e.target.value)} />
                      </div>
                      <div className="fld">
                        <label className="lbl">Site Address (Optional)</label>
                        <input className="inp" placeholder="e.g. 14 Smith St, Paddington" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
                      </div>
                    </div>
                    <div className="fld" style={{ marginBottom: 24 }}>
                      <label className="lbl">Job Description *</label>
                      <textarea
                        className="inp textarea"
                        placeholder={`Describe the job in plain English...\n\nExample: "Supply and install a 20m treated pine fence along the back boundary at Fig Tree Pocket. 1.8m high, includes 2x single swing gates. Remove and dispose of existing damaged paling fence first."`}
                        value={jobDescription}
                        onChange={e => setJobDescription(e.target.value)}
                      />
                    </div>
                    {loading ? (
                      <div className="loading">
                        <div className="spinner" />
                        <div className="loading-title">Building Your Quote...</div>
                        <div className="loading-sub">Calculating labour, materials & GST{materials.length > 0 ? " · Using your price library" : ""}</div>
                      </div>
                    ) : (
                      <button className="btn btn-primary btn-full" disabled={!jobDescription.trim()} onClick={handleGenerate}>
                        ⚡ Generate Professional Quote
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Quote result */}
            {quote && !loading && (
              <div className="fade-up">
                <div className="action-bar">
                  <div className="action-bar-txt">
                    <strong>✅ Quote {quote.quoteNumber} Ready</strong>
                    <span>Print or save as PDF to send to your client</span>
                  </div>
                  <div className="btn-row">
                    {isEditing ? (
                      <>
                        <button className="btn btn-success btn-sm" onClick={applyEdits}>✓ Apply Changes</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingItems(quote.lineItems.map(i => ({ ...i }))); setIsEditing(false); }}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>✏️ Edit Quote</button>
                    )}
                    <button className="btn btn-dark btn-sm" onClick={() => window.print()}>🖨 Print / PDF</button>
                    <button className="btn btn-primary btn-sm" onClick={resetForm}>+ New Quote</button>
                  </div>
                </div>

                {isEditing && (
                  <div className="hint">
                    <strong>Edit mode:</strong> Click any field to change it. Qty × Unit Price auto-calculates the total. Add or remove rows as needed.
                  </div>
                )}

                <div className="quote-doc">
                  <div className="quote-top">
                    <div>
                      <div className="q-biz">{businessName}</div>
                      <div className="q-trade">{tradeType}</div>
                      <div className="q-contact">
                        {phone && <span>{phone}</span>}
                        {phone && email && " · "}
                        {email && <span>{email}</span>}
                        {abn && <><br />ABN: {abn}</>}
                      </div>
                    </div>
                    <div className="q-meta">
                      <div className="q-word">Quote</div>
                      <div className="q-num">{quote.quoteNumber}</div>
                      <div className="q-date">{quote.date}</div>
                    </div>
                  </div>

                  <div className="q-body">
                    <div className="q-client-row">
                      <div>
                        <div className="q-sec-lbl">Prepared For</div>
                        <div className="q-client-name">{quote.clientName}</div>
                        {quote.clientAddress && <div className="q-address">{quote.clientAddress}</div>}
                      </div>
                      <div>
                        <div className="q-sec-lbl">Scope of Work</div>
                        <div className="q-job-title">{quote.jobTitle}</div>
                        <div className="q-summary">{quote.jobSummary}</div>
                      </div>
                    </div>

                    <table className="items-tbl">
                      <thead>
                        <tr>
                          <th style={{ width: "44%" }}>Description</th>
                          <th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th>
                          {isEditing && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.map((item, i) => (
                          <tr key={i}>
                            <td>{isEditing ? <input className="edit-inp" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} /> : <div className="item-desc">{item.description}</div>}</td>
                            <td>{isEditing ? <input className="edit-inp num" type="number" value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} /> : <span className="item-meta">{item.qty}</span>}</td>
                            <td>{isEditing ? <input className="edit-inp num" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} /> : <span className="item-meta">{item.unit}</span>}</td>
                            <td>{isEditing ? <input className="edit-inp num" type="number" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} /> : <span className="item-meta">${fmt(item.unitPrice)}</span>}</td>
                            <td>${fmt(isEditing ? (parseFloat(item.qty || 0) * parseFloat(item.unitPrice || 0)) : item.total)}</td>
                            {isEditing && <td><button className="remove-row" onClick={() => removeItem(i)}>✕</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {isEditing && (
                      <button className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 16 }}>+ Add Line Item</button>
                    )}

                    <div className="totals-wrap">
                      <div className="totals-box">
                        <div className="tot-row"><span>Subtotal</span><span>${fmt(displayTotals.subtotal)}</span></div>
                        <div className="tot-row"><span>GST (10%)</span><span>${fmt(displayTotals.gst)}</span></div>
                        <div className="tot-row big"><span>Total (AUD)</span><span>${fmt(displayTotals.total)}</span></div>
                      </div>
                    </div>

                    <div className="q-notes">
                      {isEditing
                        ? <textarea className="inp textarea" style={{ minHeight: 70 }} value={editingNotes} onChange={e => setEditingNotes(e.target.value)} />
                        : <><strong>Terms & Notes: </strong>{quote.notes}</>}
                    </div>

                    <div className="q-validity">This quote is valid for {quote.validDays} days from the date of issue</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button className="btn btn-ghost btn-sm" onClick={resetForm}>← Generate Another Quote</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
