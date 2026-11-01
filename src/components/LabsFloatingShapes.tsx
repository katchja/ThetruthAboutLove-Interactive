import React, { useId } from 'react';

interface LabsShapeProps {
  className?: string;
  variant?: 'yellow-pink' | 'pink-yellow' | 'soft-bloom';
}

/**
 * 8-Petal Round Scalloped Flower Shape inspired by Google Labs (Screenshots 1 & 3).
 * Uses an exact 8-petal radial circle union inside a <clipPath>, filled with
 * a high-diffusion multi-orb mesh gradient (light yellow, soft blush pink, warm peach,
 * and pale cream mist) plus a subtle fine-grain editorial texture overlay.
 */
export const LabsFlowerShape: React.FC<LabsShapeProps> = ({
  className = '',
  variant = 'yellow-pink',
}) => {
  const rawId = useId().replace(/:/g, '');
  const clipId = `labs-flower-clip-${rawId}`;
  const blurId = `labs-flower-blur-${rawId}`;
  const grainId = `labs-flower-grain-${rawId}`;

  // 8 petals arranged radially at R=122 around (250, 250), each petal radius r=112
  // creating a lush, smooth 8-scallop flower silhouette matching Screenshot 1 & 3
  const petals = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 8 - Math.PI / 8;
    const cx = 250 + Math.cos(angle) * 116;
    const cy = 250 + Math.sin(angle) * 116;
    return { cx: Number(cx.toFixed(2)), cy: Number(cy.toFixed(2)), r: 108 };
  });

  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="250" cy="250" r="145" />
          {petals.map((p, idx) => (
            <circle key={idx} cx={p.cx} cy={p.cy} r={p.r} />
          ))}
        </clipPath>

        <filter id={blurId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="46" />
        </filter>

        <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.12
                    0 0 0 0 0.10
                    0 0 0 0 0.08
                    0 0 0 0.055 0"
            in="noise"
            result="coloredNoise"
          />
        </filter>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Base warm ivory-yellow canvas */}
        <rect x="0" y="0" width="500" height="500" fill="#EFF1E6" />

        {/* Diffused internal mesh gradient orbs */}
        <g filter={`url(#${blurId})`}>
          {variant === 'yellow-pink' && (
            <>
              {/* Rich light chartreuse/lemon yellow lower & right field */}
              <circle cx="265" cy="395" r="175" fill="#E3E158" />
              <circle cx="385" cy="315" r="150" fill="#EBE97A" />
              <circle cx="170" cy="340" r="135" fill="#E6DF73" />

              {/* Pale mist upper-left lobe */}
              <circle cx="155" cy="165" r="155" fill="#EAF0EC" />
              <circle cx="245" cy="240" r="120" fill="#E5E8B6" />

              {/* Soft blush pink & warm peach accents (top, upper-right, lower-left) */}
              <circle cx="275" cy="105" r="95" fill="#F6AE99" />
              <circle cx="375" cy="195" r="95" fill="#F6B0B5" />
              <circle cx="120" cy="325" r="90" fill="#F9C2C6" />
              <circle cx="180" cy="105" r="85" fill="#F8C4CC" />
            </>
          )}

          {variant === 'pink-yellow' && (
            <>
              {/* Soft pink & rose-peach primary bloom */}
              <circle cx="185" cy="300" r="165" fill="#F8BAC2" />
              <circle cx="340" cy="175" r="150" fill="#F7B3A6" />
              {/* Warm light yellow base & right lobes */}
              <circle cx="315" cy="365" r="170" fill="#E5E362" />
              <circle cx="390" cy="285" r="135" fill="#EFEA84" />
              {/* Pale creamy mist top-left */}
              <circle cx="175" cy="155" r="150" fill="#EDF2EE" />
            </>
          )}

          {variant === 'soft-bloom' && (
            <>
              <circle cx="250" cy="360" r="180" fill="#EAE772" />
              <circle cx="150" cy="280" r="140" fill="#F9C2C9" />
              <circle cx="355" cy="210" r="145" fill="#F7B8AE" />
              <circle cx="215" cy="155" r="155" fill="#EFF3EF" />
            </>
          )}
        </g>

        {/* Subtle tactile grain overlay*/}
        <rect
          x="0"
          y="0"
          width="500"
          height="500"
          filter={`url(#${grainId})`}
          opacity="0.75"
        />
      </g>
    </svg>
  );
};

/**
 * Uses 3 overlapping organic circles inside a <clipPath>, filled with a soft
 * blurred mesh gradient of light yellow, soft blush pink, and pale cream mist.
 */
export const LabsCloudShape: React.FC<LabsShapeProps> = ({
  className = '',
  variant = 'yellow-pink',
}) => {
  const rawId = useId().replace(/:/g, '');
  const clipId = `labs-cloud-clip-${rawId}`;
  const blurId = `labs-cloud-blur-${rawId}`;
  const grainId = `labs-cloud-grain-${rawId}`;

  return (
    <svg
      viewBox="0 0 560 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* 3-lobe asymmetric cloud silhouette */}
        <clipPath id={clipId}>
          {/* Top-left / upper center lobe */}
          <circle cx="242" cy="184" r="142" />
          {/* Right / middle-right larger lobe */}
          <circle cx="348" cy="256" r="158" />
          {/* Bottom-left rounded lobe */}
          <circle cx="218" cy="332" r="146" />
        </clipPath>

        <filter id={blurId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="44" />
        </filter>

        <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.12
                    0 0 0 0 0.10
                    0 0 0 0 0.08
                    0 0 0 0.055 0"
            in="noise"
            result="coloredNoise"
          />
        </filter>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Base pale cream canvas */}
        <rect x="0" y="0" width="560" height="520" fill="#EEF1EA" />

        {/* Diffused internal mesh gradient orbs */}
        <g filter={`url(#${blurId})`}>
          {variant === 'yellow-pink' ? (
            <>
              {/* Soft creamy mist in upper lobe */}
              <circle cx="230" cy="135" r="155" fill="#EBF1EE" />
              {/* Warm coral-pink glow in upper-right lobe (like Screenshot 2) */}
              <circle cx="395" cy="160" r="130" fill="#F4B2A2" />
              {/* Soft rose-pink bloom in lower-left lobe (like Screenshot 4) */}
              <circle cx="170" cy="310" r="130" fill="#F9BFC6" />
              {/* Luminous light yellow across lower & right lobes */}
              <circle cx="240" cy="435" r="155" fill="#E3E054" />
              <circle cx="375" cy="340" r="165" fill="#EAE778" />
              <circle cx="275" cy="260" r="125" fill="#E4E6AD" />
            </>
          ) : (
            <>
              {/* Soft blush pink prominent in lower-left & center */}
              <circle cx="185" cy="315" r="145" fill="#F8B5BE" />
              <circle cx="240" cy="435" r="145" fill="#E5E15B" />
              <circle cx="375" cy="275" r="155" fill="#EBE985" />
              <circle cx="245" cy="150" r="150" fill="#EAF1ED" />
              <circle cx="365" cy="155" r="115" fill="#F7C2B8" />
            </>
          )}
        </g>

        {/* Subtle tactile grain overlay */}
        <rect
          x="0"
          y="0"
          width="560"
          height="520"
          filter={`url(#${grainId})`}
          opacity="0.75"
        />
      </g>
    </svg>
  );
};

interface Labs3DBlobShapeProps {
  className?: string;
  variant?: 'default' | 'tilted' | 'mirrored';
}

const BLOB_3D_ASSET_SRC = '/assets/aistudio/yellow3d_blob_fe91dbd0.png';

/**
 * 3D Golden Sculptural Organic Blob asset (/assets/aistudio/yellow3d_blob_fe91dbd0.png).
 * Uses radial edge feathering + multiply blending so it floats seamlessly on
 * any light or pastel canvas without visible bounding edges.
 */
export const Labs3DBlobShape: React.FC<Labs3DBlobShapeProps> = ({
  className = '',
  variant = 'default',
}) => {
  const orientationClass =
    variant === 'tilted'
      ? 'rotate-45 scale-105'
      : variant === 'mirrored'
      ? '-scale-x-100 -rotate-12'
      : '';

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <img
        src={BLOB_3D_ASSET_SRC}
        alt=""
        draggable={false}
        className={`w-full h-full object-contain labs-3d-blob ${orientationClass}`}
      />
    </div>
  );
};

