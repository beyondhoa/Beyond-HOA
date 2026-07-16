import React, { useState } from 'react';
import { useListDocuments, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, ExternalLink, Search } from "lucide-react";
import SmartSearchDocs from '@/components/SmartSearchDocs'; // Added your AI Search Component import

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
        {/* 🌟 1. Smart AI Search (Placed prominently at the top of the content) */}
        <div className="mb-8">
          <SmartSearchDocs />
        </div>

        <hr className="my-8 border-t border-muted" />

        {/* 📂 2. Standard Document Manager Browser */}
        <h3 className="text-lg font-semibold text-foreground mb-4">Browse All Files</h3>
        
        {/* Manual Keyword Filter */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter list by title or category..."
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>

        {/* Documents List */}
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
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filtered.map((doc) => (
                  <a
                    key={doc.id}
                    href={`${import.meta.env.VITE_API_URL}/api/documents/view/${doc.doc_path?.split("/").pop() ?? doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors group"
                    data-testid={`link-document-${doc.id}`}
                  >
                    <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {doc.title}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {doc.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${categoryBadge(doc.category)}`}>
                          {doc.category}
                        </span>
                      )}
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </>
  );
}
