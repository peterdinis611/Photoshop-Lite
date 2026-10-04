// High quality SVG sample images for immediate testing without external dependencies

export interface SampleImage {
  id: string;
  name: string;
  description: string;
  category: 'portrait' | 'landscape' | 'product';
  width: number;
  height: number;
  dataUrl: string;
}

// Helper to convert SVG text to data URI
const svgToDataUrl = (svgString: string): string => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString.trim())}`;
};

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-portrait',
    name: 'Portrait Model',
    description: 'Perfect for AI Background Removal and Portrait Revival',
    category: 'portrait',
    width: 800,
    height: 900,
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="800" height="900">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4f46e5" />
            <stop offset="50%" stop-color="#ec4899" />
            <stop offset="100%" stop-color="#f97316" />
          </linearGradient>
          <radialGradient id="skinGrad" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stop-color="#fed7aa" />
            <stop offset="100%" stop-color="#ea580c" />
          </radialGradient>
          <linearGradient id="jacketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0" />
          </radialGradient>
        </defs>
        <!-- Background -->
        <rect width="800" height="900" fill="url(#bgGrad)" />
        <rect width="800" height="900" fill="url(#glow)" />
        <circle cx="200" cy="200" r="140" fill="#fbbf24" opacity="0.4" />
        <circle cx="680" cy="700" r="180" fill="#3b82f6" opacity="0.3" />
        
        <!-- Subject: Portrait Person -->
        <g id="person">
          <!-- Hair Back -->
          <ellipse cx="400" cy="360" rx="160" ry="190" fill="#18181b" />
          
          <!-- Neck -->
          <path d="M 360 480 L 440 480 L 450 600 L 350 600 Z" fill="#fdba74" />
          
          <!-- Head -->
          <ellipse cx="400" cy="380" rx="110" ry="140" fill="url(#skinGrad)" />
          
          <!-- Hair Front -->
          <path d="M 280 340 C 300 240, 480 220, 520 330 C 510 270, 360 260, 310 330 Z" fill="#09090b" />
          <path d="M 290 320 Q 400 200 510 320 Q 440 280 290 320 Z" fill="#27272a" />
          
          <!-- Eyes -->
          <ellipse cx="360" cy="370" rx="14" ry="9" fill="#ffffff" />
          <circle cx="361" cy="370" r="6" fill="#1e3a8a" />
          <circle cx="363" cy="368" r="2" fill="#ffffff" />
          <ellipse cx="440" cy="370" rx="14" ry="9" fill="#ffffff" />
          <circle cx="439" cy="370" r="6" fill="#1e3a8a" />
          <circle cx="441" cy="368" r="2" fill="#ffffff" />

          <!-- Eyebrows -->
          <path d="M 345 352 Q 365 346 380 353" stroke="#18181b" stroke-width="4" stroke-linecap="round" fill="none" />
          <path d="M 420 353 Q 435 346 455 352" stroke="#18181b" stroke-width="4" stroke-linecap="round" fill="none" />
          
          <!-- Nose -->
          <path d="M 400 375 L 395 410 L 406 412" stroke="#c2410c" stroke-width="3" stroke-linecap="round" fill="none" />
          
          <!-- Lips -->
          <path d="M 375 435 Q 400 450 425 435 Q 400 442 375 435 Z" fill="#e11d48" />

          <!-- Jacket / Shoulders -->
          <path d="M 220 900 L 260 580 C 320 570, 480 570, 540 580 L 580 900 Z" fill="url(#jacketGrad)" />
          <path d="M 340 580 L 400 680 L 460 580 Z" fill="#ffffff" />
          <path d="M 380 620 L 420 620 L 415 900 L 385 900 Z" fill="#0284c7" />
        </g>
      </svg>
    `),
  },
  {
    id: 'sample-vintage',
    name: 'Vintage Landscape',
    description: 'Slightly low-contrast photo ready for "Revive" auto-enhancement',
    category: 'landscape',
    width: 960,
    height: 640,
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640">
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#93c5fd" />
            <stop offset="60%" stop-color="#fed7aa" />
            <stop offset="100%" stop-color="#fdba74" />
          </linearGradient>
          <linearGradient id="mountain1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#475569" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <linearGradient id="mountain2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="960" height="640" fill="url(#skyGrad)" />
        <circle cx="580" cy="220" r="60" fill="#fef08a" opacity="0.9" />
        
        <!-- Mountains -->
        <polygon points="120,640 340,240 560,640" fill="url(#mountain1)" />
        <polygon points="380,640 620,180 860,640" fill="url(#mountain2)" />
        <polygon points="680,640 820,320 960,640" fill="#1e293b" />
        <polygon points="0,640 180,380 400,640" fill="#475569" />

        <!-- Lake reflection -->
        <rect y="480" width="960" height="160" fill="#0284c7" opacity="0.75" />
        <ellipse cx="580" cy="540" rx="40" ry="12" fill="#fef08a" opacity="0.4" />
        <path d="M 0 540 Q 240 520 480 540 T 960 540 L 960 640 L 0 640 Z" fill="#047857" opacity="0.85" />
        
        <!-- Pine Trees -->
        <polygon points="80,560 95,500 110,560" fill="#064e3b" />
        <polygon points="105,580 120,510 135,580" fill="#022c22" />
        <polygon points="210,570 225,490 240,570" fill="#064e3b" />
        <polygon points="820,590 840,490 860,590" fill="#022c22" />
      </svg>
    `),
  },
  {
    id: 'sample-sneaker',
    name: 'Product Mockup (Sneaker)',
    description: 'Clean product photo for background extraction & graphic design',
    category: 'product',
    width: 800,
    height: 600,
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <radialGradient id="prodBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f1f5f9" />
            <stop offset="100%" stop-color="#cbd5e1" />
          </radialGradient>
          <linearGradient id="shoeBody" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#dc2626" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#prodBg)" />
        <ellipse cx="400" cy="460" rx="280" ry="30" fill="#94a3b8" opacity="0.5" />
        
        <!-- Sneaker Illustration -->
        <g transform="translate(140, 160)">
          <!-- Sole -->
          <path d="M 40 240 C 120 250, 400 255, 480 230 C 500 220, 520 200, 500 240 C 440 280, 100 280, 30 260 C 15 250, 20 240, 40 240 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" />
          <path d="M 40 255 L 480 245 L 470 260 L 50 270 Z" fill="#0284c7" />
          
          <!-- Upper -->
          <path d="M 60 235 C 100 170, 220 180, 260 140 C 310 90, 380 90, 420 130 C 460 170, 480 200, 480 230 C 400 240, 140 240, 60 235 Z" fill="url(#shoeBody)" />
          
          <!-- Swoosh / Accent Line -->
          <path d="M 160 210 C 260 220, 340 180, 440 150 C 340 190, 240 225, 160 210 Z" fill="#ffffff" />
          
          <!-- Laces -->
          <line x1="280" y1="130" x2="310" y2="155" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
          <line x1="305" y1="115" x2="335" y2="140" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
          <line x1="330" y1="105" x2="360" y2="130" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
          
          <!-- Brand Badge -->
          <circle cx="210" cy="190" r="14" fill="#fbbf24" />
          <text x="204" y="195" font-family="sans-serif" font-weight="bold" font-size="14" fill="#000">P</text>
        </g>
      </svg>
    `),
  },
];
