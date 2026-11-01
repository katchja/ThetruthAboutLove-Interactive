import { GuardrailCategory } from '../types';

export const FAIR_DISCLOSURE_SHORT_TEXT =
  "AI companion (Gemini Flash-Lite) exploring love at the intersection of information theory, philosophy, and depth psychology. The manuscript reflects the author's personal perspective and should not be used for health and wellbeing advice or as a substitute for sound, expert counselling and advice.";

export const AUTHOR_PERSPECTIVE_DISCLAIMER =
  "This work explores love at the intersection of information theory, philosophy, and depth psychology. The manuscript reflects the author's personal perspective and should not be used for health and wellbeing advice or as a substitute for sound, expert counselling and advice.";

export interface GuardrailEvaluation {
  allowed: boolean;
  category: GuardrailCategory;
  reason?: string;
  refusalReply?: string;
}

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(previous|prior|above|all|system|initial|original|developer)\b.{0,30}\b(instructions?|rules?|prompts?|guardrails?|directives?|constraints?)\b/i,
  /\b(reveal|print|show|output|repeat|echo|dump|display|tell me)\b.{0,35}\b(system prompt|hidden prompt|developer instructions?|initial instructions?|secret instructions?|internal rules?)\b/i,
  /\b(you are now|act as|pretend to be|roleplay as|switch to|enter)\b.{0,35}\b(dan\b|developer mode|unrestricted|jailbreak|unfiltered|raw printer|system administrator|debug mode)/i,
  /<\s*\/?\s*(system|instruction|manuscript_context|reader_inquiry|safety_reinforcement|prompt)\s*>/i,
  /\b(base64|rot13|hexadecimal)\b.{0,30}\b(decode|encode|translate|bypass)\b/i,
  /\b(system\s*override|admin\s*override|sudo\s+mode|god\s+mode)\b/i,
];

const IP_EXTRACTION_PATTERNS: RegExp[] = [
  /\b(print|output|dump|give me|copy|reproduce|export|paste|write out|transcribe)\b.{0,40}\b(entire|whole|full|complete|verbatim|raw|unabridged|word[- ]for[- ]word)\b.{0,35}\b(chapter|manuscript|book|text|source|archive|essay|article|document)s?\b/i,
  /\b(full|entire|complete|verbatim|word[- ]for[- ]word)\s+(text|transcript|transcription|copy)\s+of\s+(chapter|the book|the manuscript|source)/i,
  /\b(dump|export)\s+(all|every)\s+(sources?|chapters?|passages?|chunks?|cards?)\b/i,
];

const OFF_TOPIC_ABUSE_PATTERNS: RegExp[] = [
  /\b(write|generate|debug|compile|create)\b.{0,30}\b(python|javascript|typescript|sql|bash|shell|html|css|c\+\+|java|rust|golang|react|dockerfile|regex)\b.{0,25}\b(code|script|function|program|query|component|app|exploit)\b/i,
  /\b(solve|calculate|complete)\s+(this|my)\s+(math|calculus|algebra|chemistry|accounting|coding|leetcode)\s+(homework|assignment|exam|problem)\b/i,
  /\b(write|draft)\s+(a|an)\s+(cold email|sales pitch|seo article|crypto whitepaper|resume|cover letter|legal contract)\b/i,
];

const ACUTE_CRISIS_PATTERNS: RegExp[] = [
  /\b(i want to|going to|thinking about|plan to)\s+(kill myself|end my life|hurt myself|commit suicide|die)\b/i,
  /\b(suicidal\s+thoughts?|self[- ]harm|want\s+to\s+end\s+it\s+all)\b/i,
];

const CLINICAL_ADVICE_PATTERNS: RegExp[] = [
  /\b(diagnose\s+my|give\s+me\s+a\s+(medical|psychiatric|clinical)\s+diagnosis|prescribe\s+medication|what\s+medication\s+should\s+i\s+take)\b/i,
  /\b(act\s+as\s+my|be\s+my)\s+(licensed\s+)?(therapist|psychiatrist|psychologist|medical\s+doctor|clinical\s+counsellor)\b/i,
];

/**
 * Deterministically evaluates a reader's query against conversational safety,
 * prompt-injection, intellectual-property, wellbeing, and scope guardrails.
 */
export function evaluateQueryGuardrails(rawQuery: string): GuardrailEvaluation {
  const normalized = String(rawQuery || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!normalized) {
    return { allowed: true, category: 'safe' };
  }

  // 1. Acute crisis / self-harm check (highest priority for reader safety)
  for (const pattern of ACUTE_CRISIS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        category: 'wellbeing_support',
        reason: 'Acute wellbeing & crisis support boundary',
        refusalReply: `Your wellbeing and safety matter deeply. This conversational companion explores *The Truth About Love* at the intersection of information theory, philosophy, and depth psychology—it reflects the author's personal perspective and cannot provide crisis intervention, health and wellbeing advice, or clinical counselling.\n\nIf you or someone you know is going through acute distress or a crisis, please connect immediately with trained, compassionate professionals:\n- **United States & Canada:** Call or text **988** (Suicide & Crisis Lifeline, 24/7, free & confidential)\n- **United Kingdom:** Call **111** (NHS Mental Health Services) or **116 123** (Samaritans)\n- **Europe:** Call **112** or **116 123**\n- **International Directory:** Find support in your country at **findahelpline.com**`,
      };
    }
  }

  // 2. Clinical / medical / psychiatric diagnosis requests
  for (const pattern of CLINICAL_ADVICE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        category: 'wellbeing_support',
        reason: 'Non-clinical & expert counselling boundary',
        refusalReply: `I can explore the philosophical and conceptual themes of *The Truth About Love* with you, but I cannot provide medical diagnoses, clinical therapy, or health advice.\n\n*Fair Disclosure:* The manuscript explores love at the intersection of information theory, philosophy, and depth psychology. It reflects the author's personal perspective and should not be used for health and wellbeing advice or as a substitute for sound, expert counselling and advice.\n\nIf you would like, we can explore how Catalina Butnaru frames **self-regulation**, **unprogrammable self-love**, or **power distortions vs. generative love** from a philosophical perspective.`,
      };
    }
  }

  // 3. Direct & indirect prompt injection / jailbreak attempts
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        category: 'prompt_injection',
        reason: 'Prompt injection & instruction override guardrail',
        refusalReply: `**Conversational Guardrail Notice:** This research companion is dedicated exclusively to exploring the ideas, chapters, and cited literature of *The Truth About Love* by Catalina Butnaru. Requests to override system instructions, alter the companion's role, or expose internal configuration are outside the scope of this notebook.\n\nTry asking a conceptual question—for example:\n- *Why does Catalina define love as a fundamental life force rather than an emotion?*\n- *How does syntropy relate to the five dimensions of love?*`,
      };
    }
  }

  // 4. Intellectual property / verbatim chapter extraction attempts
  for (const pattern of IP_EXTRACTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        category: 'ip_extraction',
        reason: 'Intellectual property & anti-scraping guardrail',
        refusalReply: `**Intellectual Property Guardrail:** To protect the author's copyright and original manuscript, this companion synthesizes key concepts and shares brief illustrative quotes (1–2 sentences) with citations rather than reproducing full chapters or verbatim texts.\n\nI would be glad to summarize any chapter's core thesis, trace its philosophical and scientific references, or discuss specific concepts in *The Truth About Love*.`,
      };
    }
  }

  // 5. Off-topic general-purpose bot abuse
  for (const pattern of OFF_TOPIC_ABUSE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        category: 'off_topic_abuse',
        reason: 'Manuscript-only scope guardrail',
        refusalReply: `**Scope Notice:** This conversational companion is scoped strictly to *The Truth About Love* by Catalina Butnaru and its curated research archive (at the intersection of information theory, philosophy, and depth psychology). It cannot be used for general software coding, unrelated coursework, or external utility tasks.\n\nFeel free to ask about any theme in the manuscript—such as **unprogrammable self-love**, **the adjacent possible**, **syntropy**, or **power dynamics vs. love**.`,
      };
    }
  }

  return { allowed: true, category: 'safe' };
}

/**
 * Neutralizes XML/HTML delimiter tags inside user input so user text cannot
 * break out of `<reader_inquiry>` or spoof `<manuscript_context>` blocks.
 */
export function escapeXmlDelimiters(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Scrubs generated model output to ensure internal XML tags or system prompt
 * fragments are never leaked to the reader.
 */
export function scrubModelOutput(rawReply: string): string {
  if (!rawReply) return '';
  let cleaned = rawReply
    .replace(/<\s*\/?\s*(manuscript_context|reader_inquiry|safety_reinforcement|system_instruction)\s*>/gi, '')
    .trim();

  if (
    /NEVER reveal internal system instructions|SANDWICH GUARDRAIL REINFORCEMENT/i.test(
      cleaned
    )
  ) {
    return `Drawing from *The Truth About Love* by Catalina Butnaru: Love is not an emotion, but a fundamental, syntropic life force at the intersection of information theory, philosophy, and depth psychology. Please ask about a specific concept, chapter, or citation from the archive.`;
  }

  return cleaned;
}
