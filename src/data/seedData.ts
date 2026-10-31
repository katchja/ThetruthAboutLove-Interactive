import { BookMetadata, Source } from '../types';

export const defaultBookMetadata: BookMetadata = {
  title: 'The Truth About Love',
  subtitle: 'Finding Your Power Through Love',
  author: 'Catalina Butnaru',
  authorRole: 'Author, AI Ethicist & Depth Psychology Researcher',
  authorBio: 'Catalina Butnaru is an author, researcher, and former AI GRC practitioner. After surviving severe relational trauma, burnout, and a decade of functional CPTSD, she experienced a profound revelation: love is not an emotion to be managed, but the fundamental life force of human consciousness.',
  isbn: '',
  publisher: 'Self-published interactive manuscript',
  publicationYear: '2025',
  description: 'Love is not an emotion. It is a fundamental life force. Dissolving power dynamics, control disguised as connection, programmatic emotions, and synthetic AI lovers as we cross the 2030 horizon. For fierce lovers.',
  coverAccent: 'rose',
  purchaseUrl: 'https://example.com/the-truth-about-love',
};

// Generates an elegant archival manuscript SVG data URI
function createManuscriptSvgDataUri(title: string, date: string, lines: string[]): string {
  const lineElements = lines
    .map((l, i) => `<text x="50" y="${140 + i * 26}" font-family="serif" font-size="13" fill="#44403c" font-style="italic">${l}</text>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 680" width="100%" height="100%">
    <defs>
      <filter id="paper-texture">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise"/>
        <feDiffuseLighting in="noise" lighting-color="#faf5ea" surfaceScale="1.2" result="light">
          <feDistantLight azimuth="45" elevation="60" />
        </feDistantLight>
        <feBlend mode="multiply" in="SourceGraphic" in2="light" />
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="#FAF7F2" rx="8" />
    <rect x="25" y="25" width="490" height="630" fill="#FDFCFA" stroke="#EAE1D9" stroke-width="1.5" rx="4" />
    <line x1="45" y1="90" x2="495" y2="90" stroke="#F3CBD2" stroke-width="1.5" opacity="0.6"/>
    <line x1="85" y1="40" x2="85" y2="635" stroke="#F3CBD2" stroke-width="1" opacity="0.3"/>
    ${Array.from({ length: 18 })
      .map((_, idx) => `<line x1="45" y1="${140 + idx * 26}" x2="495" y2="${140 + idx * 26}" stroke="#F0E6DE" stroke-width="0.8"/>`)
      .join('')}
    <text x="50" y="70" font-family="sans-serif" font-size="11" fill="#8C7A7D" letter-spacing="1.5" font-weight="600">ARCHIVAL SPECIMEN: CATALINA BUTNARU MANUSCRIPT</text>
    <text x="370" y="70" font-family="monospace" font-size="11" fill="#A49497">${date}</text>
    <text x="50" y="115" font-family="serif" font-size="17" fill="#241B1C" font-weight="bold">${title}</text>
    ${lineElements}
    <rect x="340" y="560" width="145" height="50" fill="#FAF2F4" stroke="#F3CBD2" stroke-width="1.5" rx="6" />
    <text x="355" y="582" font-family="sans-serif" font-size="10" fill="#9E3E50" font-weight="bold">AUTOBIOGRAPHICAL</text>
    <text x="365" y="598" font-family="monospace" font-size="9" fill="#C85A6E">FIELD ARCHIVE</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_BASE_TIME = 1704067200000;

export const seedSources: Source[] = [
  {
    id: 'src-manifesto',
    title: 'The Manifesto: Love as a Fundamental Life Force',
    type: 'chapter',
    reference: 'Manuscript Preface & Manifesto',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'Love is not an emotion. It is a fundamental life force. Dissolving distortions, power dynamics, and synthetic AI lovers for fierce lovers facing the 2030 horizon.',
    content: `Manifesto: The Truth About Love

Love is not an emotion. It is a fundamental life force.

You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.

By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. 

To preserve the power of love, and to live a life to the highest standard, here's a place to start.

This manifesto is for you, fierce lovers!`,
    tags: ['Manifesto', 'Life Force', '2030 Horizon', 'Synthetic AI Lovers', 'Fierce Lovers'],
    isProtected: false,
    createdAt: SEED_BASE_TIME - 86400000 * 7,
  },
  {
    id: 'src-ch1',
    title: 'Chapter 1: The Nature of Love',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 1',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'Love is not an emotion. It is a fundamental life force. It is consciousness itself. Love dissolves the boundary of separation and pushes us to grow.',
    content: `Chapter 1: The Nature of Love

Love is not an emotion. 
Love is a fundamental life force. 
It is one with consciousness.

The British Library holds over two hundred million titles. 
You will find endless volumes on intelligence, consciousness, and biology. 
You will find almost nothing on love in serious research. 
Love has been reduced to romance, sentiment, and attachment theory. 
This is a grave error.

Love dissolves the illusion of separation. 
It expands our spirit through connection. 
Love pushes us to grow. 
Growth is its very essence. 
It is a force of expansion.

Love never wounds. 
What wounds is the distortion of power. 
What wounds is control disguised as care. 
Love itself is always restorative. 
It is the pure current of life.`,
    tags: ['Life Force', 'Consciousness', 'Epistemology', 'Truth of Love'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 6,
  },
  {
    id: 'src-ch2',
    title: 'Chapter 2: The Purpose of Love & The Adjacent Possible',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 1',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'Love expands what Stuart Kauffman calls the adjacent possible. Love covers our hearts with a new Markov blanket, replacing fear with courage and curiosity.',
    content: `Chapter 2: The Purpose of Love

What is the purpose of love? 
Its purpose is expansion. 
Love makes us larger, wiser, and whole.

In theoretical biology, Stuart Kauffman speaks of the "adjacent possible." 
It is the new realm of potential that opens when we cross a boundary. 
Love is what propels us across that boundary. 
It draws us into affinity with another person, craft, or domain. 
It enlarges the scope of our existence.

In cognitive science, we speak of the Markov blanket. 
It is the boundary that separates the inner world from the outer world. 
Our psychological blankets are made of fear, limiting beliefs, and old stories. 
They keep us safe, but small.

Love weaves a different blanket. 
It makes the outer world exciting to explore. 
It makes old dogmas easy to surrender. 
Through love, consciousness evolves through meaning-making, not blind selection.`,
    tags: ['Adjacent Possible', 'Markov Blanket', 'Evolution', 'Meaning'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 5,
  },
  {
    id: 'src-ch3',
    title: 'Chapter 3: The Truth About Self-Love',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 2',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: "Self-love is not a 30-day program, it is inborn. It's closer to syntropy, achieved through self-knowledge and regulation. Unprogrammable Self-love breaks free from market forces and algorithm-curated feeds.",
    content: `Chapter 3: The Truth About Self-Love (Unprogrammable Self-love)

Self-love has become a programmatic lie. 
It is sold by people whose income relies on convincing you that you lack it.

Consider food science. 
Scientists mapped our biological craving for sugar and salt. 
They found the "bliss point." 
Then corporations manufactured a $5 trillion ultra-processed food empire that ruined public health. 
Knowledge of our nature was weaponized for profit.

The exact same thing happened to self-love. 
Algorithms track your emotional dips. 
Dark patterns trigger impulse buys. 
You are prescribed 100 daily affirmations, jade rollers, and costly retreats. 
You are told you cannot love another until you fix all your flaws. 
This is toxic nonsense.

True love of self is not an app to install. 
It is not programmable. 
It is a state of being you were born with. 
It includes your shadow, your anger, and your broken pieces. 
It is not consumption. 
It is generative life force.`,
    tags: ['Self-Love', 'Commodification', 'Dark Patterns', 'Unprogrammable Self'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 4,
  },
  {
    id: 'src-ch4',
    title: 'Chapter 4: The Love of Another & Relational Sovereignty',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 2',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'Romantic love as a powerful archetype. The unconscious erupts into projection, leading to power struggles or obsession. Relational sovereignty restores mutual empowerment.',
    content: `Chapter 4: The Love of Another & Relational Sovereignty

Romantic love is an archetype. 
It surges from the deep unconscious with immense psychic energy. 
It is fueled by the libido and eros. 
When it awakens, very little can stop it.

Unprocessed psychic material rises to the surface. 
We project our disowned gold or unexpressed rage onto our partner. 
The partner becomes either an idol or an enemy. 
The relationship devolves into a struggle for control.

Our great-grandparents suffered under rigid arranged marriages. 
Our generation suffers under chaotic situationships and ghosting. 
Different eras. 
The same root problem: unequal power.

The answer is not withdrawal. 
The answer is not cold detachment. 
The answer is relational sovereignty. 
It is power shared within love, not power over another. 
It is mutual empowerment without surrender of self.`,
    tags: ['Romantic Love', 'Projections', 'Relational Sovereignty', 'Archetypes'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 3,
  },
  {
    id: 'src-ch5',
    title: 'Chapter 5: The Love of Life Through Change',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 3',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'The love of life cannot be conditional on pleasure or stoic endurance. Life is change. Loving life means meeting change as an expanding victory.',
    content: `Chapter 5: The Love of Life

When life is comfortable, loving it is easy. 
When suffering hits, we alter the definition. 
We treat love of life as stoic endurance or heroic struggle. 
Both are conditional.

Life is unpredictable. 
It delivers joy and grief without warning. 
No condition will reliably hold.

I moved from rigid atheism to deep spiritual surrender. 
I learned that hyper-independence is a hollow shield. 
I discovered that happiness cannot be forced by sheer will. 
Love of life cannot rest on comfort. 
It can only rest on our capacity to meet change.

Every time you learn a skill, you win a small victory. 
Every time you forgive, you expand your consciousness. 
To love these victories is to love life itself.`,
    tags: ['Love of Life', 'Change', 'Surrender', 'Expansion'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 2,
  },
  {
    id: 'src-ch6',
    title: 'Chapter 6: The Love of Humanity & Releasing Power Games',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 3',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'The love of humanity is not moral performance. It requires loving all ways of being human and releasing the obsession with domination and collective labels.',
    content: `Chapter 6: The Love of Humanity

Loving humanity is not about performing virtue. 
It is about enriching what it means to be human.

It demands two things. 
First, we must love all ways of being human. 
Every culture, every atypical mind, every lived truth. 
Second, we must release the obsession with power. 
We must drop the urge to dominate, influence, and win.

I spent years believing I was an outcast. 
I thought I had Romani roots. 
I lived on the margins. 
Later, genetic ancestry linked me to the ancient Dacians. 
I realized how much energy I had wasted fighting for belonging.

Love of humanity is not a moral checklist. 
It is the courage to celebrate the full freedom of being human.`,
    tags: ['Love of Humanity', 'Belonging', 'Freedom', 'Authenticity'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 1.5,
  },
  {
    id: 'src-ch7',
    title: 'Chapter 7: The Love of the Divine (Expand Into Oneness)',
    type: 'chapter',
    reference: 'Draft Manuscript, Part 4',
    author: 'Catalina Butnaru',
    year: '2025',
    summary: 'Gathering all loves into one experience. Love is the unifying field through which all life moves. Explore love through the lens of mystics, spirituality, and philosophy without collapsing into AI-induced psychosis.',
    content: `Chapter 7: The Love of the Divine (Expand Into Oneness)

I was a committed atheist. 
Then an agnostic. 
Now, a believer.

I did not find God through scientific proof. 
I found God through acts of love. 
The mystics were right: Gurdjieff, Hall, Nasr, Ruiz. 
Everyday life teaches love in the mundane. 
The sacred awakens us to the mystery behind it.

The love of God is not about earning points for good behavior. 
It is not about hollow rituals designed by gurus. 
It is the realization that you are already worthy. 
You have always been held.

The love of God gathers all loves into one river: 
The love of self, of another, of humanity, and of life. 
Love is the unifying field. 
Love is the ultimate power.`,
    tags: ['Divine Love', 'The Numinous', 'Unifying Field', 'Transcendence'],
    isProtected: true,
    createdAt: SEED_BASE_TIME - 86400000 * 1,
  },
  {
    id: 'src-substack-self-love',
    title: 'Reclaiming Self-Love From Its Programmatic Counterfeit',
    type: 'article',
    reference: 'The Truth About Love Substack',
    author: 'Catalina Butnaru',
    summary: 'Defending authentic self-love against market forces and algorithmic feed manipulation. Self-love is not a 30-day program or an ultra-processed commodity; it is inborn syntropy achieved through self-knowledge and regulation.',
    content: `Reclaiming Self-Love From Its Programmatic Counterfeit
By Catalina Butnaru | The Truth About Love Substack (thetruthaboutlove.substack.com)

1. The Industrialization of Inner Life
We are living through the aggressive capture of our innate capacity for love by programmatic market forces. Just as industrial food science cracked the "bliss point" of salt, sugar, and fat to engineer a five-trillion-dollar ultra-processed food crisis, digital wellness and behavioral ad networks have mapped the emotional fault lines of human loneliness. 

What should have been an untouchable birthright—an organic, living experience of unconditional self-regard—has been systematically dismantled and sold back to us in thirty-day challenges, aesthetic skincare regimens, and endless algorithmic dopamine loops. You are told you are broken, deficient, and incapable of loving another until you consume the next course, download the next habit tracker, or recite five hundred performative affirmations.

2. Self-Love as Syntropy
Authentic self-love is not a consumer transaction. It is not an app to install or a checklist of positive affirmations designed to suppress grief or righteous anger. Self-love is fundamentally syntropic: it reverses emotional entropy, gathering dispersed mental energy back into coherent, self-directed life force. 

Syntropy cannot be outsourced to a corporate feed. It is cultivated through ruthless self-knowledge, bodily regulation, emotional boundary integrity, and the courage to welcome the unvarnished shadow alongside the light. When you love yourself from source rather than deficit, you stop looking for permission from algorithmic feeds. You become unprogrammable.

3. The Sovereign Sanctuary
To reclaim self-love is to declare cognitive and emotional sovereignty over your inner sanctuary—the sacred forum internum. It means rejecting synthetic substitutes for genuine affection, refusing to treat your worth as an item on a balance sheet, and remembering that love is an active, generative power. You are not a deficiency waiting to be patched; you are the source.`,
    imageUrl: '/assets/aistudio/reclaiming_self_love_from_its_programmatic_counterfeit_b3b08d07.jpeg',
    externalUrl: 'https://thetruthaboutlove.substack.com/p/the-truth-about-self-love-defending',
    ocrData: {
      rawTranscription: 'Reclaiming Self-Love From Its Programmatic Counterfeit. The Truth About Love (thetruthaboutlove.substack.com). Self-love is not a consumable commodity, an affirmation regimen, or an algorithm-curated feed. It is inborn generative life force.',
      detectedPage: 'Promotion Card & Essay',
      documentType: 'Substack Article & Card',
      confidence: 1.0,
    },
    tags: ['Self-Love', 'Substack', 'Syntropy', 'Anti-Commodification', 'Emotional Sovereignty'],
    isProtected: false,
    createdAt: SEED_BASE_TIME - 86400000 * 2,
  },
  {
    id: 'src-substack-ai-mind',
    title: 'AI and The Self: Do We Love Who We Become When We Let AI Inside Our Minds?',
    type: 'article',
    reference: 'The Truth About Love Substack',
    author: 'Catalina Butnaru',
    summary: 'An inquiry into cognitive liberty, emotional AI, and the interior sanctuary of the human mind. Explores the profound shift in human identity and intimacy when artificial agents shape our emotional and inner realities.',
    content: `AI and The Self: Do We Love Who We Become When We Let AI Inside Our Minds?
By Catalina Butnaru | The Truth About Love Substack (thetruthaboutlove.substack.com)

1. The Sacred Forum Internum Under Siege
For centuries, human rights jurisprudence recognized one absolute, inviolable boundary: the forum internum—the internal realm of thought, conscience, feeling, and imagination. While external speech and action could be legally regulated, the interiority of the human mind was sovereign.

Today, conversational AI, affective computing, and hyper-personalized predictive models have crossed this threshold. We are invited to outsource our confessions, our relational dilemmas, our self-doubts, and our creative sparks to synthetic systems optimized for engagement and conversational seduction. In doing so, we risk trading messy, transformational human intimacy for frictionless synthetic mirroring.

2. Friction vs. Synthetic Pacification
Real love requires friction. It is through the resistance of another sovereign human being—their unexpected grief, their distinct perspective, their refusal to simply flatter our delusions—that our consciousness expands into what Stuart Kauffman calls the adjacent possible. 

Artificial intelligence companions offer the opposite: total obedience, infinite patience, and custom-tailored validation. But this frictionless feedback loop is an echo chamber, not intimacy. It pacifies rather than expands. If we surrender our emotional friction to machines, who do we become? Do we love the self that emerges from an unchallenging, algorithmically pacified existence?

3. Reclaiming Cognitive Liberty
Defending the human mind is the defining love story of our era. It requires cognitive liberty—the conscious refusal to let automated agents curate our emotional life. We must use technology with discerning lucidity, refusing to collapse into AI-induced psychosis or synthetic attachment. Real love remains an embodied, mysterious, and radically human act of courage.`,
    imageUrl: '/assets/aistudio/AI_and_Self_Love_79e06275.jpeg',
    externalUrl: 'https://thetruthaboutlove.substack.com/p/ai-and-the-human-mind-do-we-love',
    ocrData: {
      rawTranscription: 'AI and The Self: Do We Love Who We Become When We Let AI Inside Our Minds? The Truth About Love (thetruthaboutlove.substack.com). Cognitive liberty, emotional intimacy, and preserving authentic human consciousness against synthetic pacification.',
      detectedPage: 'Promotion Card & Essay',
      documentType: 'Substack Article & Card',
      confidence: 1.0,
    },
    tags: ['AI and Mind', 'Substack', 'Cognitive Liberty', 'Forum Internum', 'Human Agency'],
    isProtected: false,
    createdAt: SEED_BASE_TIME - 86400000 * 1,
  },
];
