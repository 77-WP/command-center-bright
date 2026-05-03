import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AppSettings {
  id: number;
  is_maintenance_mode: boolean;
  maintenance_message: string | null;
}

export default function WebsiteControl() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, is_maintenance_mode, maintenance_message")
        .eq("id", 1)
        .single();

      if (error) {
        toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" });
      } else if (data) {
        setSettings(data as AppSettings);
        setMessage((data as AppSettings).maintenance_message ?? "");
      }
      setLoading(false);
    }
    fetchSettings();
  }, []);

  async function handleToggle(checked: boolean) {
    if (!settings) return;
    setToggling(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ is_maintenance_mode: checked })
      .eq("id", 1);

    if (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } else {
      setSettings((prev) => prev ? { ...prev, is_maintenance_mode: checked } : prev);
      toast({
        title: checked ? "Website Closed" : "Website Open",
        description: checked ? "Maintenance mode is now ON." : "Website is now live.",
      });
    }
    setToggling(false);
  }

  async function handleSaveMessage() {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ maintenance_message: message.trim() || null })
      .eq("id", 1);

    if (error) {
      toast({ title: "Error", description: "Failed to save message.", variant: "destructive" });
    } else {
      setSettings((prev) => prev ? { ...prev, maintenance_message: message.trim() || null } : prev);
      toast({ title: "Saved", description: "Maintenance message updated." });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOpen = !settings?.is_maintenance_mode;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Website Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Control your website's availability to customers.</p>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Website Status</p>
            <span
              className={`inline-flex items-center gap-1.5 text-lg font-bold tracking-wide ${
                isOpen ? "text-green-500" : "text-destructive"
              }`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isOpen ? "bg-green-500" : "bg-destructive"
                }`}
              />
              {isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
          <Switch
            checked={settings?.is_maintenance_mode ?? false}
            onCheckedChange={handleToggle}
            disabled={toggling}
            className="scale-125"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {isOpen
            ? "Your website is live and accepting orders."
            : "Maintenance mode is ON. Customers will see the maintenance message."}
        </p>
      </div>

      {/* Maintenance message card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label className="text-base font-semibold">Maintenance Message</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown to customers when the website is closed.
          </p>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. We're currently closed. Back soon!"
          className="min-h-[100px] resize-none"
        />
        <Button
          onClick={handleSaveMessage}
          disabled={saving}
          className="w-full min-h-[44px]"
        >
          {saving ? "Saving…" : "Save Message"}
        </Button>
      </div>
    </div>
  );
}
