import { useListDocuments, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, ExternalLink, Search } from "lucide-react";
import { useState } from "react";

function categoryBadge(category: string) {
  const map: Record<string, string> = {
    bylaws: "bg-blue-100 text-blue-700",
    minutes: "bg-green-100 text-green-700",
    guidelines: "bg-purple-100 text-purple-700",
    financial: "bg-amber-100 text-amber-700",
    rules: "bg-orange-100 text-orange-700",
  };
  return map[category?.toLowerCase()] ?? "bg-gray-100 text-gray-700";
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const { data: documents, isLoading } = useListDocuments({ query: { queryKey: getListDocumentsQueryKey() } });

  const filtered = documents?.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.category ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <>
      <PageHeader title="Documents" subtitle="HOA bylaws, meeting minutes, and community guidelines" />
      <PageContent>
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>

       {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((doc) => (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground leading-snug">
                          {doc.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.description || "No description provided."}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${categoryBadge(doc.category || "general")}`}>
                            {doc.category || "General"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
