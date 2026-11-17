import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Upload,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Plus,
  Loader2,
  ShieldCheck,
  BookMarked,
  Quote,
  FileText,
  FileCode,
  Layers,
  Check,
} from 'lucide-react';
import {
  Source,
  SourceType,
  ArchiveSection,
  getSourceSection,
  getSourceImages,
} from '../types';
import { getStudioAdminHeaders } from '../utils/security';
import { readUploadedImageFileAsDataUrl } from '../utils/imagePipeline';

interface EditSourceModalProps {
  source: Source | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSource: (updatedSource: Source) => Promise<void>;
  onDeleteSource?: (id: string) => Promise<void> | void;
}

const SOURCE_TYPES: { id: SourceType; label: string; icon: React.ElementType }[] = [
  { id: 'chapter', label: 'Book Chapter', icon: BookMarked },
  { id: 'article', label: 'Substack Article', icon: FileText },
  { id: 'scan', label: 'Archival Scan / OCR', icon: ImageIcon },
  { id: 'note', label: 'Author Note', icon: FileCode },
  { id: 'citation', label: 'Citation / Quotation', icon: Quote },
  { id: 'book', label: 'External Book', icon: Layers },
];

export const EditSourceModal: React.FC<EditSourceModalProps> = ({
  source,
  isOpen,
  onClose,
  onSaveSource,
  onDeleteSource,
}) => {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState<ArchiveSection>('authored');
  const [type, setType] = useState<SourceType>('chapter');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [reference, setReference] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isProtected, setIsProtected] = useState(true);

  // Pictures state
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [isLoadingOCR, setIsLoadingOCR] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);

  // OCR metadata state
  const [ocrTranscription, setOcrTranscription] = useState('');
  const [ocrDetectedPage, setOcrDetectedPage] = useState('');
  const [ocrDocumentType, setOcrDocumentType] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (source && isOpen) {
      setTitle(source.title || '');
      setSection(getSourceSection(source));
      setType(source.type || 'chapter');
      setAuthor(source.author || '');
      setYear(source.year || '');
      setReference(source.reference || '');
      setExternalUrl(source.externalUrl || '');
      setSummary(source.summary || '');
      setContent(source.content || '');
      setTagsInput((source.tags || []).join(', '));
      setIsProtected(source.isProtected ?? true);
      setImages(getSourceImages(source));
      setNewImageUrlInput('');
      setOcrTranscription(source.ocrData?.rawTranscription || '');
      setOcrDetectedPage(source.ocrData?.detectedPage || '');
      setOcrDocumentType(source.ocrData?.documentType || '');
      setConfirmDelete(false);
    }
  }, [source, isOpen]);

  if (!isOpen || !source) return null;

  const isLikelyImageFile = (file: File) =>
    file.type.startsWith('image/') ||
    /\.(avif|heic|heif|webp|png|jpe?g|gif|bmp|svg)$/i.test(file.name);

  // Default behavior: replace primary cover (images[0]) so superseded cover is purged on Save
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected = Array.from(files).filter(isLikelyImageFile);
    e.target.value = '';
    if (selected.length === 0) return;

    setIsDecodingImage(true);
    try {
      const decoded: string[] = [];
      for (const file of selected) {
        const dataUrl = await readUploadedImageFileAsDataUrl(file);
        if (dataUrl && !decoded.includes(dataUrl)) {
          decoded.push(dataUrl);
        }
      }
      if (decoded.length > 0) {
        setImages((prev) => {
          const rest = prev.slice(1).filter((u) => !decoded.includes(u));
          return [...decoded, ...rest];
        });
      }
    } catch (err) {
      console.warn('Cover decode warning:', err);
    } finally {
      setIsDecodingImage(false);
    }
  };

  // Secondary option: append supplemental archival scan without overwriting cover
  const handleSupplementalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected = Array.from(files).filter(isLikelyImageFile);
    e.target.value = '';
    if (selected.length === 0) return;

    setIsDecodingImage(true);
    try {
      const decoded: string[] = [];
      for (const file of selected) {
        const dataUrl = await readUploadedImageFileAsDataUrl(file);
        if (dataUrl && !decoded.includes(dataUrl)) {
          decoded.push(dataUrl);
        }
      }
      if (decoded.length > 0) {
        setImages((prev) => {
          const merged = [...prev];
          for (const d of decoded) {
            if (!merged.includes(d)) merged.push(d);
          }
          return merged;
        });
      }
    } catch (err) {
      console.warn('Supplemental scan decode warning:', err);
    } finally {
      setIsDecodingImage(false);
    }
  };

  const handleSetCoverUrl = () => {
    const trimmed = newImageUrlInput.trim();
    if (!trimmed) return;
    setImages((prev) => [trimmed, ...prev.slice(1).filter((u) => u !== trimmed)]);
    setNewImageUrlInput('');
  };

  const handleAppendImageUrl = () => {
    const trimmed = newImageUrlInput.trim();
    if (!trimmed) return;
    setImages((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewImageUrlInput('');
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReplaceImageFile = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isLikelyImageFile(file)) return;

    setIsDecodingImage(true);
    try {
      const dataUrl = await readUploadedImageFileAsDataUrl(file);
      if (dataUrl) {
        setImages((prev) => prev.map((img, i) => (i === index ? dataUrl : img)));
      }
    } catch (err) {
      console.warn('Replace picture decode warning:', err);
    } finally {
      setIsDecodingImage(false);
    }
  };

  const handleMakePrimaryImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      return [selected, ...copy];
    });
  };

  const handleRunOCROnPrimary = async () => {
    const primaryImage = images[0];
    if (!primaryImage) return;

    setIsLoadingOCR(true);
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: getStudioAdminHeaders(),
        body: JSON.stringify({
          imageBase64: primaryImage,
          mimeType: 'image/jpeg',
          filename: title || 'Archival_Image.jpg',
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.data) {
          const data = json.data;
          if (data.transcription) {
            setOcrTranscription(data.transcription);
            if (!content.trim()) {
              setContent(data.transcription);
            }
          }
          if (data.estimatedPageNumber) {
            setOcrDetectedPage(data.estimatedPageNumber);
          }
          if (data.documentType) {
            setOcrDocumentType(data.documentType);
          }
        }
      }
    } catch (err) {
      console.warn('OCR extraction warning:', err);
    } finally {
      setIsLoadingOCR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const effectiveContent =
      content.trim() ||
      summary.trim() ||
      [author.trim(), year.trim(), title.trim(), reference.trim(), externalUrl.trim()]
        .filter(Boolean)
        .join(' — ') ||
      title.trim();

    setIsSaving(true);
    try {
      // Auto-commit any pasted URL in newImageUrlInput as the cover if Save was clicked directly
      const pendingUrl = newImageUrlInput.trim();
      const effectiveImages = pendingUrl
        ? [pendingUrl, ...images.slice(1).filter((u) => u !== pendingUrl)]
        : images;

      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const hasOcr =
        Boolean(ocrTranscription.trim()) ||
        Boolean(ocrDetectedPage.trim()) ||
        Boolean(ocrDocumentType.trim()) ||
        Boolean(source.ocrData);

      const resolvedSection: ArchiveSection =
        type === 'citation' || type === 'book' ? 'references' : section;

      const updatedSource: Source = {
        ...source,
        title: title.trim(),
        section: resolvedSection,
        type,
        author: author.trim() || undefined,
        year: year.trim() || undefined,
        reference: reference.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        summary:
          summary.trim() ||
          (effectiveContent.length > 180
            ? effectiveContent.substring(0, 180) + '...'
            : effectiveContent),
        content: effectiveContent,
        tags: parsedTags.length > 0 ? parsedTags : ['Catalina Butnaru'],
        isProtected,
        imageUrl: effectiveImages[0] || undefined,
        images: effectiveImages.length > 0 ? effectiveImages : undefined,
        ocrData: hasOcr
          ? {
              rawTranscription:
                ocrTranscription.trim() ||
                source.ocrData?.rawTranscription ||
                effectiveContent,
              detectedPage: ocrDetectedPage.trim() || undefined,
              documentType: ocrDocumentType.trim() || undefined,
              confidence: source.ocrData?.confidence || 0.95,
            }
          : undefined,
      };

      await onSaveSource(updatedSource);
      setNewImageUrlInput('');
      onClose();
    } catch (err) {
      console.error('Failed to save edited source:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#EAE1D9] flex items-center justify-between bg-[#FAF6F0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#FDF2EE] text-[#C83E0B] border border-[#F5D5C8]">
                Author &amp; Admin Studio Editor
              </span>
            </div>
            <h2 className="text-lg font-serif-book font-bold text-[#241B1C] mt-1">
              Edit Archive Card &amp; Passages
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F3EBE3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* 1. Archive Section & Card Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#635154] mb-1.5">
                Archive Section
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSection('authored')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                    section === 'authored'
                      ? 'bg-[#FDF2EE] border-[#C83E0B] text-[#241B1C] font-semibold shadow-2xs'
                      : 'bg-[#FAF7F2] border-[#EAE1D9] text-[#635154] hover:border-[#C83E0B]/50'
                  }`}
                >
                  <BookMarked className="w-4 h-4 text-[#C83E0B] shrink-0" />
                  <span className="text-xs truncate">Authored by Catalina</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSection('references')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                    section === 'references'
                      ? 'bg-[#FDF2EE] border-[#C83E0B] text-[#241B1C] font-semibold shadow-2xs'
                      : 'bg-[#FAF7F2] border-[#EAE1D9] text-[#635154] hover:border-[#C83E0B]/50'
                  }`}
                >
                  <Quote className="w-4 h-4 text-[#C83E0B] shrink-0" />
                  <span className="text-xs truncate">References &amp; Quotes</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#635154] mb-1.5">
                Card Type
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const nextType = e.target.value as SourceType;
                  setType(nextType);
                  if (nextType === 'citation' || nextType === 'book') {
                    setSection('references');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E0D4CB] bg-[#FAF7F2] text-xs font-medium text-[#241B1C] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Title & Citation Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                Card Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter chapter, essay, scan, or quotation title..."
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                Reference / Chapter / Pages / DOI
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Chapter 3, pp. 45-62 or Substack Essay"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
          </div>

          {/* 3. Author, Year & External Link */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Catalina Butnaru"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                Publication Year
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2025"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                External Link (Substack / Book URL)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
          </div>

          {/* 4. Pictures & Archival Images Manager */}
          <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#241B1C] flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#C83E0B]" />
                  <span>Chapter Cover &amp; Archival Scans ({images.length})</span>
                </h3>
                <p className="text-[11px] text-[#8C7A7D]">
                  Uploading a new cover automatically replaces the primary cover and purges the superseded asset on save (supports JPG, PNG, WebP, AVIF, HEIC).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRunOCROnPrimary}
                    disabled={isLoadingOCR}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#F5D5C8] bg-[#FDF2EE] text-[#C83E0B] hover:bg-[#F7DFD4] text-[11px] font-semibold transition-colors"
                  >
                    {isLoadingOCR ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Running OCR...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Transcribe Cover (OCR)</span>
                      </>
                    )}
                  </button>
                )}

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                  {isDecodingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{images.length > 0 ? 'Replace Cover' : 'Upload Cover'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,image/avif,image/heic,image/heif,.avif,.heic,.heif"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                </label>

                {images.length > 0 && (
                  <label
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:border-[#C83E0B] text-[#241B1C] text-[11px] font-medium cursor-pointer transition-colors"
                    title="Append an additional archival scan without replacing the primary cover"
                  >
                    <Plus className="w-3 h-3 text-[#C83E0B]" />
                    <span>Supplemental Scan</span>
                    <input
                      type="file"
                      accept="image/*,image/avif,image/heic,image/heif,.avif,.heic,.heif"
                      multiple
                      onChange={handleSupplementalUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Set Cover or Add Picture by URL */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newImageUrlInput}
                onChange={(e) => setNewImageUrlInput(e.target.value)}
                placeholder="Or paste an image URL to set as cover..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#E0D4CB] bg-[#FDFCFA] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B]"
              />
              <button
                type="button"
                onClick={handleSetCoverUrl}
                disabled={!newImageUrlInput.trim()}
                className="px-3 py-1.5 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:border-[#C83E0B] text-[#241B1C] disabled:opacity-40 text-xs font-medium flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5 text-[#C83E0B]" />
                <span>Set as Cover</span>
              </button>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={handleAppendImageUrl}
                  disabled={!newImageUrlInput.trim()}
                  className="px-2.5 py-1.5 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:border-[#C83E0B] text-[#635154] disabled:opacity-40 text-xs font-medium flex items-center gap-1"
                  title="Append URL as supplemental scan"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C83E0B]" />
                  <span>Append</span>
                </button>
              )}
            </div>

            {/* Thumbnails gallery */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {images.map((imgSrc, idx) => (
                  <div
                    key={idx}
                    className={`relative group rounded-xl overflow-hidden border bg-[#FDFCFA] aspect-4/3 flex flex-col justify-between ${
                      idx === 0
                        ? 'border-[#C83E0B] ring-2 ring-[#C83E0B]/25'
                        : 'border-[#EAE1D9]'
                    }`}
                  >
                    <img
                      src={imgSrc}
                      alt={`Card picture ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5">
                      {idx === 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#C83E0B] text-white text-[10px] font-semibold shadow-xs">
                          Cover Picture
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMakePrimaryImage(idx)}
                          className="px-2 py-0.5 rounded-md bg-[#241B1C]/80 hover:bg-[#241B1C] text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Make Cover
                        </button>
                      )}
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                      <label
                        className="px-2 py-0.5 rounded-md bg-[#241B1C]/85 hover:bg-[#C83E0B] text-white text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1"
                        title="Replace this picture"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        <span>Replace</span>
                        <input
                          type="file"
                          accept="image/*,image/avif,image/heic,image/heif,.avif,.heic,.heif"
                          onChange={(e) => handleReplaceImageFile(idx, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1 rounded-md bg-[#241B1C]/85 hover:bg-[#C83E0B] text-white transition-colors"
                        title="Remove picture"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Vetted Summary / Quotation */}
          <div>
            <label className="block text-xs font-semibold text-[#443236] mb-1">
              Short Vetted Summary / Key Quotation
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Distilled takeaway or featured quotation displayed on the archive card..."
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] leading-relaxed focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
            />
          </div>

          {/* 6. Full Passages / Manuscript Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#443236]">
                Passages / Full Manuscript Text / Excerpt (Indexed for Vector Q&amp;A) *
              </label>
              <span className="text-[11px] font-mono text-[#8C7A7D]">
                {content.trim() ? content.trim().split(/\s+/).length : 0} words
              </span>
            </div>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter or edit the full passages, quotations, or manuscript text for this card..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0D4CB] bg-[#FAF7F2] text-xs font-serif-book text-[#2A2022] leading-relaxed focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
            />
          </div>

          {/* 7. Optional OCR Transcription Details (if scan or OCR present) */}
          {(type === 'scan' || Boolean(ocrTranscription) || Boolean(source.ocrData)) && (
            <div className="p-4 rounded-xl bg-[#FDF2EE] border border-[#F5D5C8] space-y-3">
              <div className="text-xs font-semibold text-[#A93207] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C83E0B]" />
                <span>OCR Transcription &amp; Specimen Metadata</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#635154] mb-1">
                    Document Specimen Type
                  </label>
                  <input
                    type="text"
                    value={ocrDocumentType}
                    onChange={(e) => setOcrDocumentType(e.target.value)}
                    placeholder="e.g. Handwritten Manuscript Folio"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#E0D4CB] bg-[#FDFCFA] text-xs text-[#2A2022]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#635154] mb-1">
                    Detected Page / Folio Number
                  </label>
                  <input
                    type="text"
                    value={ocrDetectedPage}
                    onChange={(e) => setOcrDetectedPage(e.target.value)}
                    placeholder="e.g. Page 14"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#E0D4CB] bg-[#FDFCFA] text-xs text-[#2A2022]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#635154] mb-1">
                  Raw OCR Transcription
                </label>
                <textarea
                  rows={3}
                  value={ocrTranscription}
                  onChange={(e) => setOcrTranscription(e.target.value)}
                  placeholder="Verbatim OCR transcription..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E0D4CB] bg-[#FDFCFA] text-xs font-mono text-[#2A2022]"
                />
              </div>
            </div>
          )}

          {/* 8. Topic Tags & Protection Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1">
                Topic Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Love as Life Force, Syntropy, Fierce Lovers"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C83E0B] shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-[#241B1C] block">
                    Protect Full Content (Privacy Shield)
                  </span>
                  <span className="text-[11px] text-[#8C7A7D]">
                    Keep full raw text protected in vector index
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="w-4 h-4 rounded text-[#C83E0B] focus:ring-[#C83E0B] border-[#E0D4CB] cursor-pointer accent-[#C83E0B]"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#EAE1D9] bg-[#FAF6F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            {onDeleteSource && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#C83E0B]">
                    Confirm permanent delete?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteSource(source.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-semibold transition-colors"
                  >
                    Yes, Delete Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EAE1D9] text-xs text-[#635154] hover:text-[#241B1C]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#C83E0B] hover:bg-[#FDF2EE] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Card</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7D6B6E] hover:text-[#241B1C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isDecodingImage || !title.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#C83E0B] hover:bg-[#A93207] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#C83E0B]/25 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Auto-Saving to Cloud...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
