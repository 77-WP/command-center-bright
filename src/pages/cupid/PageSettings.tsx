import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BannerRow {
  id: string;
  title: string;
  emoji: string | null;
  bg_color: string;
  is_active: boolean;
  sort_order: number;
  subtitle: string | null;
  link_url: string | null;
}

interface CupidSettings {
  id: number;
  qa_is_active: boolean;
  announcement_is_active: boolean;
  announcement_text: string | null;
  announcement_title: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_noti_enabled: boolean;
  telegram_noti_on_problem: boolean;
  telegram_noti_on_neutral: boolean;
}

interface WeeklyQuestion {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
  sort_order: number;
}

type PageKey =
  | "landing"
  | "happy"
  | "neutral"
  | "problem"
  | "thanks"
  | "meunfun"
  | "founder";

const PAGES: { key: PageKey; label: string }[] = [
  { key: "landing", label: "🏠 Landing Page" },
  { key: "happy", label: "😄 Happy Path" },
  { key: "neutral", label: "😐 Neutral Path" },
  { key: "problem", label: "😟 Problem Path" },
  { key: "thanks", label: "🙏 Thanks Page" },
  { key: "meunfun", label: "✨ เหมือนฝัน" },
  { key: "founder", label: "📝 Founder Card" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Telegram Settings ───────────────────────────────────────────────────────

function TelegramSettings() {
  const [settings, setSettings] = useState<CupidSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("cupid_settings")
      .select(
        "id, qa_is_active, announcement_is_active, announcement_text, announcement_title, telegram_bot_token, telegram_chat_id, telegram_noti_enabled, telegram_noti_on_problem, telegram_noti_on_neutral"
      )
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        setSettings(data as CupidSettings);
        setLoading(false);
      });
  }, []);

  async function updateField(field: keyof CupidSettings, value: boolean) {
    if (!settings) return;
    setSettings((prev) => prev ? { ...prev, [field]: value } : prev);
    await supabase.from("cupid_settings").update({ [field]: value }).eq("id", 1);
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return null;

  const hasToken = !!settings.telegram_bot_token;
  const maskedChatId = settings.telegram_chat_id
    ? settings.telegram_chat_id.slice(0, -4).replace(/./g, "*") +
      settings.telegram_chat_id.slice(-4)
    : "—";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-sm font-semibold">การแจ้งเตือน Telegram</p>
        <span
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            hasToken
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-500 border border-gray-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              hasToken ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}
          />
          {hasToken ? "🟢 เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า"}
        </span>
      </div>

      <div className="divide-y divide-border px-4">
        <Toggle
          label="เปิด Telegram แจ้งเตือน"
          checked={settings.telegram_noti_enabled}
          onChange={(v) => updateField("telegram_noti_enabled", v)}
        />
        <Toggle
          label="แจ้งเตือนเมื่อมีปัญหา 😟"
          checked={settings.telegram_noti_on_problem}
          onChange={(v) => updateField("telegram_noti_on_problem", v)}
        />
        <Toggle
          label="แจ้งเตือน Neutral 😐"
          checked={settings.telegram_noti_on_neutral}
          onChange={(v) => updateField("telegram_noti_on_neutral", v)}
        />
      </div>

      <div className="px-4 py-3 bg-muted/40 border-t border-border space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium w-16">Bot:</span>
          <span className="font-mono">@bestpartcupid_bot</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium w-16">Chat ID:</span>
          <span className="font-mono">{maskedChatId}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Banner Section ───────────────────────────────────────────────────────────

function BannerSection() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("cupid_banners")
      .select("id, title, emoji, bg_color, is_active, sort_order, subtitle, link_url")
      .order("sort_order");
    setRows((data ?? []) as BannerRow[]);
    setLoading(false);
  }

  function update(id: string, field: keyof BannerRow, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  async function save(row: BannerRow) {
    setSaving(row.id);
    await supabase
      .from("cupid_banners")
      .update({
        title: row.title,
        emoji: row.emoji,
        bg_color: row.bg_color,
        is_active: row.is_active,
        sort_order: row.sort_order,
        subtitle: row.subtitle,
        link_url: row.link_url,
      })
      .eq("id", row.id);
    setSaving(null);
  }

  async function addNew() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { data } = await supabase
      .from("cupid_banners")
      .insert({ title: "Banner ใหม่", sort_order: maxOrder + 1, bg_color: "#2C1A0E" })
      .select()
      .single();
    if (data) setRows((prev) => [...prev, data as BannerRow]);
  }

  async function del(id: string) {
    await supabase.from("cupid_banners").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const updated = [...rows];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    const reordered = updated.map((r, i) => ({ ...r, sort_order: i }));
    setRows(reordered);
    // persist new sort orders
    reordered.forEach((r) =>
      supabase.from("cupid_banners").update({ sort_order: r.sort_order }).eq("id", r.id)
    );
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Banner Slides</p>
        <Button size="sm" variant="outline" onClick={addNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> เพิ่ม
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Emoji</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">BG Color</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 text-center">Order</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={row.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <input
                    className="w-10 text-center border border-border rounded px-1 py-0.5 text-base bg-background"
                    value={row.emoji ?? ""}
                    onChange={(e) => update(row.id, "emoji", e.target.value)}
                    onBlur={() => save(row)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[120px] border border-border rounded px-2 py-1 text-xs bg-background focus:outline-none"
                    value={row.title}
                    onChange={(e) => update(row.id, "title", e.target.value)}
                    onBlur={() => save(row)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      className="w-7 h-7 rounded cursor-pointer border-0"
                      value={row.bg_color}
                      onChange={(e) => update(row.id, "bg_color", e.target.value)}
                      onBlur={() => save(row)}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {row.bg_color}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => {
                      update(row.id, "is_active", !row.is_active);
                      supabase
                        .from("cupid_banners")
                        .update({ is_active: !row.is_active })
                        .eq("id", row.id);
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      row.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {row.is_active ? "On" : "Off"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === rows.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => save(row)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Save"
                    >
                      {saving === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => del(row.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Feature Toggles ──────────────────────────────────────────────────────────

function FeatureToggles() {
  const [settings, setSettings] = useState<CupidSettings | null>(null);

  useEffect(() => {
    supabase
      .from("cupid_settings")
      .select("id, qa_is_active, announcement_is_active, announcement_text, announcement_title")
      .eq("id", 1)
      .single()
      .then(({ data }) => setSettings(data as CupidSettings));
  }, []);

  async function toggle(field: keyof CupidSettings, value: boolean) {
    if (!settings) return;
    setSettings((prev) => prev ? { ...prev, [field]: value } : prev);
    await supabase.from("cupid_settings").update({ [field]: value }).eq("id", 1);
  }

  if (!settings) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold mb-2">Feature Toggles</p>
      <div className="bg-card border border-border rounded-xl divide-y divide-border px-4">
        <Toggle
          label="✨ เหมือนฝัน Section"
          checked={true}
          onChange={() => {}}
        />
        <Toggle
          label="📝 Founder Card"
          checked={true}
          onChange={() => {}}
        />
        <Toggle
          label="❓ Weekly Q&A"
          checked={settings.qa_is_active}
          onChange={(v) => toggle("qa_is_active", v)}
        />
        <Toggle
          label="📢 Announcement Banner"
          checked={settings.announcement_is_active}
          onChange={(v) => toggle("announcement_is_active", v)}
        />
      </div>
    </div>
  );
}

// ─── Weekly Questions ─────────────────────────────────────────────────────────

function WeeklyQASection() {
  const [questions, setQuestions] = useState<WeeklyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQ, setNewQ] = useState({ question: "", opt1: "", opt2: "", opt3: "" });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cupid_weekly_questions")
      .select("*")
      .order("sort_order");
    setQuestions(
      (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        options: Array.isArray(r.options) ? r.options : [],
      })) as WeeklyQuestion[]
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addQuestion() {
    if (!newQ.question.trim()) return;
    setAdding(true);
    const options = [newQ.opt1, newQ.opt2, newQ.opt3].filter(Boolean);
    const maxOrder = questions.reduce((m, q) => Math.max(m, q.sort_order), 0);
    const { data } = await supabase
      .from("cupid_weekly_questions")
      .insert({ question: newQ.question.trim(), options, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (data) {
      const row = data as Record<string, unknown>;
      setQuestions((prev) => [
        ...prev,
        { ...row, options: Array.isArray(row.options) ? row.options : [] } as WeeklyQuestion,
      ]);
      setNewQ({ question: "", opt1: "", opt2: "", opt3: "" });
    }
    setAdding(false);
  }

  async function del(id: string) {
    await supabase.from("cupid_weekly_questions").delete().eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function toggleActive(q: WeeklyQuestion) {
    setSaving(q.id);
    await supabase
      .from("cupid_weekly_questions")
      .update({ is_active: !q.is_active })
      .eq("id", q.id);
    setQuestions((prev) =>
      prev.map((r) => (r.id === q.id ? { ...r, is_active: !r.is_active } : r))
    );
    setSaving(null);
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Weekly Q&A Questions</p>

      {/* Existing */}
      <div className="space-y-2">
        {questions.map((q) => (
          <div
            key={q.id}
            className="bg-card border border-border rounded-xl p-3 flex gap-3 items-start"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{q.question}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ตัวเลือก: {q.options.join(" / ")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleActive(q)}
                disabled={saving === q.id}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  q.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {saving === q.id ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : q.is_active ? (
                  "Active"
                ) : (
                  "Inactive"
                )}
              </button>
              <button
                onClick={() => del(q.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">เพิ่มคำถามใหม่</p>
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
          placeholder="คำถาม..."
          value={newQ.question}
          onChange={(e) => setNewQ((p) => ({ ...p, question: e.target.value }))}
        />
        <div className="grid grid-cols-3 gap-2">
          {(["opt1", "opt2", "opt3"] as const).map((k, i) => (
            <input
              key={k}
              className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none"
              placeholder={`ตัวเลือก ${i + 1}`}
              value={newQ[k]}
              onChange={(e) => setNewQ((p) => ({ ...p, [k]: e.target.value }))}
            />
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={addQuestion}
          disabled={adding || !newQ.question.trim()}
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          เพิ่มคำถาม
        </Button>
      </div>
    </div>
  );
}

// ─── Placeholder for simple pages ─────────────────────────────────────────────

function ComingSoonContent({ page }: { page: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <p className="text-3xl">🚧</p>
      <p className="text-sm font-medium">{page} Settings</p>
      <p className="text-xs text-muted-foreground">Coming in Sprint R3</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CupidPageSettings() {
  const [activePage, setActivePage] = useState<PageKey>("landing");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">⚙️ Page Settings</h1>
        <p className="text-sm text-muted-foreground">จัดการเนื้อหาและการตั้งค่าของ Cupid App</p>
      </div>

      {/* Notification settings — always visible at top */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          การแจ้งเตือน
        </p>
        <TelegramSettings />
      </div>

      {/* Page CMS */}
      <div className="flex gap-5">
        {/* Left sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-4 space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 mb-2">
              Pages
            </p>
            {PAGES.map((p) => (
              <button
                key={p.key}
                onClick={() => setActivePage(p.key)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activePage === p.key
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile top nav */}
        <div className="md:hidden w-full">
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background mb-4"
            value={activePage}
            onChange={(e) => setActivePage(e.target.value as PageKey)}
          >
            {PAGES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Page content */}
        <div className="flex-1 min-w-0 space-y-6">
          <p className="text-sm font-medium text-muted-foreground">
            {PAGES.find((p) => p.key === activePage)?.label}
          </p>

          {activePage === "landing" && (
            <>
              <BannerSection />
              <FeatureToggles />
            </>
          )}

          {activePage === "thanks" && <WeeklyQASection />}

          {activePage !== "landing" && activePage !== "thanks" && (
            <ComingSoonContent
              page={PAGES.find((p) => p.key === activePage)?.label ?? activePage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
