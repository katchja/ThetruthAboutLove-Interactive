import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  BookMarked, 
  ExternalLink,
  Zap,
  Filter
} from 'lucide-react';
import { SearchResult, Source, VectorChunk } from '../types';
import { semanticSearch } from '../utils/vectorStore';

interface SemanticSearchPanelProps {
  allChunks: VectorChunk[];
  allSources: Source[];
  onAskAboutExcerpt: (text: string, sourceTitle: string) => void;
  onSelectSource: (sourceId: string) => void;
  onClose: () => void;
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({
  allChunks,
  allSources,
  onAskAboutExcerpt,
  onSelectSource,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    const start = performance.now();

    // Filter chunks by type if selected
    let chunksToSearch = allChunks;
    if (filterType !== 'all') {
      chunksToSearch = allChunks.filter(c => c.sourceType === filterType);
    }

    const matched = await semanticSearch(query, chunksToSearch, undefined, 8);
    const end = performance.now();

    setResults(matched);
    setSearchDurationMs(Math.round(end - start));
    setIsSearching(false);
  };

  const sampleSearchQueries = [
    'life force not an emotion',
    'programmable self-love scam',
    '35 velvet hearts 1990',
    'relational sovereignty',
    'tarot death card ego surrender',
    'Stuart Kauffman adjacent possible',
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#2A2022] overflow-hidden">
      {/* Search Header */}
      <div className="p-4 sm:p-6 border-b border-[#EAE1D9] bg-[#FDFCFA] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-serif-book font-bold text-[#241B1C] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#C85A6E]" />
              Private Local Vector Search
            </h2>
            <p className="text-xs text-[#8C7A7D] mt-0.5">
              Instant cosine similarity matching across {allChunks.length} local subword vector chunks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FCECEF] text-[#9E3E50] border border-[#F3CBD2]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C85A6E]" />
              <span>Zero Cloud Leak</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F5EFEB] text-xs font-semibold px-2 py-1 transition-colors"
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Search input bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#A39295] absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts, quotes, empirical findings, or citations..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E0D4CB] bg-[#FAF7F2] text-sm text-[#2A2022] placeholder-[#A39295] focus:outline-none focus:ring-2 focus:ring-[#C85A6E]/40 focus:border-[#C85A6E]"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-5 py-2.5 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold shadow-md shadow-[#FF2A6D]/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Search</span>
            <Zap className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Filters and quick queries */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#A39295]" />
            <span className="text-[#8C7A7D] text-[11px]">Type:</span>
            {['all', 'chapter', 'scan', 'article', 'note'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  if (query) handleSearch();
                }}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                  filterType === type
                    ? 'bg-[#FCECEF] text-[#9E3E50] border border-[#F3CBD2] font-semibold'
                    : 'text-[#7D6B6E] hover:text-[#241B1C]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <span className="text-[11px] text-[#A39295] shrink-0">Try:</span>
            {sampleSearchQueries.slice(0, 3).map((sample, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(sample);
                  setTimeout(() => handleSearch(), 50);
                }}
                className="px-2 py-0.5 rounded bg-[#F5EFEB] text-[#635154] text-[10px] hover:bg-[#FCECEF] hover:text-[#9E3E50] transition-colors shrink-0"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {searchDurationMs !== null && (
          <div className="flex items-center justify-between text-xs text-[#8C7A7D] px-1">
            <span>
              Found <strong className="text-[#241B1C]">{results.length}</strong> matching passages
            </span>
            <span className="font-mono text-[11px]">
              Cosine distance computed in {searchDurationMs}ms (in-browser)
            </span>
          </div>
        )}

        {results.length === 0 && query.trim() && !isSearching && (
          <div className="text-center py-12 text-[#8C7A7D] text-xs">
            No vector matches found for "{query}". Try broader conceptual keywords.
          </div>
        )}

        {results.length === 0 && !query.trim() && (
          <div className="max-w-md mx-auto text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FCECEF] flex items-center justify-center text-[#C85A6E] mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-serif-book font-semibold text-[#241B1C] text-sm">
              Semantic Conceptual Retrieval
            </h3>
            <p className="text-xs text-[#635154] leading-relaxed">
              Every source, chapter, OCR scan, and author note is indexed into private 256-dimensional vectors. Search by theme rather than just exact keywords.
            </p>
          </div>
        )}

        {results.map((res) => {
          const matchPercent = Math.round(res.similarity * 100);
          return (
            <div
              key={res.chunk.id}
              className="p-4 rounded-xl border border-[#EAE1D9] bg-[#FDFCFA] shadow-sm hover:border-[#C85A6E]/50 transition-all space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FCECEF] text-[#9E3E50] uppercase">
                    {res.chunk.sourceType}
                  </span>
                  <h4 
                    onClick={() => onSelectSource(res.chunk.sourceId)}
                    className="text-xs font-semibold text-[#241B1C] truncate cursor-pointer hover:text-[#C85A6E] transition-colors"
                  >
                    {res.chunk.sourceTitle}
                  </h4>
                  {res.chunk.reference && (
                    <span className="text-[11px] text-[#8C7A7D] font-mono hidden sm:inline">
                      • {res.chunk.reference}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-16 bg-[#EAE1D9] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#C85A6E] h-full rounded-full"
                      style={{ width: `${Math.min(100, matchPercent)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#C85A6E]">
                    {matchPercent}%
                  </span>
                </div>
              </div>

              {/* Passage text */}
              <p className="text-xs text-[#4D3D40] font-serif-book leading-relaxed pl-2 border-l-2 border-[#C85A6E]/60">
                "{res.chunk.text}"
              </p>

              {/* Matched terms tags and ask action */}
              <div className="flex items-center justify-between pt-2 border-t border-[#F0E6DE] text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-[#8C7A7D]">Matched:</span>
                  {res.matchedTerms.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-[#F5EFEB] text-[#635154] font-mono text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onAskAboutExcerpt(res.chunk.text, res.chunk.sourceTitle)}
                  className="inline-flex items-center gap-1 text-[#C85A6E] hover:text-[#B34B5E] font-medium"
                >
                  <span>Ask Manuscript about this</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
