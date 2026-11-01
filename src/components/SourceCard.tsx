import React from 'react';
import { 
  BookMarked, 
  FileText, 
  Image as ImageIcon, 
  FileCode, 
  ExternalLink, 
  ShieldCheck, 
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import { Source, SourceType, getSourceImages } from '../types';
import { sanitizeExternalUrl } from '../utils/security';

interface SourceCardProps {
  source: Source;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (source: Source) => void;
}

const TYPE_CONFIG: Record<
  SourceType, 
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  chapter: {
    label: 'Book Chapter',
    color: 'text-[#A93207]',
    bg: 'bg-[#FDF2EE]',
    border: 'border-[#F5D5C8]',
    icon: BookMarked,
  },
  article: {
    label: 'Substack Article',
    color: 'text-[#C83E0B]',
    bg: 'bg-[#FDF2EE]',
    border: 'border-[#F5D5C8]',
    icon: FileText,
  },
  scan: {
    label: 'Archival Scan / OCR',
    color: 'text-[#C83E0B]',
    bg: 'bg-[#FDF2EE]',
    border: 'border-[#F5D5C8]',
    icon: ImageIcon,
  },
  note: {
    label: 'Author Note',
    color: 'text-[#7A4B6E]',
    bg: 'bg-[#FAF2F7]',
    border: 'border-[#EDD4E5]',
    icon: FileCode,
  },
  book: {
    label: 'External Book',
    color: 'text-[#504068]',
    bg: 'bg-[#F4F1F8]',
    border: 'border-[#DDD6E8]',
    icon: BookMarked,
  },
  citation: {
    label: 'Citation',
    color: 'text-[#7D6B6E]',
    bg: 'bg-[#FAF6F0]',
    border: 'border-[#EAE1D9]',
    icon: Layers,
  },
};

export const SourceCard: React.FC<SourceCardProps> = ({
  source,
  isSelected,
  onToggleSelect,
  onClick,
}) => {
  const config = TYPE_CONFIG[source.type] || TYPE_CONFIG.article;
  const IconComponent = config.icon;
  const cardImages = getSourceImages(source);
  const primaryImage = cardImages[0];
  const safeExternalUrl = sanitizeExternalUrl(source.externalUrl);

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 bg-[#FDFCFA] shadow-sm hover:shadow-md ${
        isSelected
          ? 'border-[#C83E0B] ring-1 ring-[#C83E0B]/30'
          : 'border-[#EAE1D9] hover:border-[#D9CFC4]'
      }`}
    >
      <div className="p-3.5">
        {/* Top bar with selection checkbox and type tag */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(source.id)}
              className="w-4 h-4 rounded text-[#C83E0B] focus:ring-[#C83E0B] border-[#E0D4CB] cursor-pointer accent-[#C83E0B]"
            />
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.bg} ${config.color} ${config.border}`}
            >
              <IconComponent className="w-3 h-3" />
              {config.label}
            </span>
          </label>

          <div className="flex items-center gap-1">
            {source.isProtected && (
              <span
                title="Protected Source: Full text indexed in private vector store; readers view citations and summary."
                className="inline-flex items-center text-[10px] font-medium text-[#7D6B6E] bg-[#FAF6F0] px-1.5 py-0.5 rounded border border-[#EAE1D9]"
              >
                <Lock className="w-2.5 h-2.5 mr-0.5 text-[#8C7A7D]" />
                Protected
              </span>
            )}
            {source.ocrData && (
              <span
                title="Automated OCR transcription available"
                className="inline-flex items-center text-[10px] font-medium text-[#C83E0B] bg-[#FDF2EE] px-1.5 py-0.5 rounded border border-[#F5D5C8]"
              >
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                OCR
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail preview if image/scan (visible to everyone, protected from download/drag) */}
        {primaryImage && (
          <div
            onClick={() => onClick(source)}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className={`mb-2.5 w-full ${source.type === 'article' ? 'h-48' : 'h-36'} rounded-lg overflow-hidden bg-[#FAF7F2] border border-[#EAE1D9] cursor-pointer relative group-hover:opacity-95 transition-opacity select-none flex items-center justify-center`}
          >
            <img
              src={primaryImage}
              alt={source.title}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className="w-full h-full object-contain protected-archive-image"
            />
            <div
              className="absolute inset-0 z-10 protected-image-shield"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#241B1C]/75 via-transparent to-transparent flex items-end p-1.5 pointer-events-none">
              <span className="text-[10px] text-[#F5EFEB] font-mono bg-[#241B1C]/80 px-1.5 py-0.5 rounded">
                {source.type === 'article' ? 'Substack Article' : `Archival Picture ${source.ocrData?.detectedPage ? `• P. ${source.ocrData.detectedPage}` : ''}`}
              </span>
            </div>
          </div>
        )}

        {/* Title and metadata */}
        <h4
          onClick={() => onClick(source)}
          className="font-medium text-[#241B1C] text-sm leading-snug line-clamp-2 cursor-pointer hover:text-[#C83E0B] transition-colors"
        >
          {source.title}
        </h4>

        {source.reference && (
          <p className="text-[11px] text-[#8C7A7D] font-mono mt-1 truncate">
            {source.reference} {source.year ? `(${source.year})` : ''}
          </p>
        )}

        {/* Summary excerpt */}
        <p
          onClick={() => onClick(source)}
          className="text-xs text-[#5C4D50] mt-1.5 line-clamp-2 leading-relaxed cursor-pointer"
        >
          {source.summary}
        </p>

        {/* Tags and external link footer */}
        <div className="mt-3 pt-2.5 border-t border-[#EAE1D9] flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1 overflow-hidden">
            {source.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-[#FDF2EE] text-[#A93207] border border-[#F5D5C8] text-[10px] truncate max-w-[85px]"
              >
                #{tag}
              </span>
            ))}
            {source.tags.length > 2 && (
              <span className="text-[10px] text-[#8C7A7D]">+{source.tags.length - 2}</span>
            )}
          </div>

          {safeExternalUrl && (
            <a
              href={safeExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[#C83E0B] hover:text-[#A93207] font-semibold shrink-0"
              title="Open external source or book buy page"
            >
              <span>{source.type === 'book' ? 'Buy / Read' : 'View Link'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
