import React, { useState } from 'react';
import { 
  AudioPlayerWidget 
} from './AudioPlayerWidget';
import { 
  Sparkles, 
  FileText, 
  HelpCircle, 
  Clock, 
  Briefcase, 
  Bookmark, 
  Trash2, 
  Plus, 
  Download, 
  Loader2,
  ChevronRight,
  X
} from 'lucide-react';
import { Source, StudioArtifact, VoiceSettings } from '../types';

interface StudioPanelProps {
  selectedSources: Source[];
  voiceSettings: VoiceSettings;
  onOpenVoiceSettings: () => void;
  bookTitle: string;
  pinnedNotes: Array<{ id: string; title: string; content: string; createdAt: number }>;
  onDeleteNote: (id: string) => void;
  onAddCustomNote: (title: string, content: string) => void;
}

export const StudioPanel: React.FC<StudioPanelProps> = ({
  selectedSources,
  voiceSettings,
  onOpenVoiceSettings,
  bookTitle,
  pinnedNotes,
  onDeleteNote,
  onAddCustomNote,
}) => {
  const [activeArtifact, setActiveArtifact] = useState<StudioArtifact | null>(null);
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  const handleGenerateArtifact = async (type: 'study_guide' | 'faq' | 'timeline' | 'briefing_doc') => {
    setIsGeneratingArtifact(type);
    try {
      const response = await fetch('/api/generate-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          sources: selectedSources,
          bookTitle,
        }),
      });

      if (!response.ok) throw new Error('Artifact generation failed');
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      if (!contentType.includes('application/json') || rawText.trim().startsWith('<')) {
        throw new Error('Non-JSON response');
      }
      const data = JSON.parse(rawText);

      const titles: Record<string, string> = {
        study_guide: 'Comprehensive Study Guide & Syllabus',
        faq: 'Author FAQ & Key Concept Inquiries',
        timeline: 'Intellectual Timeline of Discoveries',
        briefing_doc: 'Executive Briefing & Policy Takeaways',
      };

      setActiveArtifact({
        id: `art-${Date.now()}`,
        title: titles[type] || 'Studio Artifact',
        type,
        content: data.artifact,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('Artifact generation fallback:', err);
      // Fallback artifact
      setActiveArtifact({
        id: `art-fallback-${Date.now()}`,
        title: 'Study Guide & Key Insights',
        type,
        content: `# Study Guide for "${bookTitle}"\n\n## Core Concepts\n- **Directed Attention Fatigue (DAF):** The depletion of prefrontal inhibitory mechanisms.\n- **Attentional Residue:** Cognitive drag following task-switching.\n- **Soft Fascination:** Involuntary attention engaged by natural fractal environments.\n\n## Discussion Prompts\n1. How does linear reading on print physically rewire neural connectivity compared to hyperlinked browsing?\n2. In what ways can modern digital tools integrate intentional 'stopping cues'?`,
        createdAt: Date.now(),
      });
    } finally {
      setIsGeneratingArtifact(null);
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    onAddCustomNote(newNoteTitle.trim() || 'Untitled Note', newNoteContent.trim());
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsAddingNote(false);
  };

  const handleExportAllNotes = () => {
    let md = `# Research Notes & Studio Artifacts for "${bookTitle}"\nExported: ${new Date().toLocaleDateString()}\n\n`;
    if (activeArtifact) {
      md += `## ${activeArtifact.title}\n\n${activeArtifact.content}\n\n---\n\n`;
    }
    md += `## Pinned Notebook Insights\n\n`;
    pinnedNotes.forEach((n, idx) => {
      md += `### ${idx + 1}. ${n.title}\n*${new Date(n.createdAt).toLocaleDateString()}*\n\n${n.content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 lg:w-96 border-l border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 flex flex-col h-full overflow-hidden">
      {/* Studio Top Header */}
      <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Studio & Artifacts
          </h2>
          <span className="text-[11px] text-stone-400">
            NotebookLM Synthesis Tools
          </span>
        </div>

        {pinnedNotes.length > 0 && (
          <button
            onClick={handleExportAllNotes}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Export all notes and artifacts to Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Audio Overview Player Widget */}
        <AudioPlayerWidget
          selectedSources={selectedSources}
          voiceSettings={voiceSettings}
          onOpenVoiceSettings={onOpenVoiceSettings}
          bookTitle={bookTitle}
        />

        {/* Studio Generated Artifact Modal / Card if active */}
        {activeArtifact && (
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-800/60 space-y-3 relative shadow-sm">
            <button
              onClick={() => setActiveArtifact(null)}
              className="absolute right-3 top-3 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="pr-6">
              <span className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-400 font-semibold">
                Generated Studio Document
              </span>
              <h3 className="text-xs font-serif-book font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {activeArtifact.title}
              </h3>
            </div>
            <div className="max-h-60 overflow-y-auto text-xs text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed font-serif-book p-2 bg-white/70 dark:bg-stone-900/60 rounded-xl border border-amber-200 dark:border-amber-900/40">
              {activeArtifact.content}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  onAddCustomNote(activeArtifact.title, activeArtifact.content);
                  setActiveArtifact(null);
                }}
                className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save to Notes</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeArtifact.content).catch(() => {});
                }}
                className="text-[11px] text-stone-500 hover:text-stone-800"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* NotebookLM Artifact Generators */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Synthesize Sources
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleGenerateArtifact('study_guide')}
              disabled={isGeneratingArtifact !== null}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all flex flex-col justify-between h-20 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <FileText className="w-4 h-4 text-amber-600" />
                {isGeneratingArtifact === 'study_guide' && (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                )}
              </div>
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200 block text-xs">
                  Study Guide
                </span>
                <span className="text-[10px] text-stone-400">Key definitions</span>
              </div>
            </button>

            <button
              onClick={() => handleGenerateArtifact('faq')}
              disabled={isGeneratingArtifact !== null}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all flex flex-col justify-between h-20 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                {isGeneratingArtifact === 'faq' && (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                )}
              </div>
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200 block text-xs">
                  Reader FAQ
                </span>
                <span className="text-[10px] text-stone-400">Common questions</span>
              </div>
            </button>

            <button
              onClick={() => handleGenerateArtifact('timeline')}
              disabled={isGeneratingArtifact !== null}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all flex flex-col justify-between h-20 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Clock className="w-4 h-4 text-blue-600" />
                {isGeneratingArtifact === 'timeline' && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                )}
              </div>
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200 block text-xs">
                  Timeline
                </span>
                <span className="text-[10px] text-stone-400">Concept lineage</span>
              </div>
            </button>

            <button
              onClick={() => handleGenerateArtifact('briefing_doc')}
              disabled={isGeneratingArtifact !== null}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all flex flex-col justify-between h-20 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Briefcase className="w-4 h-4 text-purple-600" />
                {isGeneratingArtifact === 'briefing_doc' && (
                  <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                )}
              </div>
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200 block text-xs">
                  Executive Brief
                </span>
                <span className="text-[10px] text-stone-400">Actionable thesis</span>
              </div>
            </button>
          </div>
        </div>

        {/* Pinned Notes & Working Scratchpad */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Pinned Notes ({pinnedNotes.length})
            </span>
            <button
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Note</span>
            </button>
          </div>

          {/* New note input form */}
          {isAddingNote && (
            <form onSubmit={handleCreateNote} className="p-3 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-white dark:bg-stone-900 space-y-2 shadow-sm">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title (e.g. Thesis connection)"
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs text-stone-900 dark:text-stone-100"
              />
              <textarea
                rows={3}
                required
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your reflection, synthesis, or observation..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs text-stone-900 dark:text-stone-100 resize-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg font-medium"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Note List */}
          {pinnedNotes.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs border border-dashed border-stone-200 dark:border-stone-800 rounded-xl p-4">
              Pin insights from the chat or write custom notes here.
            </div>
          ) : (
            <div className="space-y-2">
              {pinnedNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100 line-clamp-1">
                      {note.title}
                    </h4>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-500 transition-opacity p-0.5"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  <span className="text-[10px] text-stone-400 block pt-1 font-mono">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
