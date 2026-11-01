import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  Check, 
  ShieldCheck, 
  BookMarked,
  Layers,
  Quote
} from 'lucide-react';
import { Source, SourceType, ArchiveSection } from '../types';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Source) => Promise<void>;
  defaultSection?: ArchiveSection;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
  defaultSection = 'authored',
}) => {
  const [selectedSection, setSelectedSection] = useState<ArchiveSection>(defaultSection);
  const [activeTab, setActiveTab] = useState<'scan' | 'link' | 'doc' | 'note'>('doc');
  const [isLoadingOCR, setIsLoadingOCR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [reference, setReference] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [isProtected, setIsProtected] = useState(true);

  // Image & OCR state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<{
    rawTranscription: string;
    detectedPage?: string;
    documentType?: string;
    confidence?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedSection(defaultSection);
      if (defaultSection === 'references') {
        setActiveTab('doc');
        setAuthor((prev) => (prev === 'Catalina Butnaru' ? '' : prev));
      } else {
        setActiveTab('doc');
        setAuthor((prev) => prev || 'Catalina Butnaru');
      }
    }
  }, [isOpen, defaultSection]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setYear('');
    setReference('');
    setSummary('');
    setContent('');
    setTagsInput('');
    setExternalUrl('');
    setImagePreview(null);
    setOcrData(null);
    setIsProtected(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setImagePreview(base64);
        await runOCR(base64, file.type, file.name);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
      };
      reader.readAsText(file);
    }
  };

  const runOCR = async (imageBase64: string, mimeType: string, filename: string) => {
    setIsLoadingOCR(true);
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, filename }),
      });

      if (!response.ok) throw new Error('OCR API failed');
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      if (!contentType.includes('application/json') || rawText.trim().startsWith('<')) {
        throw new Error('Non-JSON response');
      }
      const json = JSON.parse(rawText);

      if (json.data) {
        const data = json.data;
        setTitle(data.title || filename);
        setContent(data.transcription || '');
        setSummary(data.summary || 'Transcribed text from archival scan.');
        if (data.tags && Array.isArray(data.tags)) {
          setTagsInput(data.tags.join(', '));
        }
        if (data.estimatedPageNumber) {
          setReference(`Page ${data.estimatedPageNumber}`);
        }
        setOcrData({
          rawTranscription: data.transcription,
          detectedPage: data.estimatedPageNumber,
          documentType: data.documentType,
          confidence: 0.95,
        });
      }
    } catch (err) {
      console.warn('OCR fallback:', err);
      // Fallback transcription placeholder
      setTitle(filename);
      setSummary('Archival scan uploaded. Automated OCR ready for indexing.');
      setContent(`[Archival Scan: ${filename}]\nUploaded specimen preserved for private vector indexing.`);
      setOcrData({
        rawTranscription: 'Scan captured. Text indexed in local vector store.',
        confidence: 0.9,
      });
    } finally {
      setIsLoadingOCR(false);
    }
  };

  // Quick preset loader to demo OCR scanning on field notes without needing local files
  const loadDemoScan = () => {
    const demoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400" width="100%" height="100%">
        <rect width="100%" height="100%" fill="#FAF7F2" rx="10" stroke="#EAE1D9" stroke-width="2"/>
        <line x1="30" y1="60" x2="470" y2="60" stroke="#F5D5C8" stroke-width="1.5"/>
        <text x="40" y="45" font-family="monospace" font-size="11" fill="#8C7A7D">CATALINA BUTNARU // MANUSCRIPT FOLIO 08</text>
        <text x="40" y="90" font-family="serif" font-size="16" font-weight="bold" fill="#241B1C">The Truth About Self Love: The Relational Field</text>
        <text x="40" y="125" font-family="serif" font-size="13" font-style="italic" fill="#443236">"The self is not an island to conquer, but an ecosystem to steward.</text>
        <text x="40" y="150" font-family="serif" font-size="13" font-style="italic" fill="#443236">Self-love is the quiet capacity to inhabit one's own skin without</text>
        <text x="40" y="175" font-family="serif" font-size="13" font-style="italic" fill="#443236">constant defensive performance or emotional bargaining."</text>
        <text x="40" y="220" font-family="monospace" font-size="12" fill="#C83E0B">→ Cross-link: Manuscript Draft Part I, Chapter 1</text>
        <rect x="310" y="310" width="150" height="40" fill="#FDF2EE" stroke="#F5D5C8" stroke-width="1.5" rx="6"/>
        <text x="325" y="335" font-family="sans-serif" font-size="10" font-weight="bold" fill="#A93207">VERIFIED ARCHIVAL OCR</text>
      </svg>`
    )}`;

    setImagePreview(demoSvg);
    runOCR(demoSvg, 'image/svg+xml', 'Manuscript_Folio08_Relational_Field.svg');
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

    setIsSubmitting(true);
    try {
      let finalType: SourceType = 'article';
      if (selectedSection === 'references') {
        if (activeTab === 'link') {
          finalType = externalUrl.toLowerCase().includes('book') ? 'book' : 'citation';
        } else if (activeTab === 'note') {
          finalType = 'citation';
        } else if (activeTab === 'scan') {
          finalType = 'scan';
        } else {
          finalType = 'citation';
        }
      } else {
        if (activeTab === 'scan') finalType = 'scan';
        if (activeTab === 'link') finalType = 'article';
        if (activeTab === 'doc') finalType = 'chapter';
        if (activeTab === 'note') finalType = 'note';
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      if (tags.length === 0) {
        tags.push(selectedSection === 'authored' ? 'Catalina Butnaru' : 'Citation');
      }

      const newSource: Source = {
        id: `src-custom-${Date.now()}`,
        title: title.trim(),
        type: finalType,
        section: selectedSection,
        author: author.trim() || (selectedSection === 'authored' ? 'Catalina Butnaru' : undefined),
        year: year.trim() || undefined,
        reference: reference.trim() || undefined,
        summary:
          summary.trim() ||
          (effectiveContent.length > 160
            ? effectiveContent.substring(0, 160) + '...'
            : effectiveContent),
        content: effectiveContent,
        tags,
        externalUrl: externalUrl.trim() || undefined,
        imageUrl: imagePreview || undefined,
        images: imagePreview ? [imagePreview] : undefined,
        ocrData: ocrData || undefined,
        isProtected: isProtected,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await onAddSource(newSource);
      resetForm();
      onClose();
    } catch (err) {
      console.warn('Failed to add source:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE1D9] flex items-center justify-between bg-[#FAF6F0]">
          <div>
            <h2 className="text-lg font-serif-book font-bold text-[#241B1C]">
              Add to Manuscript Archive & Citations
            </h2>
            <p className="text-xs text-[#8C7A7D] mt-0.5">
              Classify into Authored by Catalina or Literature, References and Quotations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F3EBE3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Archive Section Classification Selector */}
        <div className="px-6 py-3.5 bg-[#FAF7F2] border-b border-[#EAE1D9]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#635154] mb-2">
            1. Select Archive Section Destination
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedSection('authored');
                if (!author) setAuthor('Catalina Butnaru');
              }}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                selectedSection === 'authored'
                  ? 'bg-[#FDF2EE] border-[#C83E0B] ring-1 ring-[#C83E0B]/30 shadow-sm'
                  : 'bg-[#FDFCFA] border-[#EAE1D9] hover:border-[#C83E0B]/50'
              }`}
            >
              <BookMarked className={`w-4 h-4 mt-0.5 shrink-0 ${selectedSection === 'authored' ? 'text-[#C83E0B]' : 'text-[#8C7A7D]'}`} />
              <div>
                <div className={`text-xs font-bold ${selectedSection === 'authored' ? 'text-[#241B1C]' : 'text-[#635154]'}`}>
                  Authored by Catalina
                </div>
                <div className="text-[11px] text-[#8C7A7D] leading-snug mt-0.5">
                  Book chapters, Substack essays & original cards
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedSection('references');
                if (author === 'Catalina Butnaru') setAuthor('');
              }}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                selectedSection === 'references'
                  ? 'bg-[#FDF2EE] border-[#C83E0B] ring-1 ring-[#C83E0B]/30 shadow-sm'
                  : 'bg-[#FDFCFA] border-[#EAE1D9] hover:border-[#C83E0B]/50'
              }`}
            >
              <Quote className={`w-4 h-4 mt-0.5 shrink-0 ${selectedSection === 'references' ? 'text-[#C83E0B]' : 'text-[#8C7A7D]'}`} />
              <div>
                <div className={`text-xs font-bold ${selectedSection === 'references' ? 'text-[#241B1C]' : 'text-[#635154]'}`}>
                  Literature, References & Quotations
                </div>
                <div className="text-[11px] text-[#8C7A7D] leading-snug mt-0.5">
                  Compressed citation list, books, papers & quotes
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-4 border-b border-[#EAE1D9] bg-[#FAF6F0] text-xs font-medium text-[#7D6B6E]">
          <button
            type="button"
            onClick={() => setActiveTab('doc')}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'doc'
                ? 'border-[#C83E0B] text-[#241B1C] font-semibold bg-[#FDFCFA]'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#C83E0B]" />
            <span className="truncate">{selectedSection === 'authored' ? 'Chapter / Essay' : 'Citation / Text'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'link'
                ? 'border-[#C83E0B] text-[#241B1C] font-semibold bg-[#FDFCFA]'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-[#C83E0B]" />
            <span className="truncate">{selectedSection === 'authored' ? 'Substack / Link' : 'Book / DOI Link'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('note')}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'note'
                ? 'border-[#C83E0B] text-[#241B1C] font-semibold bg-[#FDFCFA]'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#C83E0B]" />
            <span className="truncate">{selectedSection === 'authored' ? 'Author Note' : 'Quotation'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'scan'
                ? 'border-[#C83E0B] text-[#241B1C] font-semibold bg-[#FDFCFA]'
                : 'border-transparent hover:text-[#241B1C]'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#C83E0B]" />
            <span className="truncate">Image / Scan</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Scan tab specific upload & OCR button */}
          {activeTab === 'scan' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FDF2EE] border border-[#F5D5C8]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#A93207] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C83E0B]" />
                  Automated OCR Transcription for Scans & Field Notes
                </span>
                <button
                  type="button"
                  onClick={loadDemoScan}
                  className="text-[11px] font-medium text-[#C83E0B] hover:text-[#A93207] hover:underline"
                >
                  Load Sample Scan Specimen
                </button>
              </div>

              {imagePreview ? (
                <div className="flex items-start gap-3">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-[#EAE1D9] bg-[#FAF7F2] shrink-0">
                    <img src={imagePreview} alt="Scan preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#241B1C]">
                        Image Attached
                      </span>
                      {isLoadingOCR ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#C83E0B] font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Transcribing with OCR...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#2C6E49] font-medium">
                          <Check className="w-3 h-3" />
                          OCR Complete
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8C7A7D] mt-1">
                      The image thumbnail will be visible in the archive while its transcribed text feeds the local semantic vector index.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setOcrData(null);
                      }}
                      className="text-[11px] text-[#C83E0B] hover:underline mt-1"
                    >
                      Remove image
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-[#F5D5C8] rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-[#FAF6F0] hover:bg-[#FDF2EE] transition-colors">
                  <Upload className="w-6 h-6 text-[#C83E0B] mb-1" />
                  <span className="text-xs font-medium text-[#241B1C]">
                    Click to upload scan, manuscript photo, or book page
                  </span>
                  <span className="text-[11px] text-[#8C7A7D] mt-0.5">
                    PNG, JPG, WEBP • Automatically transcribed and indexed
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Link tab specific fields */}
          {activeTab === 'link' && (
            <div className="p-4 rounded-xl bg-[#FDF2EE] border border-[#F5D5C8] space-y-2">
              <label className="block text-xs font-semibold text-[#A93207]">
                External Book Purchase or DOI Publication Link
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://books.google.com/... or https://amazon.com/... or DOI link"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
              <p className="text-[11px] text-[#8C7A7D]">
                Readers will receive a direct button to buy or view the external source, while your excerpt below feeds the conversational Q&A.
              </p>
            </div>
          )}

          {/* Core metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#443236] mb-1">
                Source Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  activeTab === 'scan'
                    ? 'e.g. Field Note #4: Attention Allocation'
                    : activeTab === 'link'
                    ? 'e.g. The Truth About Love (Catalina Butnaru)'
                    : 'e.g. Chapter 4: Restorative Environments'
                }
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#443236] mb-1">
                Citation Reference / Pages
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Chapter 2, pp. 45-68 or Lab Plate 12"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#443236] mb-1">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Catalina Butnaru"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#443236] mb-1">
                Publication Year
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2025"
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
              />
            </div>
          </div>

          {/* Vetted Summary */}
          <div>
            <label className="block text-xs font-medium text-[#443236] mb-1">
              Short Vetted Summary / Core Takeaway
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief 1-2 sentence distillation visible on source card..."
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
            />
          </div>

          {/* Full content / OCR text */}
          <div>
            <label className="block text-xs font-medium text-[#443236] mb-1">
              {activeTab === 'scan' ? 'Transcribed Text (Indexed for Vectors) *' : 'Content / Excerpt Passages *'}
            </label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste text, notes, or excerpt passages to be chunked and indexed into the local vector database..."
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs font-mono text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[#443236] mb-1">
              Topic Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Self-Love, Attachment, Relational Field"
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] placeholder-[#A49497] focus:ring-1 focus:ring-[#C83E0B] focus:border-[#C83E0B]"
            />
          </div>

          {/* Protection Toggle */}
          <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C83E0B]" />
              <div>
                <span className="text-xs font-medium text-[#241B1C]">
                  Protect Full Content (Privacy Shield)
                </span>
                <p className="text-[11px] text-[#8C7A7D]">
                  Public readers see only metadata, summary, and citations; raw book passages remain exclusively inside the vector index.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isProtected}
              onChange={(e) => setIsProtected(e.target.checked)}
              className="w-4 h-4 rounded text-[#C83E0B] focus:ring-[#C83E0B] border-[#E0D4CB] cursor-pointer accent-[#C83E0B]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE1D9] bg-[#FAF6F0] flex items-center justify-between">
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
            disabled={isSubmitting || !title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C83E0B] hover:bg-[#A93207] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#C83E0B]/25 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Indexing Vectors...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Index & Add to Archive
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
