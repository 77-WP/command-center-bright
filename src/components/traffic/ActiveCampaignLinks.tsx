import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Trash2, Link } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ActiveCampaignLinks() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["marketing-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_links")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleCopy = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("marketing_links").update({ is_active: !isActive }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["marketing-links"] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("marketing_links").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link deleted" });
      queryClient.invalidateQueries({ queryKey: ["marketing-links"] });
    }
  };

  if (links.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link className="h-4 w-4" /> Active Campaign Links
          <Badge variant="secondary" className="ml-auto">{links.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id} className={!link.is_active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{link.source}</TableCell>
                <TableCell>{link.campaign}</TableCell>
                <TableCell>
                  <Switch
                    checked={link.is_active ?? true}
                    onCheckedChange={() => handleToggle(link.id, link.is_active ?? true)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(link.id, link.generated_url)} className="h-7 w-7 p-0">
                      {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(link.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
