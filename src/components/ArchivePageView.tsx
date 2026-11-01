import React, { useState, useMemo } from 'react';
import {
  Archive,
  BookMarked,
  FileText,
  Image as ImageIcon,
  FileCode,
  Layers,
  ExternalLink,
  Lock,
  Sparkles,
  Search,
  Plus,
  Download,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Eye,
  Quote,
  Trash2,
  Pencil,
  ImagePlus,
  CloudUpload,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  Source,
  SourceType,
  BookMetadata,
  ArchiveSection,
  getSourceSection,
  getSourceImages,
} from '../types';
import { isPurgedArchiveSource } from '../utils/vectorStore';
import { sanitizeExternalUrl } from '../utils/security';
import { Labs3DBlobShape, LabsFlowerShape } from './LabsFloatingShapes';

interface ArchivePageViewProps {
  sources: Source[];
  bookMetadata: BookMetadata;
  onOpenSourceDetail: (source: Source) => void;
  onOpenAddSource?: (section?: ArchiveSection) => void;
  onAskAboutSourceInStudio: (source: Source) => void;
  onEditSource?: (source: Source) => void;
  onAddPicturesToSource?: (source: Source, dataUrls: string[]) => Promise<void> | void;
  onRemovePictureFromSource?: (source: Source, imageIndex?: number) => Promise<void> | void;
  onDeleteSource?: (id: string) => void;
  isStudioAdmin?: boolean;
  totalVectorChunks: number;
  onReturnHome?: () => void;
  onPublishToPublic?: () => Promise<void> | void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  syncedStats?: {
    totalSources: number;
    photoCount: number;
    citationCount: number;
  };
}

const TYPE_CONFIG: Record<
  SourceType,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  chapter: {
    label: 'Book Chapter',
    color: 'text-[#0B0B0C]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: BookMarked,
  },
  article: {
    label: 'Substack Article',
    color: 'text-[#0B0B0C]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: FileText,
  },
  scan: {
    label: 'Archival Scan / OCR',
    color: 'text-[#202124]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: ImageIcon,
  },
  note: {
    label: 'Author Note',
    color: 'text-[#202124]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: FileCode,
  },
  book: {
    label: 'External Book',
    color: 'text-[#0B0B0C]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: BookMarked,
  },
  citation: {
    label: 'Citation / Quote',
    color: 'text-[#202124]',
    bg: 'bg-[#E8EAED]',
    border: 'border-transparent',
    icon: Layers,
  },
};

export const ArchivePageView: React.FC<ArchivePageViewProps> = ({
  sources,
  bookMetadata,
  onOpenSourceDetail,
  onOpenAddSource,
  onAskAboutSourceInStudio,
  onEditSource,
  onAddPicturesToSource,
  onRemovePictureFromSource,
  onDeleteSource,
  isStudioAdmin = false,
  totalVectorChunks,
  onReturnHome,
  onPublishToPublic,
  syncStatus = 'idle',
  syncedStats,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null);

  const handleQuickPictureUpload = (
    source: Source,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!isStudioAdmin || !onAddPicturesToSource) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers: Promise<string>[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve((ev.target?.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          })
      );

    Promise.all(readers)
      .then((dataUrls) => {
        const valid = dataUrls.filter(Boolean);
        if (valid.length > 0) {
          Promise.resolve(onAddPicturesToSource(source, valid)).catch(() => {});
        }
      })
      .catch(() => {});

    e.target.value = '';
  };

  // Filter sources based on search and type
  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (isPurgedArchiveSource(s)) return false;
      const q = searchQuery.toLowerCase().trim();
      const canSearchRaw = !s.isProtected || isStudioAdmin;
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        (canSearchRaw && s.content.toLowerCase().includes(q)) ||
        (s.author && s.author.toLowerCase().includes(q)) ||
        (s.reference && s.reference.toLowerCase().includes(q)) ||
        s.tags.some((t) => t.toLowerCase().includes(q));

      const matchesType = selectedType === 'all' || s.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [sources, searchQuery, selectedType, isStudioAdmin]);

  // Split into the two requested archive sections
  const authoredSources = useMemo(
    () => filteredSources.filter((s) => getSourceSection(s) === 'authored'),
    [filteredSources]
  );

  const referenceSources = useMemo(
    () => filteredSources.filter((s) => getSourceSection(s) === 'references'),
    [filteredSources]
  );

  // Counts by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: sources.length,
      chapter: 0,
      article: 0,
      scan: 0,
      note: 0,
      book: 0,
      citation: 0,
    };
    sources.forEach((s) => {
      if (counts[s.type] !== undefined) {
        counts[s.type]++;
      }
    });
    return counts;
  }, [sources]);

  // Format citation for each source
  const formatCitation = (s: Source): string => {
    const authorStr = s.author || bookMetadata.author;
    const yearStr = s.year ? ` (${s.year})` : '';
    const refStr = s.reference ? ` ${s.reference}.` : '';
    const safeUrl = sanitizeExternalUrl(s.externalUrl);
    const urlStr = safeUrl ? ` Retrieved from ${safeUrl}` : '';
    return `${authorStr}${yearStr}. "${s.title}."${refStr}${urlStr}`;
  };

  const handleCopyCitation = (s: Source) => {
    const citation = formatCitation(s);
    navigator.clipboard.writeText(citation).catch(() => {});
    setCopiedCitationId(s.id);
    setTimeout(() => setCopiedCitationId(null), 2000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Export full bibliography
  const handleExportBibliography = () => {
    let text = `# Archival References & Vetted Sources Bibliography\n`;
    text += `Companion to: "${bookMetadata.title}" by ${bookMetadata.author}\n`;
    text += `Generated: ${new Date().toLocaleDateString()}\n`;
    text += `Total Vetted Items: ${sources.length} | Indexed Vector Chunks: ${totalVectorChunks}\n\n`;
    text += `---\n\n`;

    text += `## Part I: Authored by Catalina\n\n`;
    sources
      .filter((s) => getSourceSection(s) === 'authored')
      .forEach((s, idx) => {
        text += `### [${idx + 1}] ${s.title}\n`;
        text += `- **Type:** ${s.type.toUpperCase()}\n`;
        text += `- **Citation:** ${formatCitation(s)}\n`;
        if (s.reference) text += `- **Reference:** ${s.reference}\n`;
        if (s.externalUrl) text += `- **Link:** ${s.externalUrl}\n`;
        text += `- **Tags:** ${s.tags.join(', ')}\n`;
        text += `- **Vetted Summary:** ${s.summary}\n\n`;
      });

    text += `## Part II: Literature, References and Quotations\n\n`;
    const refs = sources.filter((s) => getSourceSection(s) === 'references');
    if (refs.length === 0) {
      text += `_No external citations or quotations added yet._\n\n`;
    } else {
      refs.forEach((s, idx) => {
        text += `[${idx + 1}] ${formatCitation(s)} — ${s.summary}\n\n`;
      });
    }

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bookMetadata.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_references_archive.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0B0B0C] font-sans pb-24">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden bg-[#F8F9FA]">
        {/* Corner-Offset Floating Shapes away from header copy */}
        <Labs3DBlobShape
          variant="tilted"
          className="hidden lg:block absolute -right-24 -top-20 w-[260px] h-[260px] opacity-65 labs-shape-float-rotate"
        />
        <LabsFlowerShape
          variant="soft-bloom"
          className="hidden xl:block absolute -left-28 -bottom-28 w-[240px] h-[240px] opacity-55 labs-shape-float-breathe"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {onReturnHome && (
                  <button
                    onClick={onReturnHome}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#C83E0B] hover:bg-[#A93207] text-white transition-colors cursor-pointer"
                    title="Return to Home: The Truth About Love"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>The Truth About Love</span>
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#E8EAED] text-[#0B0B0C]">
                  <Archive className="w-3.5 h-3.5 text-[#0B0B0C]" />
                  MANUSCRIPT ARCHIVE &amp; CITATIONS
                </span>
                <span className="text-xs text-[#5F6368] font-mono">
                  {sources.length} Cataloged Sources · {totalVectorChunks} Vector Passages
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-normal text-[#0B0B0C] tracking-tight">
                Curated Reference Archive
              </h1>
              <p className="text-xs sm:text-sm text-[#5F6368] max-w-3xl leading-relaxed font-sans">
                Manuscript chapters, autobiographical notes, hand-written notes, reference literature and research citations with attribution and recognitions live on the separate Manuscript Archive &amp; Citations Page. Explore at your leisure. Original documents are protected to respect intellectual property.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isStudioAdmin && onPublishToPublic && (
                <button
                  type="button"
                  onClick={() => onPublishToPublic()}
                  disabled={syncStatus === 'syncing'}
                  className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    syncStatus === 'synced'
                      ? 'bg-[#F1F3F4] text-[#0B0B0C] hover:bg-[#E8EAED]'
                      : syncStatus === 'error'
                      ? 'bg-[#202124] text-white'
                      : 'bg-[#C83E0B] text-white hover:bg-[#A93207]'
                  }`}
                  title="Sync all Studio photos, cards, and Bibliographic & Citation Index entries to the public link"
                >
                  {syncStatus === 'syncing' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Publishing to Public...</span>
                    </>
                  ) : syncStatus === 'synced' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0B0B0C]" />
                      <span className="font-mono">
                        Published ({syncedStats?.photoCount ?? 0} Photos · {syncedStats?.citationCount ?? referenceSources.length} Citations)
                      </span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-3.5 h-3.5 text-white" />
                      <span>Publish to Public</span>
                    </>
                  )}
                </button>
              )}

              {isStudioAdmin && onOpenAddSource && (
                <button
                  onClick={() => onOpenAddSource('authored')}
                  className="px-4 py-2.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Archive</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Section Jump Links, Type Filters */}
      <div className="sticky top-16 z-20 bg-[#FFFFFF]/95 backdrop-blur-md py-3.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapters, Substack essays, citations, quotations..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-[#F1F3F4] text-xs text-[#0B0B0C] placeholder-[#80868B] focus:outline-none font-sans"
            />
          </div>

          {/* Section Quick-Jump Anchors */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => scrollToSection('section-authored')}
              className="px-3.5 py-1.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#0B0B0C] font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <BookMarked className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>Authored by Catalina</span>
              <span className="text-[10px] font-mono text-[#5F6368]">({authoredSources.length})</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('section-references')}
              className="px-3.5 py-1.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#0B0B0C] font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <Quote className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>Literature, References &amp; Quotations</span>
              <span className="text-[10px] font-mono text-[#5F6368]">({referenceSources.length})</span>
            </button>
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
            {[
              { id: 'all', label: 'All Types', count: typeCounts.all },
              { id: 'chapter', label: 'Book Chapters', count: typeCounts.chapter },
              { id: 'article', label: 'Substack Articles', count: typeCounts.article },
              { id: 'citation', label: 'Citations & Quotes', count: typeCounts.citation },
              { id: 'book', label: 'Books', count: typeCounts.book },
              { id: 'note', label: 'Notes', count: typeCounts.note },
              { id: 'scan', label: 'Scans', count: typeCounts.scan },
            ]
              .filter((tab) => tab.id === 'all' || tab.count > 0)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    selectedType === tab.id
                      ? 'bg-[#C83E0B] text-white'
                      : 'bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED] hover:text-[#0B0B0C]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                      selectedType === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E8EAED] text-[#5F6368]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main Content Area: Stacked Sections */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-16">
        {/* =====================================================================
            SECTION 1: AUTHORED BY CATALINA (Rich Card Grid)
            ===================================================================== */}
        <section id="section-authored" className="scroll-mt-32 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-widest text-[#5F6368]">
                <BookMarked className="w-3.5 h-3.5 text-[#0B0B0C]" />
                <span>Primary Corpus</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-normal text-[#0B0B0C]">
                Authored by Catalina
              </h2>
              <p className="text-xs text-[#5F6368] font-sans">
                Original manuscript chapters, Substack essays, OCR scans, and works authored by Catalina Butnaru.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <span className="text-xs font-mono text-[#5F6368]">
                {authoredSources.length} {authoredSources.length === 1 ? 'Work' : 'Works'}
              </span>
              {isStudioAdmin && onOpenAddSource && (
                <button
                  type="button"
                  onClick={() => onOpenAddSource('authored')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Authored Work</span>
                </button>
              )}
            </div>
          </div>

          {authoredSources.length === 0 ? (
            <div className="text-center py-14 bg-[#F8F9FA] rounded-3xl p-6 space-y-3">
              <p className="text-sm font-display font-medium text-[#0B0B0C]">
                No authored works match your current search filter
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                }}
                className="px-4 py-2 rounded-full bg-[#C83E0B] text-white text-xs font-medium cursor-pointer"
              >
                Reset search &amp; filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authoredSources.map((source) => {
                const config = TYPE_CONFIG[source.type] || TYPE_CONFIG.article;
                const IconComponent = config.icon;
                const cardImages = getSourceImages(source);
                const primaryImage = cardImages[0];
                const safeExternalUrl = sanitizeExternalUrl(source.externalUrl);

                return (
                  <div
                    key={source.id}
                    className="rounded-3xl bg-[#F8F9FA] hover:bg-[#F1F3F4] transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-6 space-y-4">
                      {/* Top type & privacy tags */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${config.bg} ${config.color}`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                          {config.label}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {source.isProtected && (
                            <span
                              title="Protected Source: Full text preserved in local vector index"
                              className="inline-flex items-center text-[10px] font-mono font-medium text-[#5F6368] bg-[#E8EAED] px-2 py-0.5 rounded-full"
                            >
                              <Lock className="w-2.5 h-2.5 mr-1" />
                              Protected
                            </span>
                          )}
                          {source.ocrData && (
                            <span className="inline-flex items-center text-[10px] font-mono font-medium text-[#0B0B0C] bg-[#E8EAED] px-2 py-0.5 rounded-full">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />
                              OCR Verified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visible to everyone, protected from download/drag/modification */}
                      {primaryImage && (
                        <div className="space-y-2">
                          <div
                            onClick={() => onOpenSourceDetail(source)}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                            className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-[#FFFFFF] cursor-pointer relative group/img select-none flex items-center justify-center"
                          >
                            <img
                              src={primaryImage}
                              alt={source.title}
                              draggable={false}
                              onContextMenu={(e) => e.preventDefault()}
                              onDragStart={(e) => e.preventDefault()}
                              className="w-full h-full object-contain bg-[#FFFFFF] group-hover/img:scale-[1.02] transition-transform duration-300 protected-archive-image"
                            />
                            {/* Transparent non-downloadable shield */}
                            <div
                              className="absolute inset-0 z-10 protected-image-shield"
                              onContextMenu={(e) => e.preventDefault()}
                              onDragStart={(e) => e.preventDefault()}
                            />
                            {cardImages.length > 1 && (
                              <span className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded-md bg-[#0B0B0C]/85 text-white text-[10px] font-mono pointer-events-none">
                                {cardImages.length} pictures
                              </span>
                            )}
                            {isStudioAdmin && onRemovePictureFromSource && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemovePictureFromSource(source, 0);
                                }}
                                className="absolute top-2.5 right-2.5 z-30 px-2.5 py-1 rounded-full bg-[#0B0B0C]/85 hover:bg-[#C83E0B] text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                title="Remove cover picture from this card"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Picture</span>
                              </button>
                            )}
                            <div className="absolute inset-0 z-20 bg-[#0B0B0C]/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="text-xs text-white bg-[#0B0B0C]/90 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium">
                                <Eye className="w-3.5 h-3.5" />
                                {source.type === 'article' ? 'View Card & Article' : 'View Picture & Details'}
                              </span>
                            </div>
                          </div>

                          {cardImages.length > 1 && (
                            <div
                              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 select-none"
                              onContextMenu={(e) => e.preventDefault()}
                              onDragStart={(e) => e.preventDefault()}
                            >
                              {cardImages.map((imgUrl, picIdx) => (
                                <div
                                  key={picIdx}
                                  onClick={() => onOpenSourceDetail(source)}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                  className="w-12 h-12 rounded-lg overflow-hidden bg-[#FFFFFF] shrink-0 cursor-pointer relative"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`${source.title} (${picIdx + 1})`}
                                    draggable={false}
                                    onContextMenu={(e) => e.preventDefault()}
                                    onDragStart={(e) => e.preventDefault()}
                                    className="w-full h-full object-cover protected-archive-image"
                                  />
                                  <div
                                    className="absolute inset-0 z-10 protected-image-shield"
                                    onContextMenu={(e) => e.preventDefault()}
                                    onDragStart={(e) => e.preventDefault()}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Title & Reference */}
                      <div>
                        <h3
                          onClick={() => onOpenSourceDetail(source)}
                          className="font-display font-medium text-[#0B0B0C] text-base leading-snug cursor-pointer hover:text-[#5F6368] transition-colors"
                        >
                          {source.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#5F6368] mt-1 font-mono flex-wrap">
                          {source.author && <span>{source.author}</span>}
                          {source.year && <span>({source.year})</span>}
                          {source.reference && <span>• {source.reference}</span>}
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-[#5F6368] line-clamp-3 leading-relaxed font-sans">
                        {source.summary}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {source.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#E8EAED] text-[#5F6368]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="p-4 bg-[#F1F3F4] space-y-2.5 text-xs">
                      {/* Author/Admin Studio Management Bar (Google AI Studio Only) */}
                      {isStudioAdmin && (
                        <div className="flex items-center justify-between gap-1.5 pb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {onEditSource && (
                              <button
                                type="button"
                                onClick={() => onEditSource(source)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFFFFF] hover:bg-[#E8EAED] text-[#0B0B0C] text-[11px] font-medium transition-colors cursor-pointer"
                                title="Edit Card Title, Passages, Author & All Fields"
                              >
                                <Pencil className="w-3 h-3 text-[#0B0B0C]" />
                                <span>Edit Card</span>
                              </button>
                            )}

                            {onAddPicturesToSource && (
                              <label
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFFFFF] hover:bg-[#E8EAED] text-[#0B0B0C] text-[11px] font-medium cursor-pointer transition-colors"
                                title="Add Picture(s) to this Card"
                              >
                                <ImagePlus className="w-3 h-3 text-[#0B0B0C]" />
                                <span>Add Picture</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => handleQuickPictureUpload(source, e)}
                                  className="hidden"
                                />
                              </label>
                            )}

                            {primaryImage && onRemovePictureFromSource && (
                              <button
                                type="button"
                                onClick={() => onRemovePictureFromSource(source)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFFFFF] hover:bg-[#E8EAED] text-[#5F6368] hover:text-[#0B0B0C] text-[11px] font-medium transition-colors cursor-pointer"
                                title="Remove Picture from Card"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Picture</span>
                              </button>
                            )}
                          </div>

                          {onDeleteSource && (
                            <button
                              type="button"
                              onClick={() => onDeleteSource(source.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED] text-[11px] transition-colors cursor-pointer"
                              title="Delete Card from Archive"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reader & Inspection Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenSourceDetail(source)}
                            className="text-[#5F6368] hover:text-[#0B0B0C] font-medium flex items-center gap-1 cursor-pointer"
                            title="View complete source details & excerpts"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          <button
                            onClick={() => handleCopyCitation(source)}
                            className="text-[#5F6368] hover:text-[#0B0B0C] p-1 cursor-pointer"
                            title="Copy Citation"
                          >
                            {copiedCitationId === source.id ? (
                              <Check className="w-3.5 h-3.5 text-[#0B0B0C]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {safeExternalUrl && (
                            <a
                              href={safeExternalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-[11px] font-medium transition-all"
                              title="Open publication link"
                            >
                              <span>
                                {safeExternalUrl.includes('substack.com')
                                  ? 'Read on Substack'
                                  : 'View Link'}
                              </span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            onClick={() => onAskAboutSourceInStudio(source)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-[11px] font-medium transition-colors cursor-pointer"
                            title="Ask questions about this reference in the conversational window"
                          >
                            <span>Ask Manuscript</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* =====================================================================
            SECTION 2: LITERATURE, REFERENCES AND QUOTATIONS (Compressed Citation List)
            ===================================================================== */}
        <section id="section-references" className="scroll-mt-32 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-widest text-[#5F6368]">
                <Quote className="w-3.5 h-3.5 text-[#0B0B0C]" />
                <span>Bibliographic &amp; Citation Index</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-normal text-[#0B0B0C]">
                Literature, References and Quotations
              </h2>
              <p className="text-xs text-[#5F6368] font-sans">
                Compressed scholarly list of external books, research citations, and curated quotations.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
              <span className="text-xs font-mono text-[#5F6368]">
                {referenceSources.length} {referenceSources.length === 1 ? 'Citation' : 'Citations'}
              </span>
              {isStudioAdmin && onPublishToPublic && (
                <button
                  type="button"
                  onClick={() => onPublishToPublic()}
                  disabled={syncStatus === 'syncing'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#0B0B0C] text-xs font-medium transition-colors cursor-pointer"
                  title="Sync all citations and photos to the public app"
                >
                  {syncStatus === 'syncing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0B0B0C]" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-[#0B0B0C]" />
                  )}
                  <span>Sync Citations to Public</span>
                </button>
              )}
              {isStudioAdmin && onOpenAddSource && (
                <button
                  type="button"
                  onClick={() => onOpenAddSource('references')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Reference / Quotation</span>
                </button>
              )}
            </div>
          </div>

          {referenceSources.length === 0 ? (
            <div className="bg-[#F8F9FA] rounded-3xl p-8 sm:p-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#E8EAED] text-[#0B0B0C] flex items-center justify-center mx-auto">
                <Quote className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-display font-medium text-[#0B0B0C] text-base">
                  No literature, references, or quotations added yet
                </h3>
                <p className="text-xs text-[#5F6368] leading-relaxed font-sans">
                  Curated external books, research papers, and scholarly quotations appear here in a compact citation format and are indexed for the manuscript Q&amp;A.
                </p>
              </div>
              {isStudioAdmin && onOpenAddSource && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAddSource('references')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Reference or Quotation</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#F8F9FA] rounded-3xl overflow-hidden space-y-1 p-2">
              {referenceSources.map((source, index) => {
                const citation = formatCitation(source);
                const refImages = getSourceImages(source);
                const safeExternalUrl = sanitizeExternalUrl(source.externalUrl);

                return (
                  <div
                    key={source.id}
                    className="px-4 py-3.5 sm:px-6 sm:py-4 rounded-2xl hover:bg-[#F1F3F4] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="font-mono text-xs font-medium text-[#5F6368] pt-0.5 shrink-0">
                        [{String(index + 1).padStart(2, '0')}]
                      </span>

                      {refImages.length > 0 && (
                        <div
                          onClick={() => onOpenSourceDetail(source)}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-16 h-16 rounded-xl overflow-hidden bg-[#FFFFFF] shrink-0 cursor-pointer relative group/refimg select-none"
                          title="Click to inspect attached picture"
                        >
                          <img
                            src={refImages[0]}
                            alt={source.title}
                            draggable={false}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                            className="w-full h-full object-cover group-hover/refimg:scale-105 transition-transform protected-archive-image"
                          />
                          <div
                            className="absolute inset-0 z-10 protected-image-shield"
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                          />
                          {refImages.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 z-20 px-1 rounded bg-[#0B0B0C]/80 text-white text-[9px] font-mono pointer-events-none">
                              +{refImages.length - 1}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span
                            onClick={() => onOpenSourceDetail(source)}
                            className="font-display text-sm font-medium text-[#0B0B0C] hover:text-[#5F6368] cursor-pointer transition-colors"
                          >
                            {citation}
                          </span>
                          {source.tags.length > 0 && (
                            <span className="text-[11px] font-mono text-[#5F6368]">
                              {source.tags.map((t) => `#${t}`).join(' · ')}
                            </span>
                          )}
                        </div>

                        {source.summary && (
                          <p className="text-xs text-[#5F6368] line-clamp-2 italic font-sans">
                            &ldquo;{source.summary}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Compact inline actions */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end lg:self-center text-xs">
                      <button
                        onClick={() => onOpenSourceDetail(source)}
                        className="px-3 py-1 rounded-full bg-[#E8EAED] text-[#202124] hover:text-[#0B0B0C] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Inspect quotation or reference details"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => handleCopyCitation(source)}
                        className="px-3 py-1 rounded-full bg-[#E8EAED] text-[#202124] hover:text-[#0B0B0C] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Copy Citation"
                      >
                        {copiedCitationId === source.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#0B0B0C]" />
                            <span className="text-[#0B0B0C]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#5F6368]" />
                            <span>Cite</span>
                          </>
                        )}
                      </button>

                      {safeExternalUrl && (
                        <a
                          href={safeExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white transition-colors flex items-center gap-1 font-medium"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <button
                        onClick={() => onAskAboutSourceInStudio(source)}
                        className="px-3 py-1 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ask Manuscript</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>

                      {/* Author/Admin Studio Controls on every Quotation & Reference Card */}
                      {isStudioAdmin && onEditSource && (
                        <button
                          type="button"
                          onClick={() => onEditSource(source)}
                          className="px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#0B0B0C] hover:bg-[#E8EAED] transition-colors flex items-center gap-1 font-medium cursor-pointer"
                          title="Edit Quotation, Title, Passages, Author & Fields"
                        >
                          <Pencil className="w-3 h-3 text-[#0B0B0C]" />
                          <span>Edit</span>
                        </button>
                      )}

                      {isStudioAdmin && onAddPicturesToSource && (
                        <label
                          className="px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#0B0B0C] hover:bg-[#E8EAED] transition-colors flex items-center gap-1 font-medium cursor-pointer"
                          title="Add Picture(s) to this Quotation / Reference Card"
                        >
                          <ImagePlus className="w-3 h-3 text-[#0B0B0C]" />
                          <span>Picture</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleQuickPictureUpload(source, e)}
                            className="hidden"
                          />
                        </label>
                      )}

                      {isStudioAdmin && onDeleteSource && (
                        <button
                          type="button"
                          onClick={() => onDeleteSource(source.id)}
                          className="px-2 py-1 rounded-full bg-[#FFFFFF] text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED] transition-colors flex items-center cursor-pointer"
                          title="Delete Card from Archive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
