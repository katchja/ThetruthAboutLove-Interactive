import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  BookOpen, 
  RotateCcw, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { BookMetadata } from '../types';
import { defaultBookMetadata } from '../data/seedData';

interface BookSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookMetadata;
  onSaveMetadata: (data: BookMetadata) => void;
  onResetToDefault: () => void;
}

export const BookSettingsModal: React.FC<BookSettingsModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onSaveMetadata,
  onResetToDefault,
}) => {
  const [title, setTitle] = useState(metadata.title);
  const [subtitle, setSubtitle] = useState(metadata.subtitle);
  const [author, setAuthor] = useState(metadata.author);
  const [authorRole, setAuthorRole] = useState(metadata.authorRole);
  const [authorBio, setAuthorBio] = useState(metadata.authorBio);
  const [publisher, setPublisher] = useState(metadata.publisher || '');
  const [publicationYear, setPublicationYear] = useState(metadata.publicationYear);
  const [isbn, setIsbn] = useState(metadata.isbn || '');
  const [purchaseUrl, setPurchaseUrl] = useState(metadata.purchaseUrl || '');
  const [description, setDescription] = useState(metadata.description);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveMetadata({
      title: title.trim(),
      subtitle: subtitle.trim(),
      author: author.trim(),
      authorRole: authorRole.trim(),
      authorBio: authorBio.trim(),
      publisher: publisher.trim(),
      publicationYear: publicationYear.trim(),
      isbn: isbn.trim(),
      purchaseUrl: purchaseUrl.trim(),
      description: description.trim(),
      coverAccent: metadata.coverAccent || 'amber',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE1D9] flex items-center justify-between bg-[#FAF6F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FCECEF] text-[#C85A6E] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif-book font-bold text-[#241B1C]">
                Book Archive Settings
              </h2>
              <p className="text-xs text-[#8C7A7D]">
                Configure publication details, author credentials, and buy links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F3EBE3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#443236] mb-1">
              Book Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#443236] mb-1">
              Subtitle / Thesis Tagline
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#443236] mb-1">
                Author Name *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#443236] mb-1">
                Author Role / Affiliation
              </label>
              <input
                type="text"
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#443236] mb-1">
              Book Abstract & Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E] resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-[#443236] mb-1">
                Publisher
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#443236] mb-1">
                Year
              </label>
              <input
                type="text"
                value={publicationYear}
                onChange={(e) => setPublicationYear(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#443236] mb-1">
                ISBN
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#443236] mb-1">
              Reader Purchase / External Book Link
            </label>
            <input
              type="url"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://books.google.com/... or https://amazon.com/..."
              className="w-full px-3 py-2 rounded-lg border border-[#E0D4CB] bg-[#FAF7F2] text-[#2A2022] focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset book details to original default edition?')) {
                  onResetToDefault();
                  onClose();
                }
              }}
              className="text-[11px] text-[#8C7A7D] hover:text-[#C85A6E] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Default Edition</span>
            </button>
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
            className="px-5 py-2 rounded-xl bg-[#C85A6E] hover:bg-[#B34B5E] text-white text-xs font-medium shadow-sm transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
