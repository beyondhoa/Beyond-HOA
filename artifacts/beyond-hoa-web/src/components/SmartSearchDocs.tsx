import React, { useState } from 'react';

export default function SmartSearchDocs() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Replace with your local FastAPI, Node, or Supabase Edge Function endpoint
      const response = await fetch('https://your-api-endpoint.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      // Expected backend response shape:
      // { answer: "...", sources: ["Budget_2026.pdf", "Rules.pdf"] }
      setResult(data);
    } catch (error) {
      console.error("Search failed:", error);
      setResult({
        answer: "Error retrieving answer. Please check your backend connection.",
        sources: []
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* 1. Smart Search Bar */}
      <form onSubmit={handleSearch} className="relative flex items-center mb-6">
        <input
          type="text"
          placeholder="Ask a question about your documents (e.g., 'What is the trash schedule?')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-5 py-3 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner text-gray-800"
        />
        <button
          type="submit"
          className="absolute right-3 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
        >
          🔍
        </button>
      </form>

      {/* 2. Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 space-x-2 text-gray-500">
          <span className="animate-spin">🔄</span>
          <span>Reading your documents...</span>
        </div>
      )}

      {/* 3. Results Panel */}
      {result && (
        <div className="space-y-6 border-t pt-6 animate-fade-in">
          {/* AI Generated Answer */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h3 className="text-blue-800 font-semibold mb-2 flex items-center">
              ✨ AI Summary
            </h3>
            <p className="text-gray-700 leading-relaxed">{result.answer}</p>
          </div>

          {/* Sources Section */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Sources Found
              </h4>
              <ul className="space-y-2">
                {result.sources.map((source, idx) => (
                  <li 
                    key={idx} 
                    className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 border rounded-lg cursor-pointer transition text-gray-700"
                  >
                    📄 <span className="ml-2 font-medium">{source}</span>
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
