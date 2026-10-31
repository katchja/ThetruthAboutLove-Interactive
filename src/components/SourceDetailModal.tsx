import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Trash2,
  MessageSquare,
  Copy,
  Check,
  ZoomIn,
  Pencil,
  ImagePlus,
} from 'lucide-react';
import { Source, getSourceImages } from '../types';

interface SourceDetailModalProps {
  source: Source | null;
  onClose: () => void;
  onAskAboutSource: (source: Source) => void;
  onDeleteSource?: (id: string) => void;
  onEditSource?: (source: Source) => void;
  onAddPicturesToSource?: (source: Source, dataUrls: string[]) => Promise<void> | void;
  isStudioAdmin?: boolean;
}

export const SourceDetailModal: React.FC<SourceDetailModalProps> = ({
  source,
  onClose,
  onAskAboutSource,
  onDeleteSource,
  onEditSource,
  onAddPicturesToSource,
  isStudioAdmin = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'ocr' | 'raw'>('summary');
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  useEffect(() => {
    setSelectedImageIdx(0);
    setActiveTab('summary');
    setIsImageZoomed(false);
  }, [source?.id]);

  if (!source) return null;

  const allImages = getSourceImages(source);
  const activeImage = allImages[selectedImageIdx] || allImages[0] || source.imageUrl;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickAddPictures = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            reader.readAsDataURL(file);
          })
      );

    Promise.all(readers).then((dataUrls) => {
      const valid = dataUrls.filter(Boolean);
      if (valid.length > 0) {
        onAddPicturesToSource(source, valid);
      }
    });

    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFCFA] border border-[#EAE1D9] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#EAE1D9] flex items-start justify-between gap-4 bg-[#FAF6F0]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FCECEF] text-[#9E3E50] border border-[#F3CBD2]">
                {source.type.toUpperCase()}
              </span>
              {source.reference && (
                <span className="text-xs text-[#8C7A7D] font-mono">
                  {source.reference}
                </span>
              )}
              {source.isProtected && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#8C7A7D] bg-[#F5EFEB] px-2 py-0.5 rounded border border-[#EAE1D9]">
                  <ShieldCheck className="w-3 h-3 text-[#C85A6E]" />
                  Protected Corpus (Local Embeddings Only)
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-serif-book font-bold text-[#241B1C] leading-snug">
              {source.title}
            </h2>
            {source.author && (
              <p className="text-xs text-[#8C7A7D] mt-0.5">
                Authored by {source.author} {source.year ? `(${source.year})` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isStudioAdmin && onAddPicturesToSource && (
              <label
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:border-[#FF2A6D] text-[#241B1C] text-xs font-medium cursor-pointer transition-colors"
                title="Add Picture(s) to this Card"
              >
                <ImagePlus className="w-3.5 h-3.5 text-[#FF2A6D]" />
                <span className="hidden sm:inline">Add Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleQuickAddPictures}
                  className="hidden"
                />
              </label>
            )}

            {isStudioAdmin && onEditSource && (
              <button
                type="button"
                onClick={() => onEditSource(source)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:border-[#FF2A6D] text-[#241B1C] text-xs font-medium transition-colors"
                title="Edit Card Title, Passages, Author & Fields"
              >
                <Pencil className="w-3.5 h-3.5 text-[#FF2A6D]" />
                <span className="hidden sm:inline">Edit Card</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F5EFEB] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center px-6 border-b border-[#EAE1D9] bg-[#FAF6F0]/60 text-xs font-medium text-[#7D6B6E]">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-[#C85A6E] text-[#C85A6E] font-semibold'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            Overview &amp; Summary
          </button>
          {allImages.length > 0 && (
            <button
              onClick={() => setActiveTab('ocr')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'ocr'
                  ? 'border-[#C85A6E] text-[#C85A6E] font-semibold'
                  : 'border-transparent hover:text-[#241B1C]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pictures &amp; Transcription ({allImages.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'raw'
                ? 'border-[#C85A6E] text-[#C85A6E] font-semibold'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            Indexed Content Passages
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {/* Summary Card */}
              <div>
                <h3 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider mb-2">
                  Vetted Summary &amp; Core Takeaway
                </h3>
                <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] text-[#2A2022] text-sm leading-relaxed">
                  {source.summary}
                </div>
              </div>

              {/* Attached Pictures & Thumbnails */}
              {allImages.length > 0 && activeImage && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider">
                      {source.type === 'article'
                        ? 'Official Substack Promotion Card'
                        : allImages.length > 1
                        ? `Attached Pictures & Scans (${allImages.length})`
                        : 'Archival Manuscript / Picture Preview'}
                    </h3>
                    <button
                      onClick={() => setActiveTab('ocr')}
                      className="text-xs text-[#FF2A6D] hover:underline flex items-center gap-1 font-medium"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      View High-Res &amp; Transcription
                    </button>
                  </div>

                  <div
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    className="relative rounded-xl overflow-hidden border border-[#EAE1D9] bg-[#FAF6F0] max-h-[460px] flex items-center justify-center p-2 select-none"
                  >
                    <img
                      src={activeImage}
                      alt={source.title}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      className="max-h-[440px] object-contain rounded-lg shadow-sm protected-archive-image"
                    />
                    <div
                      className="absolute inset-0 z-10 protected-image-shield"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </div>

                  {allImages.length > 1 && (
                    <div
                      className="flex items-center gap-2 overflow-x-auto pb-1 select-none"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      {allImages.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedImageIdx(idx)}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            selectedImageIdx === idx
                              ? 'border-[#FF2A6D] ring-2 ring-[#FF2A6D]/25'
                              : 'border-[#EAE1D9] opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`${source.title} thumbnail ${idx + 1}`}
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
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider mb-2">
                  Semantic Indexing Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {source.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-lg bg-[#F5EFEB] text-[#7D6B6E] text-xs"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* External Link Section */}
              {source.externalUrl && (
                <div className="p-4 rounded-xl border border-[#EAE1D9] bg-[#FAF6F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-[#241B1C]">
                      {source.externalUrl.includes('substack.com')
                        ? 'Published on The Truth About Love Substack'
                        : source.type === 'book'
                        ? 'External Book Reference'
                        : 'External Publication Source'}
                    </h4>
                    <p className="text-xs text-[#8C7A7D] mt-0.5">
                      {source.externalUrl.includes('substack.com')
                        ? 'Read Catalina Butnaru’s full essay, reader discussions, and subscribe on Substack.'
                        : 'Readers can purchase or read the full primary work at the publisher’s portal.'}
                    </p>
                  </div>
                  <a
                    href={source.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold shadow-md shadow-[#FF2A6D]/20 transition-all shrink-0 self-start sm:self-auto"
                  >
                    <span>
                      {source.externalUrl.includes('substack.com')
                        ? 'Read on Substack'
                        : source.type === 'book'
                        ? 'Buy Book'
                        : 'Read Source'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ocr' && allImages.length > 0 && activeImage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Picture / Scan side */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider">
                    Card Picture / Archival Specimen
                  </h4>
                  <span className="text-[11px] font-mono text-[#8C7A7D]">
                    {source.ocrData?.documentType || `Picture ${selectedImageIdx + 1} of ${allImages.length}`}
                  </span>
                </div>
                <div
                  onClick={() => setIsImageZoomed(!isImageZoomed)}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="relative rounded-xl overflow-hidden border border-[#EAE1D9] bg-[#FAF6F0] cursor-zoom-in select-none"
                >
                  <img
                    src={activeImage}
                    alt={source.title}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    className="w-full h-auto object-contain protected-archive-image"
                  />
                  <div
                    className="absolute inset-0 z-10 protected-image-shield"
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                </div>
                {allImages.length > 1 && (
                  <div
                    className="flex items-center gap-2 overflow-x-auto pt-1 select-none"
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {allImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIdx(idx)}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${
                          selectedImageIdx === idx
                            ? 'border-[#FF2A6D]'
                            : 'border-[#EAE1D9] opacity-70'
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Thumbnail ${idx + 1}`}
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
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Transcription side */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#C85A6E]" />
                    Passages &amp; Transcription
                  </h4>
                  <button
                    onClick={() => handleCopy(source.ocrData?.rawTranscription || source.content)}
                    className="text-xs text-[#8C7A7D] hover:text-[#241B1C] flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] text-xs font-mono whitespace-pre-wrap text-[#4D3D40] max-h-80 overflow-y-auto leading-relaxed">
                  {source.ocrData?.rawTranscription || source.content}
                </div>
                {source.ocrData?.detectedPage && (
                  <p className="text-[11px] text-[#8C7A7D] font-mono">
                    Detected Page: #{source.ocrData.detectedPage}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#8C7A7D] uppercase tracking-wider">
                    Full Text Feeding Local Vector Archive
                  </h3>
                  <p className="text-xs text-[#8C7A7D]">
                    This text is parsed into 256-dimensional subword vectors in the browser.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(source.content)}
                  className="text-xs text-[#8C7A7D] hover:text-[#241B1C] flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] font-serif-book text-[#2A2022] text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {source.content}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE1D9] bg-[#FAF6F0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isStudioAdmin && onDeleteSource && (
              <button
                type="button"
                onClick={() => {
                  onDeleteSource(source.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C85A6E] hover:text-[#9E3E50] hover:bg-[#FCECEF] rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete from Archive
              </button>
            )}
            {isStudioAdmin && onEditSource && (
              <button
                type="button"
                onClick={() => onEditSource(source)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#241B1C] hover:text-[#FF2A6D] hover:bg-[#F5EFEB] rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[#FF2A6D]" />
                Edit All Fields &amp; Passages
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7D6B6E] hover:text-[#241B1C] rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onAskAboutSource(source);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold shadow-md shadow-[#FF2A6D]/25 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Manuscript About This
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
