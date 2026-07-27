import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

interface SearchSource {
  id?: string;
  title?: string;
  url?: string;
  [key: string]: any;
}

interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

const DEFAULT_FALLBACK: SearchResult = {
  answer: "No relevant community documents found matching your query.",
  sources: [],
};

export function SmartSearchDocs() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/smart-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          answer: data.answer || "No answer generated.",
          sources: data.sources || [],
        });
      } else {
        setResult(DEFAULT_FALLBACK);
      }
    } catch (err) {
      console.error("Smart search failed:", err);
      setResult(DEFAULT_FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search HOA bylaws, policies, CC&Rs..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading} className="bg-indigo-950 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Search
        </Button>
      </form>

      {result && (
        <div className="p-4 rounded-xl border bg-card space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">{result.answer}</p>
          {result.sources.length > 0 && (
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-slate-900">Sources Referenced:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {result.sources.map((source, idx) => (
                  <li key={source.id || idx}>
                    {source.title || `Document ${idx + 1}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}