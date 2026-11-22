import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Flame, CheckCircle2, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { db } from '../firebase';

interface SubscriberWaitlistSectionProps {
  completedDimensionsCount?: number;
  defaultRole?: 'reader' | 'author' | 'investor';
  onSubscribed?: () => void;
  onOpenWhatsAppModal?: () => void;
  accentTheme?: 'default' | 'runa';
}

export const SubscriberWaitlistSection: React.FC<SubscriberWaitlistSectionProps> = ({
  completedDimensionsCount = 0,
  defaultRole = 'reader',
  onSubscribed,
  onOpenWhatsAppModal,
  accentTheme = 'default',
}) => {
  const isRunaTheme = accentTheme === 'runa';
  const [role, setRole] = useState<'reader' | 'author' | 'investor'>(defaultRole);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [publicationUrl, setPublicationUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: name.trim() || undefined,
          whatsappOptIn,
          whatsappPhone: whatsappPhone.trim() || undefined,
          role,
          publicationUrl: publicationUrl.trim() || undefined,
          completedDimensions: Math.min(5, Math.max(0, completedDimensionsCount)),
        }),
      });

      const data = await res.json().catch(() => null);
      const subscriberId =
        data?.subscriber?.subscriberId ||
        `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Also persist to Cloud Firestore archive_subscribers collection
      const firestorePayload: Record<string, unknown> = {
        subscriberId,
        email: cleanEmail,
        whatsappOptIn,
        role,
        completedDimensions: Math.min(5, Math.max(0, completedDimensionsCount)),
        createdAt: serverTimestamp(),
      };
      if (name.trim()) firestorePayload.name = name.trim().slice(0, 120);
      if (whatsappPhone.trim().length >= 5) {
        firestorePayload.whatsappPhone = whatsappPhone.trim().slice(0, 32);
      }
      if (publicationUrl.trim()) {
        firestorePayload.publicationUrl = publicationUrl.trim().slice(0, 512);
      }

      await setDoc(doc(db, 'archive_subscribers', subscriberId), firestorePayload).catch(
        () => {}
      );

      setSubmitted(true);
      if (onSubscribed) onSubscribed();
    } catch {
      setErrorMsg('Could not save your subscription right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 sm:p-12 lg:p-14 rounded-[2rem] bg-[#F8F9FA] border border-[#E8EAED] text-[#0B0B0C]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#E8EAED] text-xs font-mono font-medium text-[#0B0B0C]">
            <Flame
              className={`w-3.5 h-3.5 ${
                isRunaTheme ? 'text-[#0098A6]' : 'text-[#C83E0B]'
              }`}
            />
            <span>Fierce Lovers Circle &amp; Runa Early Access</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-medium text-[#0B0B0C] leading-tight">
            Receive new chapters, voice notes &amp; Runa beta access
          </h2>

          <p className="text-sm sm:text-base text-[#5F6368] leading-relaxed font-sans">
            Join readers exploring <em>The Truth About Love</em> via written and WhatsApp voice-note drops—or apply as a Substack writer, independent author, or investor for the <strong>Runa Conversational Manuscript Studio</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onOpenWhatsAppModal && (
              <button
                type="button"
                onClick={onOpenWhatsAppModal}
                className={`px-4 py-2.5 rounded-full text-xs font-mono font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer ${
                  isRunaTheme
                    ? 'runa-glass-btn runa-glass-pill text-[#0B0B0C]'
                    : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D]'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Try WhatsApp Runa Companion</span>
              </button>
            )}
            {completedDimensionsCount > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-[#FFFFFF] border border-[#E8EAED] text-xs font-mono text-[#0B0B0C] tabular-nums">
                Reading Journey: {completedDimensionsCount}/5 Dimensions Explored
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-6">
          {submitted ? (
            <div className="p-8 rounded-3xl bg-[#FFFFFF] border border-[#BBF7D0] space-y-4 text-center">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                  isRunaTheme
                    ? 'bg-[#00F0FF] text-[#0B0B0C]'
                    : 'bg-[#DCFCE7] text-[#15803D]'
                }`}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-medium text-[#0B0B0C]">
                You are on the Runa &amp; Fierce Lovers list
              </h3>
              <p className="text-xs sm:text-sm text-[#5F6368] max-w-md mx-auto leading-relaxed">
                Thank you{name ? `, ${name}` : ''}. Your spot is saved in our cloud registry. You will receive human-written manuscript updates and Runa companion access.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className={`text-xs font-mono hover:underline cursor-pointer ${
                  isRunaTheme ? 'text-[#0098A6]' : 'text-[#C83E0B]'
                }`}
              >
                Add another email
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8EAED] space-y-4"
            >
              {/* Role selector */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F1F3F4] text-xs font-medium">
                {(
                  [
                    { id: 'reader', label: 'Reader' },
                    { id: 'author', label: 'Substack / Author' },
                    { id: 'investor', label: 'Investor / Partner' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRole(tab.id)}
                    className={`py-2 px-2 rounded-lg transition-all cursor-pointer truncate ${
                      role === tab.id
                        ? isRunaTheme
                          ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                          : 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold shadow-xs'
                        : 'text-[#5F6368] hover:text-[#0B0B0C]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#5F6368] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0B0B0C]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#5F6368] mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Catalina / Reader"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0B0B0C]"
                  />
                </div>
              </div>

              {role === 'author' && (
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#5F6368] mb-1">
                    Your Substack or Book URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={publicationUrl}
                    onChange={(e) => setPublicationUrl(e.target.value)}
                    placeholder="https://yourname.substack.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] text-sm text-[#0B0B0C] focus:outline-none focus:border-[#0B0B0C]"
                  />
                </div>
              )}

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-[#202124] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    className={`rounded ${
                      isRunaTheme ? 'accent-[#00F0FF]' : 'accent-[#C83E0B]'
                    }`}
                  />
                  <span>Opt in to WhatsApp Runa audio notes &amp; short chapter drops</span>
                </label>

                {whatsappOptIn && (
                  <input
                    type="tel"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="WhatsApp Number (optional, e.g. +44 7700 900000)"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] text-xs text-[#0B0B0C] focus:outline-none focus:border-[#0B0B0C]"
                  />
                )}
              </div>

              {errorMsg && (
                <p
                  className={`text-xs font-medium ${
                    isRunaTheme ? 'text-[#0098A6]' : 'text-[#C83E0B]'
                  }`}
                >
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3.5 px-6 rounded-full font-sans text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                  isRunaTheme
                    ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                    : 'bg-[#C83E0B] hover:bg-[#A93207] text-white font-medium'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Saving to Registry...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {role === 'author'
                        ? 'Request Author Runa Studio Access'
                        : role === 'investor'
                        ? 'Request Investor Dossier & Demo Access'
                        : 'Join the Fierce Lovers & Runa List'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
