import { useState, useMemo } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UTMLinkBuilder() {
  const [baseUrl, setBaseUrl] = useState("https://yoursite.com");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const generatedUrl = useMemo(() => {
    try {
      const url = new URL(baseUrl);
      if (source) url.searchParams.set("source", source);
      if (campaign) url.searchParams.set("campaign", campaign);
      return url.toString();
    } catch {
      return "";
    }
  }, [baseUrl, source, campaign]);

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" /> UTM Link Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://yoursite.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. facebook, tiktok, line_oa" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. promo_march" />
          </div>
        </div>

        {generatedUrl && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono text-foreground break-all border border-border">
              {generatedUrl}
            </div>
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
