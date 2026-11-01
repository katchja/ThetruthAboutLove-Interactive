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
  isStudioAdmin?: boolean;
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({
  allChunks,
  allSources,
  onAskAboutExcerpt,
  onSelectSource,
  onClose,
  isStudioAdmin = false,
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
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] text-[#0B0B0C] overflow-hidden font-sans">
      {/* Search Header */}
      <div className="p-4 sm:p-6 bg-[#F8F9FA] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-[#0B0B0C] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#0B0B0C]" />
              Private Local Vector Search
            </h2>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Instant cosine similarity matching across {allChunks.length} local subword vector chunks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-[#E8EAED] text-[#0B0B0C]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>Zero Cloud Leak</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED] text-xs font-semibold px-2 py-1 transition-colors"
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Search input bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts, quotes, empirical findings, or citations..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FFFFFF] text-sm text-[#0B0B0C] placeholder-[#80868B] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-5 py-2.5 rounded-xl bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Search</span>
            <Zap className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Filters and quick queries */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#5F6368]" />
            <span className="text-[#5F6368] text-[11px] font-mono">Type:</span>
            {['all', 'chapter', 'scan', 'article', 'note'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  if (query) handleSearch();
                }}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                  filterType === type
                    ? 'bg-[#C83E0B] text-white font-semibold'
                    : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <span className="text-[11px] text-[#5F6368] font-mono shrink-0">Try:</span>
            {sampleSearchQueries.slice(0, 3).map((sample, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(sample);
                  setTimeout(() => handleSearch(), 50);
                }}
                className="px-2 py-0.5 rounded bg-[#E8EAED] text-[#202124] text-[10px] hover:bg-[#C83E0B] hover:text-white transition-colors shrink-0"
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
          <div className="flex items-center justify-between text-xs text-[#5F6368] px-1">
            <span>
              Found <strong className="text-[#0B0B0C]">{results.length}</strong> matching passages
            </span>
            <span className="font-mono text-[11px]">
              Cosine distance computed in {searchDurationMs}ms (in-browser)
            </span>
          </div>
        )}

        {results.length === 0 && query.trim() && !isSearching && (
          <div className="text-center py-12 text-[#5F6368] text-xs">
            No vector matches found for "{query}". Try broader conceptual keywords.
          </div>
        )}

        {results.length === 0 && !query.trim() && (
          <div className="max-w-md mx-auto text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#F1F3F4] flex items-center justify-center text-[#0B0B0C] mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-display font-semibold text-[#0B0B0C] text-sm">
              Semantic Conceptual Retrieval
            </h3>
            <p className="text-xs text-[#5F6368] leading-relaxed">
              Every source, chapter, OCR scan, and author note is indexed into private 256-dimensional vectors. Search by theme rather than just exact keywords.
            </p>
          </div>
        )}

        {results.map((res) => {
          const matchPercent = Math.round(res.similarity * 100);
          const parentSource = allSources.find((s) => s.id === res.chunk.sourceId);
          const isProtectedForVisitor = Boolean(parentSource?.isProtected && !isStudioAdmin);
          const displayExcerpt = isProtectedForVisitor
            ? parentSource?.summary || 'Protected manuscript passage indexed for AI synthesis.'
            : res.chunk.text;

          return (
            <div
              key={res.chunk.id}
              className="p-4 rounded-xl bg-[#F8F9FA] transition-all space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E8EAED] text-[#0B0B0C] uppercase">
                    {res.chunk.sourceType}
                  </span>
                  <h4 
                    onClick={() => onSelectSource(res.chunk.sourceId)}
                    className="text-xs font-display font-semibold text-[#0B0B0C] truncate cursor-pointer hover:text-[#5F6368] transition-colors"
                  >
                    {res.chunk.sourceTitle}
                  </h4>
                  {res.chunk.reference && (
                    <span className="text-[11px] text-[#5F6368] font-mono hidden sm:inline">
                      • {res.chunk.reference}
                    </span>
                  )}
                  {isProtectedForVisitor && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E8EAED] text-[#5F6368] font-mono text-[10px]">
                      <ShieldCheck className="w-2.5 h-2.5 text-[#0B0B0C]" />
                      Protected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-16 bg-[#E8EAED] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#0B0B0C] h-full rounded-full"
                      style={{ width: `${Math.min(100, matchPercent)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#0B0B0C]">
                    {matchPercent}%
                  </span>
                </div>
              </div>

              {/* Passage text or Protected Vetted Summary */}
              <p className="text-xs text-[#202124] font-sans leading-relaxed pl-2">
                {isProtectedForVisitor ? displayExcerpt : `"${displayExcerpt}"`}
              </p>

              {/* Matched terms tags and ask action */}
              <div className="flex items-center justify-between pt-2 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-[#5F6368] font-mono">Matched:</span>
                  {res.matchedTerms.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-[#E8EAED] text-[#5F6368] font-mono text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() =>
                    onAskAboutExcerpt(
                      isProtectedForVisitor
                        ? `the concepts of ${res.matchedTerms.join(', ') || query}`
                        : res.chunk.text,
                      res.chunk.sourceTitle
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white font-medium transition-colors"
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
