import React, { useState, useCallback } from 'react';

interface FloralAsset {
  src: string;
  alt: string;
  aspect: 'wide' | 'square' | 'tall';
}

const KUROHANA_ASSETS: FloralAsset[] = [
  {
    src: '/assets/aistudio/STYT_Kurohana_008____1_7277e008.png',
    alt: 'Botanical foliage leaf',
    aspect: 'wide',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_042____1_b61c8e20.png',
    alt: 'Fringed crimson poppy bloom',
    aspect: 'square',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_018____1_cd3aef2f.png',
    alt: 'Variegated parrot tulip',
    aspect: 'tall',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_033____1_0ded6ccf.png',
    alt: 'Golden yellow rose bloom',
    aspect: 'square',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_046____1_40d51d3c.png',
    alt: 'Scarlet anemone flower',
    aspect: 'square',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_025____1_851e79ca.png',
    alt: 'Striped flame tulip',
    aspect: 'tall',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_044____1_58f69c8d.png',
    alt: 'Deep burgundy poppy petal',
    aspect: 'wide',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_050____1_7d19f761.png',
    alt: 'Painterly striped tulip foliage',
    aspect: 'square',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_034____1_09d4314e.png',
    alt: 'Crimson peony blossom',
    aspect: 'square',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_020____1_a1e764fe.png',
    alt: 'Amber marigold bloom',
    aspect: 'tall',
  },
  {
    src: '/assets/aistudio/STYT_Kurohana_057_1_709ae6a5.png',
    alt: 'Golden stamen red blossom',
    aspect: 'square',
  },
];

interface FoliageNode {
  id: number;
  assetIdx: number;
  leftPercent: number;
  bottomPx: number;
  widthPx: number;
  baseRotation: number;
  flipX: boolean;
  zIndex: number;
  layer: 'back' | 'mid' | 'front';
  swayDir: 1 | -1;
}

/**
 * Deterministic rich bed of overlapping fallen flowers & foliage across the entire bottom edge (-6% to 104%).
 * Three depth tiers ('back', 'mid', 'front') create a lush, thick carpet of fallen blooms and leaves.
 */
const FOLIAGE_BED_NODES: FoliageNode[] = (() => {
  const nodes: FoliageNode[] = [];
  let idCounter = 1;

  // Tier 1: Deep background foliage & large blooms (24 items spanning -6% to 104%)
  const backCount = 24;
  for (let i = 0; i < backCount; i++) {
    const t = i / (backCount - 1);
    const jitter = ((i * 37) % 11) - 5;
    const leftPercent = -5 + t * 108 + jitter * 0.35;
    // Emphasize leaves (0), large poppies (1, 4, 6), and tulips (2, 5, 7) in the back bed
    const assetOrder = [0, 1, 7, 2, 0, 4, 6, 5, 8, 3, 9, 10];
    const assetIdx = assetOrder[i % assetOrder.length];
    const widthPx = 155 + ((i * 29) % 65);
    const bottomPx = 18 + ((i * 19) % 58);
    const baseRotation = -34 + ((i * 43) % 68);
    const flipX = i % 2 === 1;

    nodes.push({
      id: idCounter++,
      assetIdx,
      leftPercent,
      bottomPx,
      widthPx,
      baseRotation,
      flipX,
      zIndex: 10 + (i % 5),
      layer: 'back',
      swayDir: i % 2 === 0 ? 1 : -1,
    });
  }

  // Tier 2: Dense mid-ground layer of fallen flowers & foliage (28 items)
  const midCount = 28;
  for (let i = 0; i < midCount; i++) {
    const t = i / (midCount - 1);
    const jitter = ((i * 53) % 13) - 6;
    const leftPercent = -4 + t * 106 + jitter * 0.3;
    const assetIdx = (i * 3 + 1) % KUROHANA_ASSETS.length;
    const widthPx = 135 + ((i * 31) % 60);
    const bottomPx = -10 + ((i * 23) % 46);
    const baseRotation = -42 + ((i * 47) % 84);
    const flipX = (i + 1) % 3 === 0;

    nodes.push({
      id: idCounter++,
      assetIdx,
      leftPercent,
      bottomPx,
      widthPx,
      baseRotation,
      flipX,
      zIndex: 20 + (i % 8),
      layer: 'mid',
      swayDir: i % 2 === 0 ? -1 : 1,
    });
  }

  // Tier 3: Foreground fallen petals, roses, marigolds, and leaves along the very bottom rim (26 items)
  const frontCount = 26;
  for (let i = 0; i < frontCount; i++) {
    const t = i / (frontCount - 1);
    const jitter = ((i * 41) % 9) - 4;
    const leftPercent = -4 + t * 106 + jitter * 0.28;
    const frontOrder = [3, 6, 8, 10, 0, 4, 7, 1, 9, 2, 5];
    const assetIdx = frontOrder[i % frontOrder.length];
    const widthPx = 120 + ((i * 27) % 58);
    const bottomPx = -32 + ((i * 17) % 36);
    const baseRotation = -48 + ((i * 59) % 96);
    const flipX = i % 2 === 0;

    nodes.push({
      id: idCounter++,
      assetIdx,
      leftPercent,
      bottomPx,
      widthPx,
      baseRotation,
      flipX,
      zIndex: 30 + (i % 8),
      layer: 'front',
      swayDir: i % 2 === 0 ? 1 : -1,
    });
  }

  return nodes;
})();

interface ImpulseOffset {
  dx: number;
  dy: number;
  dRot: number;
  scale: number;
}

export const RunaHeroFallenFoliageBed: React.FC = () => {
  const [impulses, setImpulses] = useState<Record<number, ImpulseOffset>>({});

  /**
   * When any flower or leaf in the bed is clicked, trigger a subtle, organic rustle
   * on the clicked bloom and its nearby overlapping neighbors, then smoothly settle back.
   */
  const handleFoliageClick = useCallback(
    (clickedNode: FoliageNode, e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const nextImpulses: Record<number, ImpulseOffset> = {};
      const affectedIds: number[] = [];

      FOLIAGE_BED_NODES.forEach((node) => {
        const dist = Math.abs(node.leftPercent - clickedNode.leftPercent);
        if (node.id === clickedNode.id) {
          // Primary clicked flower/foliage: gentle press-and-rustle
          affectedIds.push(node.id);
          nextImpulses[node.id] = {
            dx: node.swayDir * (6 + (node.id % 5)),
            dy: -10 - (node.id % 6),
            dRot: node.swayDir * (11 + (node.id % 7)),
            scale: 1.045,
          };
        } else if (dist < 11) {
          // Neighboring overlapping flowers ripple subtly outward
          affectedIds.push(node.id);
          const falloff = 1 - dist / 11;
          const pushDir = node.leftPercent >= clickedNode.leftPercent ? 1 : -1;
          nextImpulses[node.id] = {
            dx: pushDir * Math.round((5 + (node.id % 4)) * falloff),
            dy: Math.round((-5 - (node.id % 4)) * falloff),
            dRot: pushDir * Math.round((7 + (node.id % 5)) * falloff),
            scale: 1 + 0.02 * falloff,
          };
        }
      });

      setImpulses((prev) => ({
        ...prev,
        ...nextImpulses,
      }));

      // Smoothly settle back into the resting foliage bed
      window.setTimeout(() => {
        setImpulses((prev) => {
          const copy = { ...prev };
          affectedIds.forEach((id) => {
            delete copy[id];
          });
          return copy;
        });
      }, 650);
    },
    []
  );

  return (
    <div
      className="absolute inset-x-0 bottom-0 h-[185px] sm:h-[220px] lg:h-[250px] overflow-hidden select-none z-0 pointer-events-none"
      aria-label="Thick layer of interactive fallen flowers and foliage"
    >
      <div className="relative w-full h-full">
        {FOLIAGE_BED_NODES.map((node) => {
          const asset = KUROHANA_ASSETS[node.assetIdx];
          const impulse = impulses[node.id];

          const dx = impulse ? impulse.dx : 0;
          const dy = impulse ? impulse.dy : 0;
          const rot = node.baseRotation + (impulse ? impulse.dRot : 0);
          const scale = impulse ? impulse.scale : 1;
          const scaleX = node.flipX ? -scale : scale;

          return (
            <div
              key={node.id}
              onClick={(e) => handleFoliageClick(node, e)}
              style={{
                left: `${node.leftPercent}%`,
                bottom: `${node.bottomPx}px`,
                width: `${node.widthPx}px`,
                zIndex: node.zIndex,
                transform: `translate3d(calc(-50% + ${dx}px), ${dy}px, 0) rotate(${rot}deg) scale(${scaleX}, ${scale})`,
                transition:
                  'transform 720ms cubic-bezier(0.22, 1, 0.36, 1), filter 500ms ease',
              }}
              className="absolute origin-bottom cursor-pointer pointer-events-auto will-change-transform group"
            >
              <img
                src={asset.src}
                alt={asset.alt}
                draggable={false}
                loading="eager"
                className="w-full h-auto object-contain block drop-shadow-[0_6px_14px_rgba(20,20,19,0.22)] transition-transform duration-500 ease-out group-hover:-translate-y-0.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
