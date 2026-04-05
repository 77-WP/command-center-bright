import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Save, Globe, Loader2 } from "lucide-react";

interface SiteContent {
  content_key: string;
  description: string | null;
  translations: { th?: string; en?: string; zh?: string };
  updated_at: string | null;
}

function ContentRow({ item }: { item: SiteContent }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [th, setTh] = useState(item.translations?.th ?? "");
  const [en, setEn] = useState(item.translations?.en ?? "");
  const [zh, setZh] = useState(item.translations?.zh ?? "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_content")
        .update({
          translations: { th, en, zh },
          updated_at: new Date().toISOString(),
        })
        .eq("content_key", item.content_key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_content"] });
      toast({ title: "Content updated successfully!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isLong = th.length > 60 || en.length > 60 || zh.length > 60;
  const InputComponent = isLong ? Textarea : Input;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-foreground truncate">
                  {item.description || item.content_key}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.content_key}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {item.translations?.th ? "TH ✓" : "TH ✗"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {item.translations?.en ? "EN ✓" : "EN ✗"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {item.translations?.zh ? "ZH ✓" : "ZH ✗"}
                </Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">🇹🇭 Thai</Label>
                <InputComponent value={th} onChange={(e) => setTh(e.target.value)} placeholder="Thai translation..." />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">🇬🇧 English</Label>
                <InputComponent value={en} onChange={(e) => setEn(e.target.value)} placeholder="English translation..." />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">🇨🇳 Chinese</Label>
                <InputComponent value={zh} onChange={(e) => setZh(e.target.value)} placeholder="Chinese translation..." />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function AddContentKeyDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [desc, setDesc] = useState("");

  const insertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_content").insert({
        content_key: key,
        description: desc || null,
        translations: { th: "", en: "", zh: "" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_content"] });
      toast({ title: "New content key added!" });
      setKey("");
      setDesc("");
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Content Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Content Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label>Content Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. homepage_hero_title" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. หัวข้อใหญ่สุดหน้าแรก" />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending || !key.trim()}>
              {insertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContentManager() {
  const { data: contents, isLoading } = useQuery({
    queryKey: ["site_content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content")
        .select("*")
        .order("content_key");
      if (error) throw error;
      return data as SiteContent[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6" /> Content Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage website text and translations (TH, EN, ZH).
          </p>
        </div>
        <AddContentKeyDialog />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !contents?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No content keys found. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contents.map((item) => (
            <ContentRow key={item.content_key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
