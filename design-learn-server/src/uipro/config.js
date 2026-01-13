const DOMAIN_CONFIG = {
  style: {
    file: 'styles.csv',
    searchColumns: ['Style Category', 'Keywords', 'Best For', 'Type'],
    outputColumns: [
      'Style Category',
      'Type',
      'Keywords',
      'Primary Colors',
      'Effects & Animation',
      'Best For',
      'Performance',
      'Accessibility',
      'Framework Compatibility',
      'Complexity',
    ],
  },
  prompt: {
    file: 'prompts.csv',
    searchColumns: ['Style Category', 'AI Prompt Keywords (Copy-Paste Ready)', 'CSS/Technical Keywords'],
    outputColumns: [
      'Style Category',
      'AI Prompt Keywords (Copy-Paste Ready)',
      'CSS/Technical Keywords',
      'Implementation Checklist',
    ],
  },
  color: {
    file: 'colors.csv',
    searchColumns: ['Product Type', 'Keywords', 'Notes'],
    outputColumns: [
      'Product Type',
      'Keywords',
      'Primary (Hex)',
      'Secondary (Hex)',
      'CTA (Hex)',
      'Background (Hex)',
      'Text (Hex)',
      'Border (Hex)',
      'Notes',
    ],
  },
  chart: {
    file: 'charts.csv',
    searchColumns: ['Data Type', 'Keywords', 'Best Chart Type', 'Accessibility Notes'],
    outputColumns: [
      'Data Type',
      'Keywords',
      'Best Chart Type',
      'Secondary Options',
      'Color Guidance',
      'Accessibility Notes',
      'Library Recommendation',
      'Interactive Level',
    ],
  },
  landing: {
    file: 'landing.csv',
    searchColumns: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
    outputColumns: [
      'Pattern Name',
      'Keywords',
      'Section Order',
      'Primary CTA Placement',
      'Color Strategy',
      'Conversion Optimization',
    ],
  },
  product: {
    file: 'products.csv',
    searchColumns: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    outputColumns: [
      'Product Type',
      'Keywords',
      'Primary Style Recommendation',
      'Secondary Styles',
      'Landing Page Pattern',
      'Dashboard Style (if applicable)',
      'Color Palette Focus',
    ],
  },
  ux: {
    file: 'ux-guidelines.csv',
    searchColumns: ['Category', 'Issue', 'Description', 'Platform'],
    outputColumns: [
      'Category',
      'Issue',
      'Platform',
      'Description',
      'Do',
      "Don't",
      'Code Example Good',
      'Code Example Bad',
      'Severity',
    ],
  },
  typography: {
    file: 'typography.csv',
    searchColumns: [
      'Font Pairing Name',
      'Category',
      'Mood/Style Keywords',
      'Best For',
      'Heading Font',
      'Body Font',
    ],
    outputColumns: [
      'Font Pairing Name',
      'Category',
      'Heading Font',
      'Body Font',
      'Mood/Style Keywords',
      'Best For',
      'Google Fonts URL',
      'CSS Import',
      'Tailwind Config',
      'Notes',
    ],
  },
  icons: {
    file: 'icons.csv',
    searchColumns: ['Category', 'Icon Name', 'Keywords', 'Best For'],
    outputColumns: ['Category', 'Icon Name', 'Keywords', 'Library', 'Import Code', 'Usage', 'Best For', 'Style'],
  },
};

const STACK_CONFIG = {
  'html-tailwind': { file: 'stacks/html-tailwind.csv' },
  react: { file: 'stacks/react.csv' },
  nextjs: { file: 'stacks/nextjs.csv' },
  vue: { file: 'stacks/vue.csv' },
  nuxtjs: { file: 'stacks/nuxtjs.csv' },
  'nuxt-ui': { file: 'stacks/nuxt-ui.csv' },
  svelte: { file: 'stacks/svelte.csv' },
  swiftui: { file: 'stacks/swiftui.csv' },
  'react-native': { file: 'stacks/react-native.csv' },
  flutter: { file: 'stacks/flutter.csv' },
  shadcn: { file: 'stacks/shadcn.csv' },
};

const STACK_SEARCH_COLUMNS = ['Category', 'Guideline', 'Description', 'Do', "Don't"];
const STACK_OUTPUT_COLUMNS = [
  'Category',
  'Guideline',
  'Description',
  'Do',
  "Don't",
  'Code Good',
  'Code Bad',
  'Severity',
  'Docs URL',
];

const DOMAIN_KEYWORDS = {
  color: ['color', 'palette', 'hex', '#', 'rgb'],
  chart: [
    'chart',
    'graph',
    'visualization',
    'trend',
    'bar',
    'pie',
    'scatter',
    'heatmap',
    'funnel',
  ],
  landing: [
    'landing',
    'page',
    'cta',
    'conversion',
    'hero',
    'testimonial',
    'pricing',
    'section',
  ],
  product: [
    'saas',
    'ecommerce',
    'e-commerce',
    'fintech',
    'healthcare',
    'gaming',
    'portfolio',
    'crypto',
    'dashboard',
  ],
  prompt: ['prompt', 'css', 'implementation', 'variable', 'checklist', 'tailwind'],
  style: [
    'style',
    'design',
    'ui',
    'minimalism',
    'glassmorphism',
    'neumorphism',
    'brutalism',
    'dark mode',
    'flat',
    'aurora',
  ],
  ux: [
    'ux',
    'usability',
    'accessibility',
    'wcag',
    'touch',
    'scroll',
    'animation',
    'keyboard',
    'navigation',
    'mobile',
  ],
  typography: ['font', 'typography', 'heading', 'serif', 'sans'],
  icons: [
    'icon',
    'icons',
    'lucide',
    'heroicons',
    'symbol',
    'glyph',
    'pictogram',
    'svg icon',
  ],
};

function detectDomain(query) {
  const queryLower = String(query ?? '').toLowerCase();
  const scores = new Map();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        score += 1;
      }
    }
    scores.set(domain, score);
  }

  let bestDomain = 'style';
  let bestScore = 0;
  for (const [domain, score] of scores.entries()) {
    if (score > bestScore) {
      bestDomain = domain;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestDomain : 'style';
}

const AVAILABLE_DOMAINS = Object.keys(DOMAIN_CONFIG);
const AVAILABLE_STACKS = Object.keys(STACK_CONFIG);

module.exports = {
  DOMAIN_CONFIG,
  STACK_CONFIG,
  STACK_SEARCH_COLUMNS,
  STACK_OUTPUT_COLUMNS,
  detectDomain,
  AVAILABLE_DOMAINS,
  AVAILABLE_STACKS,
};

