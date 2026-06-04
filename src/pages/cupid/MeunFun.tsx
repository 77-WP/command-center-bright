import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { th } from "date-fns/locale";
import { Plus, Pencil, X, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromotedFeedback {
  id: string;
  text: string | null;
  mood: string;
  source: string | null;
  nickname: string | null;
  phone: string | null;
  created_at: string;
}

interface StoryRow {
  id: string;
  title: string;
  icon: string | null;
  summary: string;
  story_text: string | null;
  status: string | null;
  inspired_by_nickname: string | null;
  timeline: TimelineEntry[] | null;
  display_order: number;
  updated_at: string;
  created_at: string;
}

interface TimelineEntry {
  date: string;
  description: string;
}

const STATUS_OPTIONS = ["กำลังทำ", "เสร็จแล้ว", "รับทราบ"];

const STATUS_BADGE: Record<string, string> = {
  กำลังทำ: "bg-blue-100 text-blue-800",
  เสร็จแล้ว: "bg-green-100 text-green-800",
  รับทราบ: "bg-gray-100 text-gray-700",
  done: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
};

const MOOD_EMOJI: Record<string, string> = {
  happy: "😄",
  neutral: "😐",
  problem: "😟",
};

// ─── Slide-over Panel ─────────────────────────────────────────────────────────

interface StoryFormData {
  title: string;
  summary: string;
  story_text: string;
  icon: string;
  status: string;
  inspired_by_nickname: string;
  timeline: TimelineEntry[];
}

const EMPTY_FORM: StoryFormData = {
  title: "",
  summary: "",
  story_text: "",
  icon: "🌟",
  status: "กำลังทำ",
  inspired_by_nickname: "",
  timeline: [],
};

function SlideOver({
  open,
  onClose,
  initialData,
  editId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialData: StoryFormData;
  editId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StoryFormData>(initialData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialData);
  }, [initialData, open]);

  function setField<K extends keyof StoryFormData>(k: K, v: StoryFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function addTimelineEntry() {
    setField("timeline", [
      ...form.timeline,
      { date: format(new Date(), "yyyy-MM-dd"), description: "" },
    ]);
  }

  function updateTimeline(i: number, key: keyof TimelineEntry, val: string) {
    const updated = form.timeline.map((e, idx) =>
      idx === i ? { ...e, [key]: val } : e
    );
    setField("timeline", updated);
  }

  function removeTimeline(i: number) {
    setField("timeline", form.timeline.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      story_text: form.story_text.trim() || null,
      icon: form.icon.trim() || "🌟",
      status: form.status,
      inspired_by_nickname: form.inspired_by_nickname.trim() || null,
      timeline: form.timeline,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      await supabase.from("cupid_joe_mode").update(payload).eq("id", editId);
    } else {
      await supabase.from("cupid_joe_mode").insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">
            {editId ? "แก้ไข Story" : "สร้าง Story ใหม่"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Emoji icon */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Emoji Icon</label>
            <input
              className="mt-1 w-16 border border-border rounded-lg p-2 text-center text-xl bg-background"
              value={form.icon}
              onChange={(e) => setField("icon", e.target.value)}
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="ชื่อเรื่อง..."
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Summary (สั้นๆ)</label>
            <input
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="ประโยคสรุปสั้น..."
              value={form.summary}
              onChange={(e) => setField("summary", e.target.value)}
            />
          </div>

          {/* Story content */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Story Content</label>
            <textarea
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none h-28"
              placeholder="เขียน narrative เต็มๆ..."
              value={form.story_text}
              onChange={(e) => setField("story_text", e.target.value)}
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Inspired by */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Inspired by</label>
            <input
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="ลูกค้า / ชื่อเล่น..."
              value={form.inspired_by_nickname}
              onChange={(e) => setField("inspired_by_nickname", e.target.value)}
            />
          </div>

          {/* Timeline */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">Progress Timeline</label>
              <button
                onClick={addTimelineEntry}
                className="text-xs text-primary flex items-center gap-0.5 hover:underline"
              >
                <PlusCircle className="h-3.5 w-3.5" /> เพิ่ม
              </button>
            </div>
            <div className="space-y-2">
              {form.timeline.map((entry, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="date"
                    className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background w-36 focus:outline-none"
                    value={entry.date}
                    onChange={(e) => updateTimeline(i, "date", e.target.value)}
                  />
                  <input
                    className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none"
                    placeholder="รายละเอียด..."
                    value={entry.description}
                    onChange={(e) => updateTimeline(i, "description", e.target.value)}
                  />
                  <button
                    onClick={() => removeTimeline(i)}
                    className="text-muted-foreground hover:text-destructive mt-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {editId ? "บันทึก" : "✨ Publish Story"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CupidMeunFun() {
  const [tab, setTab] = useState<"promoted" | "stories">("promoted");
  const [promoted, setPromoted] = useState<PromotedFeedback[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [formData, setFormData] = useState<StoryFormData>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "promoted") loadPromoted();
    else loadStories();
  }, [tab]);

  async function loadPromoted() {
    setLoading(true);
    const { data } = await supabase
      .from("cupid_feedback")
      .select("id, text, mood, source, nickname, phone, created_at")
      .eq("status", "promoted")
      .order("created_at", { ascending: false });
    setPromoted((data ?? []) as PromotedFeedback[]);
    setLoading(false);
  }

  async function loadStories() {
    setLoading(true);
    const { data } = await supabase
      .from("cupid_joe_mode")
      .select("*")
      .order("created_at", { ascending: false });
    setStories((data ?? []) as StoryRow[]);
    setLoading(false);
  }

  function openCreateFromFeedback(fb: PromotedFeedback) {
    const inspiredBy =
      fb.nickname ||
      (fb.phone ? "ลูกค้า •••" + fb.phone.slice(-3) : "ลูกค้า");
    setFormData({
      ...EMPTY_FORM,
      summary: fb.text?.slice(0, 120) ?? "",
      inspired_by_nickname: inspiredBy,
    });
    setEditId(null);
    setPanelOpen(true);
  }

  function openEdit(story: StoryRow) {
    setFormData({
      title: story.title,
      summary: story.summary,
      story_text: story.story_text ?? "",
      icon: story.icon ?? "🌟",
      status: story.status ?? "กำลังทำ",
      inspired_by_nickname: story.inspired_by_nickname ?? "",
      timeline: Array.isArray(story.timeline) ? story.timeline : [],
    });
    setEditId(story.id);
    setPanelOpen(true);
  }

  function onSaved() {
    if (tab === "stories") loadStories();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">✨ เหมือนฝัน Manager</h1>
          <p className="text-sm text-muted-foreground">สร้างเรื่องราวที่สร้างแรงบันดาลใจ</p>
        </div>
        {tab === "stories" && (
          <Button
            size="sm"
            onClick={() => {
              setFormData(EMPTY_FORM);
              setEditId(null);
              setPanelOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Story ใหม่
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["promoted", "stories"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "promoted" ? "📥 Promoted Feedback" : "📖 Published Stories"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "promoted" ? (
        <div className="space-y-3">
          {promoted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              ยังไม่มี feedback ที่ promote ครับ
            </p>
          )}
          {promoted.map((fb) => (
            <div
              key={fb.id}
              className="bg-card border border-border rounded-xl p-4 flex gap-4 items-start"
            >
              <span className="text-2xl">{MOOD_EMOJI[fb.mood] ?? "💬"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed line-clamp-2">{fb.text || "—"}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>{fb.source ?? "—"}</span>
                  <span>·</span>
                  <span>
                    {formatDistanceToNow(new Date(fb.created_at), {
                      addSuffix: true,
                      locale: th,
                    })}
                  </span>
                  {fb.nickname && <span>· {fb.nickname}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openCreateFromFeedback(fb)}
              >
                ✍️ Create Story
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stories.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">
              ยังไม่มี story ครับ
            </p>
          )}
          {stories.map((story) => (
            <div
              key={story.id}
              className="bg-card border border-border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{story.icon ?? "🌟"}</span>
                <button
                  onClick={() => openEdit(story)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="font-semibold text-sm leading-snug">{story.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{story.summary}</p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    STATUS_BADGE[story.status ?? ""] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {story.status ?? "—"}
                </span>
                {story.inspired_by_nickname && (
                  <span className="text-xs text-muted-foreground">
                    แรงบันดาลใจ: {story.inspired_by_nickname}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SlideOver
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        initialData={formData}
        editId={editId}
        onSaved={onSaved}
      />
    </div>
  );
}
