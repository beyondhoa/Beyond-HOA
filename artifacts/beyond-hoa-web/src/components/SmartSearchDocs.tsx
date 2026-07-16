import React, { useState } from 'react';

// 1. Mock Database of Answers based on search keywords
const MOCK_ANSWERS = [
  {
    keywords: ["trash", "garbage", "recycle", "pickup"],
    answer: "Trash pickup occurs every Tuesday morning at 7:00 AM. Recycling is collected bi-weekly on the same day. Please ensure bins are placed at the curb no earlier than Monday evening at 6:00 PM.",
    sources: ["Trash_and_Recycling_Schedule_2026.pdf", "HOA_Rules_and_Regs.docx"]
  },
  {
    keywords: ["budget", "financial", "dues", "cost", "fee", "money"],
    answer: "The 2026 annual HOA budget is finalized at $85,000. Of this, $5,000 has been specifically allocated for the new Community Garden initiative. Monthly dues remain unchanged at $150 per household.",
    sources: ["HOA_Budget_Allocation_2026.pdf", "Treasurer_Report_Q4.pdf"]
  },
  {
    keywords: ["garden", "community garden", "plant", "landscaping"],
    answer: "The community garden project is set to begin construction in Spring 2026. Plots will be available to residents on a first-come, first-served basis. A deposit of $25 is required to reserve a plot.",
    sources: ["Community_Garden_Guidelines.pdf", "HOA_Budget_Allocation_2026.pdf"]
  },
  {
    keywords: ["pet", "dog", "cat", "leash", "animal"],
    answer: "All household pets must be kept on a leash at all times when on common community grounds. Owners are legally and financially responsible for cleaning up after their pets immediately.",
    sources: ["HOA_Bylaws_Amended_2024.pdf"]
  }
];

// Fallback answer if the search doesn't match our mockup keywords
const DEFAULT_FALLBACK = {
  answer: "No specific match found in the database. (Mock System Note: For this prototype, try searching for keywords like 'trash', 'budget', 'garden', or 'pet' to see specific RAG responses!)",
  sources: []
};

export default function SmartSearchDocs() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    // Simulate a 1-second database & LLM delay
    setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      
      // Look for a matching mock database entry
      const matchedData = MOCK_ANSWERS.find(item => 
        item.keywords.some(keyword => lowerQuery.includes(keyword))
      );

      if (matchedData) {
        setResult({
          answer: matchedData.answer,
          sources: matchedData.sources
        });
      } else {
        setResult(DEFAULT_FALLBACK);
      }
      
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
      {/* Search Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          ✨ Ask the AI HOA Advisor
        </h3>
        <p className="text-xs text-gray-400">
          Instant answers sourced directly from your uploaded community records.
        </p>
      </div>

      {/* Smart Search Bar */}
      <form onSubmit={handleSearch} className="relative flex items-center mb-6">
        <input
          type="text"
          placeholder="Ask a question (e.g., 'When is trash day?' or 'What is the budget?')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-5 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm text-sm text-gray-800"
        />
        <button
          type="submit"
          className="absolute right-3 p-2 text-muted-foreground hover:text-primary transition"
        >
          🔍
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 space-x-2 text-gray-500 text-sm">
          <span className="animate-spin text-primary">🔄</span>
          <span>Reading community files...</span>
        </div>
      )}

      {/* Results Panel */}
      {result && (
        <div className="space-y-6 border-t pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* AI Generated Answer */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
            <h4 className="text-primary font-semibold text-xs uppercase tracking-wider mb-2">
              Advisor Summary
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">{result.answer}</p>
          </div>

          {/* Sources Section */}
          {result.sources.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Source Files Used
              </h4>
              <ul className="space-y-2">
                {result.sources.map((source, idx) => (
                  <li 
                    key={idx} 
                    className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg transition text-xs text-gray-700 font-medium cursor-pointer"
                  >
                    📄 <span className="ml-2">{source}</span>
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
