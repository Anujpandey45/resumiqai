import type {
  AtsCategoryKey,
  AtsCheckReport,
  AtsCriterionScore,
  AtsDiagnosticIssue,
  AtsJobMatchBreakdown,
  AtsPassedCheck,
  AtsSynonymMatch,
} from '../types.ts';
import { normalizeExtractedText } from '../utils/textNormalize.ts';

export const HONEST_ATS_DISCLAIMER =
  'Estimated ATS Compatibility Score: This score is calculated deterministically from your extracted resume text and pasted job description across 10 weighted criteria totaling 100 points. It is not an actual employer’s proprietary ATS score—every company configures hiring software differently, and no score guarantees interview selection.';

/**
 * Curated dictionary of concrete technical, engineering, data, cloud, design,
 * product, finance, healthcare, and operations skills.
 */
export const KNOWN_SKILLS: string[] = [
  // Programming Languages & Core Web
  'javascript',
  'typescript',
  'python',
  'java',
  'c++',
  'c#',
  'golang',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'r',
  'sql',
  'nosql',
  'html',
  'css',
  'tailwind css',
  'sass',
  'graphql',
  'rest api',
  'grpc',
  'websockets',
  'microservices',
  // Frontend & Mobile Frameworks
  'react',
  'next.js',
  'redux',
  'vue',
  'nuxt',
  'angular',
  'svelte',
  'react native',
  'flutter',
  // Backend Frameworks
  'node.js',
  'express',
  'nestjs',
  'django',
  'flask',
  'fastapi',
  'spring boot',
  'asp.net',
  'laravel',
  'ruby on rails',
  // Databases & Data Engineering
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'sqlite',
  'oracle',
  'snowflake',
  'bigquery',
  'redshift',
  'elasticsearch',
  'firebase',
  'supabase',
  'dynamodb',
  'cassandra',
  'prisma',
  'drizzle',
  'apache spark',
  'kafka',
  'airflow',
  'dbt',
  'etl',
  // AI, ML & Analytics
  'machine learning',
  'deep learning',
  'natural language processing',
  'computer vision',
  'data analysis',
  'data science',
  'data visualization',
  'data engineering',
  'pandas',
  'numpy',
  'scikit-learn',
  'pytorch',
  'tensorflow',
  'power bi',
  'tableau',
  'looker',
  'excel',
  'statistics',
  'a/b testing',
  // Cloud, DevOps & Security
  'aws',
  'google cloud',
  'azure',
  'docker',
  'kubernetes',
  'helm',
  'terraform',
  'ansible',
  'jenkins',
  'github actions',
  'gitlab ci',
  'ci/cd',
  'linux',
  'bash',
  'nginx',
  'cybersecurity',
  'oauth',
  'jwt',
  'prometheus',
  'grafana',
  'datadog',
  'opentelemetry',
  // Testing & Developer Tools
  'git',
  'github',
  'jira',
  'confluence',
  'postman',
  'jest',
  'vitest',
  'cypress',
  'playwright',
  'selenium',
  'junit',
  'pytest',
  'unit testing',
  'integration testing',
  'test automation',
  // Design, Product & Business Operations
  'figma',
  'sketch',
  'adobe xd',
  'photoshop',
  'illustrator',
  'ui design',
  'ux design',
  'user research',
  'wireframing',
  'prototyping',
  'accessibility',
  'product management',
  'project management',
  'agile',
  'scrum',
  'kanban',
  'roadmap',
  'stakeholder management',
  'business analysis',
  'financial modeling',
  'accounting',
  'bookkeeping',
  'quickbooks',
  'salesforce',
  'hubspot',
  'crm',
  'seo',
  'sem',
  'google analytics',
  'content marketing',
  'email marketing',
  'copywriting',
  'social media marketing',
  'customer support',
  'customer success',
  'supply chain',
  'operations management',
  'human resources',
  'recruiting',
  'public speaking',
  'technical writing',
];

/**
 * Canonical synonym & variant table so equivalent technical terms
 * (e.g., "NodeJS" <-> "Node.js", "Postgres" <-> "PostgreSQL", "K8s" <-> "Kubernetes")
 * match accurately and transparently without rewarding unrelated buzzwords.
 */
export const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['javascript', 'js', 'es6', 'ecmascript'],
  typescript: ['typescript', 'ts'],
  golang: ['golang', 'go language'],
  'node.js': ['node.js', 'nodejs', 'node js'],
  'next.js': ['next.js', 'nextjs', 'next js'],
  react: ['react', 'reactjs', 'react.js'],
  'react native': ['react native', 'react-native'],
  vue: ['vue', 'vuejs', 'vue.js'],
  angular: ['angular', 'angularjs'],
  'ruby on rails': ['ruby on rails', 'rails'],
  'spring boot': ['spring boot', 'springboot'],
  'tailwind css': ['tailwind css', 'tailwindcss', 'tailwind'],
  postgresql: ['postgresql', 'postgres', 'psql'],
  mongodb: ['mongodb', 'mongo'],
  elasticsearch: ['elasticsearch', 'elastic search', 'opensearch'],
  'rest api': ['rest api', 'rest apis', 'restful api', 'restful apis', 'restful services'],
  microservices: ['microservices', 'microservice architecture'],
  'ci/cd': ['ci/cd', 'cicd', 'ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  aws: ['aws', 'amazon web services'],
  'google cloud': ['google cloud', 'gcp', 'google cloud platform'],
  azure: ['azure', 'microsoft azure'],
  kubernetes: ['kubernetes', 'k8s'],
  'c++': ['c++', 'cpp'],
  'c#': ['c#', 'csharp', 'c sharp'],
  'asp.net': ['asp.net', 'dotnet', '.net', '.net core'],
  'power bi': ['power bi', 'powerbi'],
  'github actions': ['github actions', 'gh actions'],
  'gitlab ci': ['gitlab ci', 'gitlab ci/cd'],
  'machine learning': ['machine learning', 'ml'],
  'deep learning': ['deep learning', 'neural networks'],
  'natural language processing': ['natural language processing', 'nlp'],
  'computer vision': ['computer vision', 'opencv'],
  'scikit-learn': ['scikit-learn', 'sklearn'],
  'a/b testing': ['a/b testing', 'ab testing', 'split testing'],
  'user research': ['user research', 'ux research'],
  'ui design': ['ui design', 'user interface design'],
  'ux design': ['ux design', 'user experience design'],
  accessibility: ['accessibility', 'wcag', 'a11y'],
  oauth: ['oauth', 'oauth2', 'oauth 2.0'],
  'unit testing': ['unit testing', 'unit tests'],
  'integration testing': ['integration testing', 'integration tests'],
};

const DISPLAY_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  golang: 'Golang',
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  dynamodb: 'DynamoDB',
  bigquery: 'BigQuery',
  nosql: 'NoSQL',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  'tailwind css': 'Tailwind CSS',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  'rest api': 'REST API',
  aws: 'AWS',
  'google cloud': 'Google Cloud (GCP)',
  'ci/cd': 'CI/CD',
  jwt: 'JWT',
  oauth: 'OAuth 2.0',
  etl: 'ETL',
  dbt: 'dbt',
  seo: 'SEO',
  sem: 'SEM',
  crm: 'CRM',
  'ui design': 'UI Design',
  'ux design': 'UX Design',
  'power bi': 'Power BI',
  'c++': 'C++',
  'c#': 'C#',
  'asp.net': 'ASP.NET',
  'a/b testing': 'A/B Testing',
  'github actions': 'GitHub Actions',
  'gitlab ci': 'GitLab CI',
  'scikit-learn': 'scikit-learn',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  opentelemetry: 'OpenTelemetry',
  datadog: 'Datadog',
  junit: 'JUnit',
};

const STOPWORDS = new Set([
  'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost', 'alone', 'along',
  'already', 'also', 'although', 'always', 'among', 'amount', 'and', 'another', 'any', 'anyone',
  'anything', 'anywhere', 'applicant', 'application', 'applications', 'apply', 'applying', 'are',
  'area', 'areas', 'around', 'able', 'ability', 'assigned', 'assist', 'assistance', 'available',
  'back', 'background', 'based', 'basic', 'become', 'been', 'before', 'being', 'below', 'benefits',
  'best', 'better', 'between', 'bonus', 'both', 'bring', 'build', 'building', 'business', 'but',
  'call', 'can', 'candidate', 'candidates', 'career', 'carefully', 'change', 'check', 'clean',
  'clear', 'closely', 'collaborate', 'collaboration', 'collaborative', 'college', 'come', 'comfortable',
  'communication', 'company', 'competitive', 'complete', 'complex', 'computer', 'concepts',
  'confident', 'consistent', 'contribute', 'core', 'could', 'create', 'creating', 'cross', 'culture',
  'current', 'currently', 'daily', 'date', 'day', 'days', 'degree', 'deliver', 'delivering',
  'delivery', 'demonstrated', 'department', 'dependable', 'description', 'desire', 'desired',
  'detail', 'detailed', 'details', 'develop', 'developing', 'development', 'different', 'direct',
  'directly', 'diverse', 'does', 'doing', 'done', 'drive', 'driven', 'driving', 'during', 'duties',
  'dynamic', 'each', 'eager', 'early', 'easy', 'education', 'effective', 'effectively', 'efficient',
  'either', 'email', 'empowers', 'employer', 'employment', 'ensure', 'ensuring', 'environment',
  'equal', 'equivalent', 'essential', 'etc', 'even', 'every', 'everyone', 'everything', 'excellent',
  'excited', 'existing', 'experience', 'experienced', 'familiar', 'familiarity', 'fast', 'field',
  'find', 'first', 'flexible', 'focus', 'focused', 'following', 'for', 'form', 'forward', 'found',
  'free', 'from', 'full', 'fully', 'function', 'functional', 'functions', 'further', 'future',
  'general', 'get', 'give', 'given', 'global', 'goal', 'goals', 'good', 'great', 'grow', 'growing',
  'growth', 'hands', 'have', 'having', 'health', 'help', 'helping', 'here', 'high', 'highly',
  'hire', 'hiring', 'history', 'hold', 'home', 'hours', 'how', 'however', 'ideal', 'ideally',
  'identify', 'impact', 'implement', 'implementing', 'important', 'improve', 'improving', 'include',
  'included', 'includes', 'including', 'independent', 'independently', 'individual', 'individuals',
  'industry', 'information', 'initiatives', 'innovative', 'inside', 'insurance', 'interest',
  'interested', 'internal', 'interpersonal', 'into', 'involved', 'its', 'job', 'join', 'joining',
  'junior', 'just', 'keep', 'key', 'kind', 'know', 'knowledge', 'known', 'large', 'latest', 'lead',
  'leading', 'learn', 'learning', 'least', 'level', 'levels', 'life', 'like', 'likely', 'line',
  'link', 'linkedin', 'list', 'listed', 'live', 'living', 'local', 'location', 'long', 'look',
  'looking', 'maintain', 'maintaining', 'major', 'make', 'making', 'manage', 'management', 'manager',
  'managing', 'many', 'medical', 'meet', 'meeting', 'member', 'members', 'mid', 'minimum', 'mission',
  'modern', 'month', 'months', 'more', 'most', 'motivated', 'move', 'moving', 'much', 'multiple',
  'must', 'name', 'national', 'need', 'needed', 'needs', 'new', 'next', 'nice', 'non', 'not',
  'note', 'now', 'number', 'objectives', 'off', 'offer', 'offers', 'office', 'often', 'one',
  'online', 'only', 'open', 'operate', 'operating', 'opportunity', 'optional', 'order', 'organization',
  'organizational', 'organizations', 'other', 'others', 'our', 'out', 'outcomes', 'overall', 'own',
  'owner', 'ownership', 'pace', 'paced', 'paid', 'part', 'participate', 'partner', 'partners',
  'passion', 'passionate', 'past', 'pay', 'people', 'per', 'perform', 'performance', 'performing',
  'person', 'personal', 'phone', 'place', 'plan', 'planning', 'plans', 'platform', 'platforms',
  'please', 'plus', 'point', 'points', 'policies', 'policy', 'position', 'positions', 'positive',
  'possible', 'post', 'practical', 'practices', 'preferred', 'prepare', 'present', 'previous',
  'primary', 'prior', 'proactive', 'problem', 'problems', 'procedures', 'process', 'processes',
  'produce', 'product', 'production', 'products', 'professional', 'proficiency', 'proficient',
  'program', 'programs', 'project', 'projects', 'proven', 'provide', 'providing', 'public',
  'qualifications', 'qualified', 'quality', 'questions', 'quick', 'quickly', 'range', 'ready',
  'real', 'receive', 'recent', 'record', 'related', 'relevant', 'reliable', 'remote', 'report',
  'reporting', 'reports', 'require', 'required', 'requirement', 'requirements', 'requires',
  'responsibilities', 'responsibility', 'responsible', 'results', 'resume', 'review', 'right',
  'role', 'roles', 'run', 'running', 'salary', 'same', 'scale', 'school', 'science', 'search',
  'section', 'see', 'seeking', 'self', 'senior', 'send', 'sense', 'service', 'services', 'set',
  'setting', 'several', 'share', 'shift', 'short', 'should', 'show', 'similar', 'simple', 'since',
  'site', 'size', 'skill', 'skilled', 'skills', 'small', 'software', 'solid', 'solution',
  'solutions', 'solve', 'solving', 'some', 'someone', 'something', 'specific', 'staff', 'stage',
  'standard', 'standards', 'start', 'starter', 'state', 'status', 'stay', 'step', 'steps', 'still',
  'strong', 'strongly', 'student', 'students', 'study', 'submit', 'success', 'successful',
  'successfully', 'such', 'summary', 'support', 'supporting', 'sure', 'system', 'systems', 'take',
  'taking', 'talent', 'tasks', 'team', 'teams', 'technical', 'technologies', 'technology', 'term',
  'terms', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'things', 'think', 'thinking', 'this', 'those', 'through', 'throughout', 'time', 'timely',
  'times', 'title', 'today', 'together', 'tool', 'tools', 'top', 'total', 'track', 'training',
  'translate', 'true', 'turn', 'two', 'type', 'types', 'under', 'understand', 'understanding',
  'unique', 'university', 'until', 'up', 'update', 'updates', 'upon', 'use', 'used', 'user',
  'users', 'using', 'usual', 'value', 'values', 'variety', 'various', 'verbal', 'very', 'via',
  'vision', 'visit', 'want', 'way', 'ways', 'web', 'website', 'week', 'weekly', 'weeks', 'well',
  'were', 'what', 'when', 'where', 'whether', 'which', 'while', 'who', 'whole', 'whose', 'why',
  'wide', 'will', 'willing', 'willingness', 'with', 'within', 'without', 'word', 'words', 'work',
  'working', 'workplace', 'works', 'world', 'would', 'write', 'writing', 'written', 'year',
  'years', 'you', 'your', 'yours',
]);

const ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'administered', 'analyzed', 'architected', 'authored', 'automated',
  'built', 'collaborated', 'configured', 'consolidated', 'constructed', 'coordinated', 'created',
  'Containerized'.toLowerCase(), 'cut', 'debugged', 'decreased', 'delivered', 'deployed', 'designed',
  'developed', 'devised', 'diagnosed', 'directed', 'documented', 'eliminated', 'engineered',
  'enhanced', 'established', 'evaluated', 'executed', 'expanded', 'expedited', 'facilitated',
  'formulated', 'founded', 'generated', 'guided', 'headed', 'identified', 'implemented', 'improved',
  'increased', 'initiated', 'integrated', 'introduced', 'launched', 'led', 'maintained', 'managed',
  'mentored', 'migrated', 'modeled', 'modernized', 'monitored', 'negotiated', 'operated', 'optimized',
  'orchestrated', 'organized', 'overhauled', 'partnered', 'performed', 'pioneered', 'planned',
  'prepared', 'presented', 'prioritized', 'produced', 'programmed', 'provisioned', 'published',
  'rebuilt', 'reduced', 'refactored', 'redesigned', 'reengineered', 'resolved', 'restructured',
  'revamped', 'scaled', 'secured', 'shipped', 'simplified', 'solved', 'spearheaded', 'standardized',
  'streamlined', 'strengthened', 'structured', 'supervised', 'supported', 'surpassed', 'tested',
  'trained', 'transformed', 'troubleshot', 'unified', 'upgraded', 'validated', 'verified', 'wrote',
]);

const WEAK_PASSIVE_PHRASES = [
  'responsible for',
  'worked on',
  'helped with',
  'assisted with',
  'duties included',
  'tasked with',
  'was involved in',
];

/**
 * Deterministic dictionary of frequent real-world resume misspellings.
 */
const COMMON_MISSPELLINGS: Record<string, string> = {
  accomodate: 'accommodate',
  acheive: 'achieve',
  acheived: 'achieved',
  acheivement: 'achievement',
  acheivements: 'achievements',
  algoritm: 'algorithm',
  algoritms: 'algorithms',
  analisys: 'analysis',
  architechture: 'architecture',
  assesment: 'assessment',
  assistane: 'assistance',
  bacheler: 'bachelor',
  buisness: 'business',
  calender: 'calendar',
  certifcation: 'certification',
  certifcations: 'certifications',
  collabaration: 'collaboration',
  collaboarated: 'collaborated',
  commited: 'committed',
  communicaton: 'communication',
  compatable: 'compatible',
  continous: 'continuous',
  curricullum: 'curriculum',
  databse: 'database',
  databses: 'databases',
  definately: 'definitely',
  deplyed: 'deployed',
  developement: 'development',
  developper: 'developer',
  diffrent: 'different',
  efficency: 'efficiency',
  efficent: 'efficient',
  enginner: 'engineer',
  enginnering: 'engineering',
  enviroment: 'environment',
  enviroments: 'environments',
  experiance: 'experience',
  experianced: 'experienced',
  familar: 'familiar',
  framwork: 'framework',
  fuctional: 'functional',
  governement: 'government',
  implmented: 'implemented',
  implementaton: 'implementation',
  improvment: 'improvement',
  independant: 'independent',
  infrastruture: 'infrastructure',
  intgration: 'integration',
  javscript: 'JavaScript',
  knowlege: 'knowledge',
  kuberenetes: 'Kubernetes',
  langauge: 'language',
  langauges: 'languages',
  leadershipp: 'leadership',
  liason: 'liaison',
  maintenence: 'maintenance',
  managment: 'management',
  manger: 'manager',
  microservcies: 'microservices',
  occured: 'occurred',
  optimzation: 'optimization',
  organiztion: 'organization',
  perforamnce: 'performance',
  performace: 'performance',
  postgersql: 'PostgreSQL',
  prefered: 'preferred',
  probelm: 'problem',
  profesional: 'professional',
  profficent: 'proficient',
  progamming: 'programming',
  pyhton: 'Python',
  qualtiy: 'quality',
  recieve: 'receive',
  recieved: 'received',
  recomendation: 'recommendation',
  refered: 'referred',
  relavant: 'relevant',
  requirments: 'requirements',
  responsibilites: 'responsibilities',
  responsiblity: 'responsibility',
  scalabe: 'scalable',
  seperate: 'separate',
  seperated: 'separated',
  softare: 'software',
  succesful: 'successful',
  succesfully: 'successfully',
  supervized: 'supervised',
  techincal: 'technical',
  technolgies: 'technologies',
  teh: 'the',
  typescipt: 'TypeScript',
  universiy: 'university',
  utilzed: 'utilized',
  wiht: 'with',
};

export type ParsedSectionName =
  | 'header'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'achievements'
  | 'education'
  | 'certifications';

export interface ParsedResumeSections {
  normalizedText: string;
  allLines: string[];
  sections: Record<ParsedSectionName, string[]>;
  detectedHeadingKeys: Set<Exclude<ParsedSectionName, 'header'>>;
  detectedSectionLabels: string[];
}

const SECTION_HEADING_PATTERNS: {
  key: Exclude<ParsedSectionName, 'header'>;
  label: string;
  regex: RegExp;
}[] = [
  {
    key: 'summary',
    label: 'Professional Summary',
    regex:
      /^(?:professional\s+summary|executive\s+summary|career\s+summary|summary\s+of\s+qualifications|summary|career\s+objective|professional\s+objective|objective|professional\s+profile|profile|about\s+me)$/i,
  },
  {
    key: 'skills',
    label: 'Technical Skills',
    regex:
      /^(?:technical\s+skills|skills\s*(?:&|and)\s*technologies|core\s+skills|key\s+skills|skills\s*(?:&|and)\s*tools|core\s+competencies|skills|technologies|tech\s+stack|tools\s*(?:&|and)\s*technologies|areas\s+of\s+expertise|programming\s+skills)$/i,
  },
  {
    key: 'experience',
    label: 'Work Experience',
    regex:
      /^(?:work\s+experience|professional\s+experience|relevant\s+experience|employment\s+history|work\s+history|career\s+history|internship\s+experience|internships?\s*(?:&|and)?\s*experience|internships?|experience|employment)$/i,
  },
  {
    key: 'projects',
    label: 'Projects',
    regex:
      /^(?:technical\s+projects|academic\s+projects|personal\s+projects|selected\s+projects|key\s+projects|software\s+projects|engineering\s+projects|projects\s*(?:&|and)\s*achievements|projects?)$/i,
  },
  {
    key: 'achievements',
    label: 'Achievements & Awards',
    regex:
      /^(?:achievements\s*(?:&|and)\s*awards|honors\s*(?:&|and)\s*awards|awards\s*(?:&|and)\s*achievements|key\s+achievements|accomplishments|achievements|awards|honors|leadership\s*(?:&|and)\s*activities)$/i,
  },
  {
    key: 'education',
    label: 'Education',
    regex:
      /^(?:education\s*(?:&|and)\s*training|educational\s+background|academic\s+background|educational\s+qualifications|academic\s+qualifications|education|academics)$/i,
  },
  {
    key: 'certifications',
    label: 'Certifications',
    regex:
      /^(?:licenses?\s*(?:&|and)\s*certifications?|professional\s+certifications?|courses?\s*(?:&|and)\s*certifications?|training\s*(?:&|and)\s*certifications?|certifications?|certificates?)$/i,
  },
];

function detectHeadingLine(rawLine: string): {
  key: Exclude<ParsedSectionName, 'header'>;
  label: string;
  inlineRemainder: string;
} | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;
  // Bullet lines are never standalone section headings
  if (/^[•\-*▪◦➢►]\s+/.test(trimmed)) return null;

  // Strip optional leading section numbering (e.g. "1. EDUCATION" or "II. SKILLS") and decorative borders
  const withoutDecor = trimmed
    .replace(/^(?:\d+\.|[IVX]+\.)\s+/i, '')
    .replace(/^[_=\-#*|]+\s*|\s*[_=\-#*|]+$/g, '')
    .trim();

  // Support both standalone headings ("TECHNICAL SKILLS" / "Skills:") and colon headings with inline content ("Skills: Python, SQL, React")
  const colonIdx = withoutDecor.indexOf(':');
  if (colonIdx > 0) {
    const candidateHead = withoutDecor.slice(0, colonIdx).trim();
    const remainder = withoutDecor.slice(colonIdx + 1).trim();
    if (candidateHead.length <= 38 && candidateHead.split(/\s+/).length <= 5) {
      for (const def of SECTION_HEADING_PATTERNS) {
        if (def.regex.test(candidateHead)) {
          return {
            key: def.key,
            label: def.label,
            inlineRemainder: remainder,
          };
        }
      }
    }
  }

  if (withoutDecor.length > 46 || withoutDecor.split(/\s+/).length > 5) {
    return null;
  }
  if (withoutDecor.endsWith('.')) {
    return null;
  }

  const cleanCandidate = withoutDecor.replace(/:$/, '').trim();
  for (const def of SECTION_HEADING_PATTERNS) {
    if (def.regex.test(cleanCandidate)) {
      return {
        key: def.key,
        label: def.label,
        inlineRemainder: '',
      };
    }
  }

  return null;
}

/**
 * Segments extracted resume text into structured sections without ever dropping a single line.
 */
export function parseResumeSections(rawText: string): ParsedResumeSections {
  const normalizedText = normalizeExtractedText(rawText || '');
  const rawLines = normalizedText.split('\n');
  const allLines: string[] = [];

  const sections: Record<ParsedSectionName, string[]> = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    achievements: [],
    education: [],
    certifications: [],
  };

  const detectedHeadingKeys = new Set<Exclude<ParsedSectionName, 'header'>>();
  const detectedSectionLabels: string[] = [];
  let currentSection: ParsedSectionName = 'header';

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    allLines.push(trimmed);

    const headingMatch = detectHeadingLine(trimmed);
    if (headingMatch) {
      currentSection = headingMatch.key;
      if (!detectedHeadingKeys.has(headingMatch.key)) {
        detectedHeadingKeys.add(headingMatch.key);
        detectedSectionLabels.push(headingMatch.label);
      }
      if (headingMatch.inlineRemainder) {
        sections[currentSection].push(headingMatch.inlineRemainder);
      }
      continue;
    }

    sections[currentSection].push(trimmed);
  }

  return {
    normalizedText,
    allLines,
    sections,
    detectedHeadingKeys,
    detectedSectionLabels,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatDisplayTerm(term: string): string {
  const lower = term.toLowerCase();
  if (DISPLAY_NAMES[lower]) return DISPLAY_NAMES[lower];
  return term
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function findMatchingVariantInText(normalizedCorpus: string, canonicalTerm: string): string | null {
  const variants = SKILL_ALIASES[canonicalTerm] || [canonicalTerm];
  for (const variant of variants) {
    // Single-letter language "r" requires strict programming context or uppercase token boundary
    if (variant === 'r') {
      if (/(?:^|[,/|•(\s])R(?=$|[,/|•)\s])/.test(normalizedCorpus)) {
        return 'R';
      }
      continue;
    }
    const escaped = escapeRegExp(variant.toLowerCase());
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
    const match = normalizedCorpus.match(pattern);
    if (match) {
      return match[0].replace(/^[^a-zA-Z0-9.#+]+/, '').trim() || variant;
    }
  }
  return null;
}

export function containsCanonicalTerm(normalizedCorpus: string, canonicalTerm: string): boolean {
  return findMatchingVariantInText(normalizedCorpus, canonicalTerm) !== null;
}

function countTermOccurrences(normalizedCorpus: string, canonicalTerm: string): number {
  const variants = SKILL_ALIASES[canonicalTerm] || [canonicalTerm];
  let total = 0;
  for (const variant of variants) {
    if (variant === 'r') continue;
    const escaped = escapeRegExp(variant.toLowerCase());
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'gi');
    const matches = normalizedCorpus.match(pattern);
    if (matches) {
      total += matches.length;
    }
  }
  return total;
}

export interface KeywordStuffingAnalysis {
  keywordStuffingDetected: boolean;
  stuffedTerms: string[];
  reason: string | null;
}

/**
 * Detects unnatural keyword repetition or uncontextualized buzzword blocks
 * so keyword stuffing never boosts ATS scores and instead triggers a clear warning.
 */
export function detectKeywordStuffing(
  resumeText: string,
  totalWords: number
): KeywordStuffingAnalysis {
  if (totalWords < 15) {
    return { keywordStuffingDetected: false, stuffedTerms: [], reason: null };
  }

  const stuffedSet = new Set<string>();

  // 1. Check excessive repetition of any technical skill relative to resume length
  for (const sk of KNOWN_SKILLS) {
    if (sk === 'r') continue;
    const occurrences = countTermOccurrences(resumeText, sk);
    const density = occurrences / Math.max(1, totalWords);
    if (occurrences >= 8 && density >= 0.032) {
      stuffedSet.add(formatDisplayTerm(sk));
    }
  }

  // 2. Check consecutive repeated tokens on the same line (e.g. "Python Python Python" or "React, React, React")
  const repeatedSeqRegex = /\b([a-z][a-z0-9+#.-]{2,})(?:[\s,|•/]+\1){3,}\b/gi;
  let seqMatch: RegExpExecArray | null;
  while ((seqMatch = repeatedSeqRegex.exec(resumeText)) !== null) {
    const tok = seqMatch[1];
    if (!STOPWORDS.has(tok.toLowerCase()) && !/^\d+$/.test(tok)) {
      stuffedSet.add(formatDisplayTerm(tok));
    }
  }

  // 3. Check general non-stopword token frequency spikes (>= 11 repeats and > 4.5% of entire resume)
  const rawTokens = resumeText
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  const tokenCounts = new Map<string, number>();
  for (const t of rawTokens) {
    tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
  }
  for (const [tok, count] of tokenCounts.entries()) {
    if (count >= 11 && count / Math.max(1, totalWords) >= 0.045) {
      stuffedSet.add(formatDisplayTerm(tok));
    }
  }

  const stuffedTerms = Array.from(stuffedSet).slice(0, 8);
  if (stuffedTerms.length === 0) {
    return { keywordStuffingDetected: false, stuffedTerms: [], reason: null };
  }

  return {
    keywordStuffingDetected: true,
    stuffedTerms,
    reason: `Unnatural keyword repetition detected (${stuffedTerms.join(', ')}). Modern ATS software flags repeated keyword blocks—mention each skill naturally in your Skills section and project/work bullets.`,
  };
}

export interface ParsedJobRequirements {
  requiredSkills: string[];
  preferredSkills: string[];
  roleKeywords: string[];
  jdSurfaceForms: Map<string, string>;
}

const PREFERRED_HEADING_CUE =
  /^(?:preferred|nice\s+to\s+have|bonus|desired|good\s+to\s+have|plus|pluses|optional|additional\s+qualifications)/i;
const REQUIRED_HEADING_CUE =
  /^(?:requirements|required|minimum\s+qualifications|basic\s+qualifications|must\s+have|what\s+you\s+bring|qualifications|responsibilities|what\s+you['’]?ll\s+do|tech\s+stack)/i;
const PREFERRED_LINE_CUE =
  /\b(?:preferred|nice\s+to\s+have|is\s+a\s+plus|a\s+plus|bonus\s+points?|bonus\s*:|ideally|desirable|good\s+to\s+have)\b/i;

/**
 * Separates Job Description skills into Required vs Preferred and extracts significant domain keywords.
 */
export function parseJobDescriptionRequirements(jdText: string): ParsedJobRequirements {
  const normalizedJd = normalizeExtractedText(jdText || '');
  const lines = normalizedJd
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const requiredLines: string[] = [];
  const preferredLines: string[] = [];

  let currentZone: 'required' | 'preferred' = 'required';

  for (const line of lines) {
    const cleanHead = line.replace(/^[•\-*▪◦\d.)\s]+/, '').replace(/:$/, '').trim();
    if (cleanHead.length <= 52 && cleanHead.split(/\s+/).length <= 7) {
      if (PREFERRED_HEADING_CUE.test(cleanHead)) {
        currentZone = 'preferred';
        continue;
      }
      if (REQUIRED_HEADING_CUE.test(cleanHead)) {
        currentZone = 'required';
        continue;
      }
    }

    if (PREFERRED_LINE_CUE.test(line)) {
      preferredLines.push(line);
    } else if (currentZone === 'preferred') {
      preferredLines.push(line);
    } else {
      requiredLines.push(line);
    }
  }

  const requiredCorpus = requiredLines.join('\n');
  const preferredCorpus = preferredLines.join('\n');

  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const jdSurfaceForms = new Map<string, string>();
  const capturedSkillSet = new Set<string>();

  for (const sk of KNOWN_SKILLS) {
    const reqSurface = findMatchingVariantInText(requiredCorpus, sk);
    const prefSurface = findMatchingVariantInText(preferredCorpus, sk);

    if (reqSurface) {
      requiredSkills.push(sk);
      capturedSkillSet.add(sk);
      jdSurfaceForms.set(sk, reqSurface);
    } else if (prefSurface) {
      preferredSkills.push(sk);
      capturedSkillSet.add(sk);
      jdSurfaceForms.set(sk, prefSurface);
    }
  }

  // Extract additional meaningful domain/role keywords from the required JD section
  // (excluding generic JD prose verbs/adjectives, stopwords, and already-captured skills)
  const jdFillerWords = new Set([
    'automated', 'building', 'comprehensive', 'designing', 'deploying', 'engineer',
    'engineering', 'qualifications', 'registered', 'relational', 'strong', 'proven',
  ]);
  const keywordSource = requiredCorpus.trim() ? requiredCorpus : normalizedJd;
  const lowerTokens = keywordSource
    .toLowerCase()
    .replace(/[^a-z0-9+#./\-\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[./-]+|[./-]+$/g, ''))
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t));

  const freq = new Map<string, number>();
  for (const tok of lowerTokens) {
    if (STOPWORDS.has(tok) || jdFillerWords.has(tok)) continue;
    if (capturedSkillSet.has(tok)) continue;

    let partOfCapturedSkill = false;
    for (const sk of capturedSkillSet) {
      const variants = SKILL_ALIASES[sk] || [sk];
      if (variants.some((v) => v.toLowerCase().split(/\s+/).includes(tok))) {
        partOfCapturedSkill = true;
        break;
      }
    }
    if (partOfCapturedSkill) continue;

    freq.set(tok, (freq.get(tok) || 0) + 1);
  }

  const roleKeywords = Array.from(freq.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 10)
    .map(([word]) => word);

  return {
    requiredSkills,
    preferredSkills,
    roleKeywords,
    jdSurfaceForms,
  };
}

function stemEnglishKeyword(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 5) return w;
  return w.replace(/(?:ized|izing|ation|ments|ment|ings|ing|ers|ies|es|ed|s)$/, '');
}

function containsKeywordOrInflection(normalizedCorpus: string, keyword: string): boolean {
  if (containsCanonicalTerm(normalizedCorpus, keyword)) return true;
  const stem = stemEnglishKeyword(keyword);
  if (stem.length < 5) return false;
  const escapedStem = escapeRegExp(stem);
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapedStem}[a-z]{0,5}(?=$|[^a-z0-9])`, 'i');
  return pattern.test(normalizedCorpus);
}

export interface GrammarEvaluationResult {
  issues: string[];
  misspelledExamples: string[];
  repeatedWordExamples: string[];
  hasLowercasePronounI: boolean;
  lowercaseBulletCount: number;
}

/**
 * Deterministic spelling, repeated-word, capitalization, and punctuation checker.
 */
export function evaluateGrammarAndSpelling(
  normalizedText: string,
  allLines: string[]
): GrammarEvaluationResult {
  const issues: string[] = [];
  const misspelledExamples: string[] = [];
  const repeatedWordExamples: string[] = [];

  // 1. Check words against curated common resume misspellings
  const wordMatches = normalizedText.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const seenTypos = new Set<string>();
  for (const rawWord of wordMatches) {
    const lower = rawWord.toLowerCase();
    const correction = COMMON_MISSPELLINGS[lower];
    if (correction && !seenTypos.has(lower)) {
      seenTypos.add(lower);
      misspelledExamples.push(`"${rawWord}" -> "${correction}"`);
    }
  }
  if (misspelledExamples.length > 0) {
    issues.push(
      `Spelling error(s) found: ${misspelledExamples.slice(0, 5).join(', ')}.`
    );
  }

  // 2. Check consecutive duplicate words (e.g. "the the", "built built")
  const dupRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
  let dupMatch: RegExpExecArray | null;
  const seenDups = new Set<string>();
  while ((dupMatch = dupRegex.exec(normalizedText)) !== null) {
    const w = dupMatch[1].toLowerCase();
    // Ignore legitimate double letters/acronyms like "C++", "Java EE"
    if (w.length >= 2 && !seenDups.has(w)) {
      seenDups.add(w);
      repeatedWordExamples.push(`"${dupMatch[1]} ${dupMatch[1]}"`);
    }
  }
  if (repeatedWordExamples.length > 0) {
    issues.push(
      `Repeated consecutive word(s) detected: ${repeatedWordExamples.slice(0, 4).join(', ')}.`
    );
  }

  // 3. Check lowercase standalone pronoun "i" in verb clauses
  const hasLowercasePronounI =
    /(?:^|\s)i\s+(?:am|was|have|had|will|built|worked|created|developed|designed|led|managed)\b/.test(
      normalizedText
    );
  if (hasLowercasePronounI) {
    issues.push(
      'Lowercase first-person pronoun "i" detected; remove first-person pronouns and start bullets with capitalized action verbs.'
    );
  }

  // 4. Check bullets starting with lowercase letters
  let lowercaseBulletCount = 0;
  for (const line of allLines) {
    const bulletBody = line.replace(/^[•\-*▪◦]\s+/, '');
    if (bulletBody !== line && /^[a-z]/.test(bulletBody)) {
      // Allow technical camelCase brand names like "iOS", "eBay", "jQuery", "dbt"
      if (!/^(?:iOS|iPhone|iPad|eBay|jQuery|dbt|gRPC|npm)\b/.test(bulletBody)) {
        lowercaseBulletCount++;
      }
    }
  }
  if (lowercaseBulletCount >= 2) {
    issues.push(
      `${lowercaseBulletCount} bullet points start with a lowercase letter instead of a capitalized action verb.`
    );
  }

  // 5. Check double punctuation errors ("..", ",,", ";;") excluding ellipsis "..."
  if (/(?<!\.)\.\.(?!\.)|,,|;;/.test(normalizedText)) {
    issues.push('Repeated punctuation marks (such as ".." or ",,") were found.');
  }

  return {
    issues,
    misspelledExamples,
    repeatedWordExamples,
    hasLowercasePronounI,
    lowercaseBulletCount,
  };
}

function looksLikeCandidateName(headerLines: string[], allLines: string[]): boolean {
  const candidates = (headerLines.length > 0 ? headerLines : allLines).slice(0, 4);
  for (const rawLine of candidates) {
    // Strip contact pipes if name + contact are on line 1 ("Jane Doe | jane@email.com")
    const firstSegment = rawLine.split(/[|•]/)[0].trim();
    if (!firstSegment) continue;
    if (/@|https?:\/\/|\d{3,}/.test(firstSegment)) continue;
    if (detectHeadingLine(firstSegment)) continue;

    const words = firstSegment.split(/\s+/).filter(Boolean);
    if (
      words.length >= 2 &&
      words.length <= 5 &&
      firstSegment.length >= 5 &&
      firstSegment.length <= 48 &&
      words.every((w) => /^[A-Z][a-zA-Z'’.-]*$/.test(w))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * CENTRALIZED DETERMINISTIC ATS SCORING ENGINE
 * - Evaluates all 10 required categories with exact integer weights totaling 100.
 * - Identical resume + identical job description ALWAYS produce identical results.
 * - Zero random scores, zero baseline inflation, zero fake passed checks, zero duplicate issues.
 */
export function computeDeterministicAtsReport(params: {
  resumeText: string;
  fileName: string;
  pageCount?: number;
  structuralNotes?: string[];
  jobDescription?: string;
}): AtsCheckReport {
  const parsedResume = parseResumeSections(params.resumeText || '');
  const resumeRaw = parsedResume.normalizedText;
  const allLines = parsedResume.allLines;
  const { sections, detectedHeadingKeys, detectedSectionLabels } = parsedResume;

  const jdRaw = normalizeExtractedText(params.jobDescription || '');
  const hasJobDescription = jdRaw.length >= 25;
  const structuralNotes = params.structuralNotes || [];

  const words = resumeRaw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const pageCount = params.pageCount || Math.max(1, Math.ceil(Math.max(1, wordCount) / 450));

  // Category weight table — strictly sums to 100 in BOTH modes
  const WEIGHTS: Record<AtsCategoryKey, number> = hasJobDescription
    ? {
        formatting_readability: 12,
        contact_information: 8,
        professional_summary: 7,
        technical_skills: 15,
        jd_keyword_matching: 20,
        work_experience: 14,
        projects_achievements: 10,
        education: 6,
        certifications: 3,
        grammar_spelling: 5,
      }
    : {
        formatting_readability: 16,
        contact_information: 10,
        professional_summary: 9,
        technical_skills: 20,
        jd_keyword_matching: 0,
        work_experience: 17,
        projects_achievements: 12,
        education: 7,
        certifications: 3,
        grammar_spelling: 6,
      };

  // Deduplicated diagnostic maps & verified passed checks
  const criticalMap = new Map<string, AtsDiagnosticIssue>();
  const warningMap = new Map<string, AtsDiagnosticIssue>();
  const passedMap = new Map<string, AtsPassedCheck>();

  const addIssue = (issue: AtsDiagnosticIssue) => {
    if (issue.severity === 'critical') {
      if (!criticalMap.has(issue.id)) {
        criticalMap.set(issue.id, issue);
        warningMap.delete(issue.id);
      }
    } else {
      if (!criticalMap.has(issue.id) && !warningMap.has(issue.id)) {
        warningMap.set(issue.id, issue);
      }
    }
  };

  const addPassed = (check: AtsPassedCheck) => {
    if (!passedMap.has(check.id)) {
      passedMap.set(check.id, check);
    }
  };

  const stuffing = detectKeywordStuffing(resumeRaw, wordCount);
  const grammar = evaluateGrammarAndSpelling(resumeRaw, allLines);

  // ===========================================================================
  // CATEGORY 1: RESUME FORMATTING & READABILITY (12 pts w/ JD | 16 pts w/o JD)
  // ===========================================================================
  const formatMax = WEIGHTS.formatting_readability;
  const subLayoutMax = hasJobDescription ? 3 : 4;
  const subLengthMax = hasJobDescription ? 3 : 4;
  const subHeadingsMax = hasJobDescription ? 3 : 4;
  const subBulletsMax = hasJobDescription ? 3 : 4;

  let formatPts = formatMax;
  const formatDeductions: string[] = [];
  const formattingIssues: string[] = [];

  const hasTableWarning = structuralNotes.some((n) => n.toLowerCase().includes('table'));
  const hasMultiColumnWarning = structuralNotes.some((n) =>
    n.toLowerCase().includes('multi-column')
  );
  const hasImageWarning = structuralNotes.some((n) => n.toLowerCase().includes('image'));

  // 1a. Single-column / table-free / graphic-free structure
  let layoutLoss = 0;
  if (hasTableWarning) {
    layoutLoss = subLayoutMax;
    const msg =
      'Document uses Word layout tables (<table>), which can scramble reading order in legacy ATS parsers.';
    formattingIssues.push(msg);
    formatDeductions.push(`-${layoutLoss} pts: ${msg}`);
    addIssue({
      id: 'layout_tables_detected',
      severity: 'critical',
      category: 'Resume Formatting & Readability',
      title: 'Layout tables detected in resume document',
      explanation:
        'Multi-column Word tables frequently cause older ATS parsers to merge unrelated columns onto the same line.',
      solution:
        'Convert all tables to plain single-column text with standard section headings and bullet points.',
    });
  } else {
    if (hasMultiColumnWarning) {
      const deduct = Math.min(subLayoutMax, hasJobDescription ? 2 : 3);
      layoutLoss += deduct;
      const msg =
        'Multi-column PDF layout detected. While our coordinate parser separated your columns, some older employer ATS tools read straight across columns.';
      formattingIssues.push(msg);
      formatDeductions.push(`-${deduct} pts: Multi-column PDF layout risks column-merging in older ATS parsers.`);
      addIssue({
        id: 'multi_column_pdf',
        severity: 'warning',
        category: 'Resume Formatting & Readability',
        title: 'Multi-column PDF layout may confuse older ATS parsers',
        explanation:
          'Two-column sidebars place independent sections side by side, which simple text extractors sometimes interleave.',
        solution:
          'Use a clean single-column layout so every employer ATS reads your sections top-to-bottom reliably.',
      });
    }
    if (hasImageWarning && layoutLoss < subLayoutMax) {
      const deduct = Math.min(subLayoutMax - layoutLoss, 1);
      layoutLoss += deduct;
      const msg = 'Embedded images or graphic icons were detected; ATS parsers ignore graphics.';
      formattingIssues.push(msg);
      formatDeductions.push(`-${deduct} pt: ${msg}`);
      addIssue({
        id: 'embedded_images',
        severity: 'warning',
        category: 'Resume Formatting & Readability',
        title: 'Embedded images or icons detected',
        explanation:
          'Profile photos, skill progress bars, and contact icons cannot be parsed as text by ATS software.',
        solution:
          'Remove embedded images and write contact details and skills as plain selectable text.',
      });
    }
  }
  formatPts -= layoutLoss;

  // 1b. Word count & page length
  let lengthLoss = 0;
  if (wordCount < 100) {
    lengthLoss = subLengthMax;
    const msg = `Resume is severely brief (${wordCount} words), providing insufficient detail for ATS or recruiter evaluation.`;
    formattingIssues.push(msg);
    formatDeductions.push(`-${lengthLoss} pts: ${msg}`);
    addIssue({
      id: 'severely_thin_content',
      severity: 'critical',
      category: 'Resume Formatting & Readability',
      title: `Severely thin resume content (${wordCount} words)`,
      explanation:
        'Resumes under 100 words lack enough substantive project, skill, or experience evidence to evaluate.',
      solution:
        'Expand your Experience, Projects, Education, and Skills sections to 300–650 words of concrete accomplishments.',
    });
  } else if (wordCount < 180) {
    lengthLoss = hasJobDescription ? 2 : 3;
    const msg = `Resume content is thin (${wordCount} words; aim for 280–650 words).`;
    formattingIssues.push(msg);
    formatDeductions.push(`-${lengthLoss} pts: ${msg}`);
    addIssue({
      id: 'suboptimal_length',
      severity: 'warning',
      category: 'Resume Formatting & Readability',
      title: `Resume is shorter than recommended (${wordCount} words)`,
      explanation:
        'Short resumes often omit technical tools, project architecture, or measurable outcomes.',
      solution:
        'Add 2–4 concise action-verb bullet points per role or project explaining what you built and how.',
    });
  } else if (pageCount > 2 || wordCount > 1200) {
    lengthLoss = 2;
    const msg =
      pageCount > 2
        ? `Resume spans ${pageCount} pages (1–2 pages is standard for ATS and recruiter review).`
        : `Resume is overly dense (${wordCount} words; aim for concise 1–2 line bullets under 900 words).`;
    formattingIssues.push(msg);
    formatDeductions.push(`-${lengthLoss} pts: ${msg}`);
    addIssue({
      id: 'suboptimal_length',
      severity: 'warning',
      category: 'Resume Formatting & Readability',
      title: pageCount > 2 ? `Resume exceeds 2 pages (${pageCount} pages)` : 'Resume text is overly dense',
      explanation:
        'Overly long resumes dilute core technical qualifications during rapid recruiter screening.',
      solution:
        'Trim older or repetitive bullets so your strongest relevant experience fits cleanly within 1–2 pages.',
    });
  }
  formatPts -= lengthLoss;

  // 1c. Standard recognizable section headings
  const coreHeadingsCount = [
    detectedHeadingKeys.has('education'),
    detectedHeadingKeys.has('skills'),
    detectedHeadingKeys.has('experience') || detectedHeadingKeys.has('projects'),
    detectedHeadingKeys.has('summary') ||
      (detectedHeadingKeys.has('experience') && detectedHeadingKeys.has('projects')),
  ].filter(Boolean).length;

  let headingLoss = 0;
  if (detectedHeadingKeys.size === 0 || coreHeadingsCount <= 1) {
    headingLoss = subHeadingsMax;
    const msg =
      'Standard section headings (such as "Education", "Technical Skills", "Work Experience", "Projects") are missing or non-standard.';
    formattingIssues.push(msg);
    formatDeductions.push(`-${headingLoss} pts: ${msg}`);
  } else if (coreHeadingsCount < 3) {
    headingLoss = hasJobDescription ? 1 : 2;
    const msg = `Only ${detectedSectionLabels.length} standard section heading(s) detected (${detectedSectionLabels.join(', ') || 'none'}).`;
    formattingIssues.push(msg);
    formatDeductions.push(`-${headingLoss} ${headingLoss === 1 ? 'pt' : 'pts'}: ${msg}`);
  }
  formatPts -= headingLoss;

  // 1d. Bullet scannability & paragraph density
  const explicitBullets = allLines.filter((l) => /^[•\-*▪◦]\s+/.test(l));
  const actionLeadLines = allLines.filter((l) => {
    const cleaned = l.replace(/^[•\-*▪◦\d.)\s]+/, '').trim();
    const first = (cleaned.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    return cleaned.split(/\s+/).length >= 5 && ACTION_VERBS.has(first);
  });
  const effectiveBulletCount = Math.max(explicitBullets.length, actionLeadLines.length);
  const hasWallOfText = allLines.some((l) => l.split(/\s+/).length > 85);

  let bulletFormatLoss = 0;
  if (effectiveBulletCount < 2) {
    bulletFormatLoss += hasJobDescription ? 2 : 3;
    const msg =
      'Very few structured bullet points were detected; dense prose blocks are harder for ATS and recruiters to scan.';
    formattingIssues.push(msg);
    formatDeductions.push(
      `-${hasJobDescription ? 2 : 3} pts: Fewer than 2 structured bullet points detected.`
    );
  } else if (effectiveBulletCount < 4) {
    bulletFormatLoss += 1;
    const msg = `Only ${effectiveBulletCount} bullet points detected; use 2–4 bullets per project or work entry.`;
    formattingIssues.push(msg);
    formatDeductions.push(`-1 pt: ${msg}`);
  }

  if ((hasWallOfText || stuffing.keywordStuffingDetected) && bulletFormatLoss < subBulletsMax) {
    const extra = Math.min(subBulletsMax - bulletFormatLoss, 1);
    bulletFormatLoss += extra;
    const msg = hasWallOfText
      ? 'One or more paragraphs exceed 85 words without bullet breaks.'
      : 'Repeated keyword blocks reduce document readability.';
    formattingIssues.push(msg);
    formatDeductions.push(`-${extra} pt: ${msg}`);
  }
  formatPts = Math.max(0, formatPts - bulletFormatLoss);

  if (
    layoutLoss === 0 &&
    lengthLoss === 0 &&
    headingLoss === 0 &&
    bulletFormatLoss === 0 &&
    wordCount >= 180
  ) {
    addPassed({
      id: 'single_column_clean_format',
      category: 'Resume Formatting & Readability',
      detail: `Clean single-column structure (${wordCount} words, ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}) with standard headings and scannable bullet points.`,
    });
  }

  // ===========================================================================
  // CATEGORY 2: CONTACT INFORMATION (8 pts w/ JD | 10 pts w/o JD)
  // ===========================================================================
  const contactMax = WEIGHTS.contact_information;
  const subNameMax = 2;
  const subEmailMax = 3;
  const subPhoneMax = hasJobDescription ? 2 : 3;
  const subLinkLocMax = hasJobDescription ? 1 : 2;

  let contactPts = contactMax;
  const contactDeductions: string[] = [];
  const missingInformation: string[] = [];

  const hasName = looksLikeCandidateName(sections.header, allLines);
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(resumeRaw);
  const phoneMatches = resumeRaw.match(/(?:\+?\d[\d\s().-]{7,18}\d)/g) || [];
  const hasPhone = phoneMatches.some((m) => {
    const digits = m.replace(/\D/g, '');
    // Reject bare 4-digit year ranges like "2020 - 2024" (8 digits with 20xx-20xx)
    if (/^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(digits)) return false;
    return digits.length >= 10 && digits.length <= 15;
  });
  const hasProfileLink = /(?:linkedin\.com\/in\/|github\.com\/|gitlab\.com\/|portfolio|https?:\/\/)/i.test(
    resumeRaw
  );
  const hasLocation =
    /\blocation\s*:/i.test(resumeRaw) ||
    /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]{2,})\b/.test(
      sections.header.join(' ') || allLines.slice(0, 5).join(' ')
    );
  const hasLinkOrLocation = hasProfileLink || hasLocation;

  if (!hasName) {
    contactPts -= subNameMax;
    contactDeductions.push(
      `-${subNameMax} pts: Candidate full name was not clearly detected at the top of the resume.`
    );
    missingInformation.push('Full name is missing or unclear at the top header of your resume.');
    addIssue({
      id: 'missing_candidate_name',
      severity: 'warning',
      category: 'Contact Information',
      title: 'Candidate name not clearly identifiable in header',
      explanation:
        'ATS parsers expect your full name on the first line in plain text rather than inside an image banner.',
      solution: 'Place your full name in plain text on the very first line of your resume.',
    });
  }

  if (!hasEmail) {
    contactPts -= subEmailMax;
    contactDeductions.push(`-${subEmailMax} pts: Email address is missing from contact details.`);
    missingInformation.push('Email address is missing—add a professional email in your header.');
    addIssue({
      id: 'missing_email',
      severity: 'critical',
      category: 'Contact Information',
      title: 'Missing email address',
      explanation:
        'No valid email address was found in your resume text, preventing recruiters and ATS systems from contacting you.',
      solution:
        'Add a professional email address (e.g., firstname.lastname@email.com) as plain selectable text in your header.',
    });
  }

  if (!hasPhone) {
    contactPts -= subPhoneMax;
    contactDeductions.push(`-${subPhoneMax} pts: Phone number is missing or incomplete.`);
    missingInformation.push('Phone number (10+ digits) was not detected in your contact header.');
    addIssue({
      id: 'missing_phone',
      severity: 'critical',
      category: 'Contact Information',
      title: 'Missing phone number',
      explanation:
        'A valid 10–15 digit phone number could not be detected in your contact information.',
      solution:
        'Include a reachable phone number with area/country code (e.g., +1 (555) 234-5678) in your resume header.',
    });
  }

  if (!hasLinkOrLocation) {
    contactPts -= subLinkLocMax;
    contactDeductions.push(
      `-${subLinkLocMax} ${subLinkLocMax === 1 ? 'pt' : 'pts'}: Neither city/state location nor LinkedIn/GitHub link was found.`
    );
    missingInformation.push(
      'City/location or a LinkedIn/GitHub URL is missing from your contact header.'
    );
    addIssue({
      id: 'missing_contact_link_or_location',
      severity: 'warning',
      category: 'Contact Information',
      title: 'Missing location and LinkedIn/portfolio link',
      explanation:
        'Recruiters routinely check city/region alignment and LinkedIn or GitHub profiles during screening.',
      solution:
        'Add your City, State/Country and your LinkedIn or GitHub URL to your contact line.',
    });
  }

  contactPts = Math.max(0, contactPts);
  if (contactPts === contactMax) {
    addPassed({
      id: 'contact_complete',
      category: 'Contact Information',
      detail: 'Complete contact header verified (full name, email, phone number, and location/profile link).',
    });
  }

  // ===========================================================================
  // CATEGORY 3: PROFESSIONAL SUMMARY (7 pts w/ JD | 9 pts w/o JD)
  // ===========================================================================
  const summaryMax = WEIGHTS.professional_summary;
  let summaryPts = 0;
  const summaryDeductions: string[] = [];

  const summaryText = sections.summary.join(' ').trim();
  // Also check if header contains an unlabeled multi-sentence summary paragraph (20-90 words)
  const unlabeledHeaderSummary =
    !summaryText
      ? sections.header
          .filter((l) => !/@|https?:\/\/|\b\d{3}[-.)\s]+\d{3}/.test(l))
          .slice(1)
          .join(' ')
          .trim()
      : '';

  const effectiveSummary = summaryText || (unlabeledHeaderSummary.split(/\s+/).filter(Boolean).length >= 18 ? unlabeledHeaderSummary : '');
  const summaryWords = effectiveSummary ? effectiveSummary.split(/\s+/).filter(Boolean).length : 0;

  if (!effectiveSummary) {
    summaryPts = 0;
    summaryDeductions.push(
      `-${summaryMax} pts: No Professional Summary or Career Objective section was found.`
    );
    addIssue({
      id: 'missing_summary',
      severity: 'warning',
      category: 'Professional Summary',
      title: 'Missing Professional Summary section',
      explanation:
        'A concise 2–3 sentence summary at the top helps ATS keyword indexing and tells recruiters your target role immediately.',
      solution:
        'Add a "Professional Summary" section (25–70 words) highlighting your role focus, core skills, and key strengths.',
    });
  } else {
    const subHeadingPts = hasJobDescription ? 2 : 3;
    const subLengthPts = 3;
    const subTonePts = hasJobDescription ? 2 : 3;
    summaryPts = summaryMax;

    if (!detectedHeadingKeys.has('summary')) {
      summaryPts -= subHeadingPts;
      summaryDeductions.push(
        `-${subHeadingPts} pts: Summary paragraph lacks an explicit "Professional Summary" heading.`
      );
    }

    if (summaryWords < 18) {
      const deduct = 2;
      summaryPts -= deduct;
      summaryDeductions.push(
        `-${deduct} pts: Summary is too brief (${summaryWords} words; aim for 25–75 words).`
      );
    } else if (summaryWords > 105) {
      const deduct = 2;
      summaryPts -= deduct;
      summaryDeductions.push(
        `-${deduct} pts: Summary is overly long (${summaryWords} words; keep to 2–4 crisp sentences).`
      );
    }

    const summaryHasSkill = KNOWN_SKILLS.some((sk) => containsCanonicalTerm(effectiveSummary, sk));
    const summaryHasFirstPerson = /\b(?:i am|i'm|i have|my name|my goal|looking for a job)\b/i.test(
      effectiveSummary
    );

    if (!summaryHasSkill || summaryHasFirstPerson) {
      const deduct = !summaryHasSkill && summaryHasFirstPerson ? subTonePts : 1;
      summaryPts -= deduct;
      summaryDeductions.push(
        `-${deduct} ${deduct === 1 ? 'pt' : 'pts'}: ${
          summaryHasFirstPerson
            ? 'Summary uses casual first-person phrasing ("I am" / "my goal") instead of direct professional tone.'
            : 'Summary lacks concrete technical or domain skills.'
        }`
      );
    }
    summaryPts = Math.max(0, summaryPts);
  }

  if (summaryPts === summaryMax) {
    addPassed({
      id: 'summary_strong',
      category: 'Professional Summary',
      detail: `Concise, role-focused Professional Summary verified (${summaryWords} words).`,
    });
  }

  // ===========================================================================
  // CATEGORY 4: TECHNICAL SKILLS (15 pts w/ JD | 20 pts w/o JD)
  // ===========================================================================
  const skillsMax = WEIGHTS.technical_skills;
  const subSkillsHeadingMax = hasJobDescription ? 3 : 4;
  const subSkillsBreadthMax = hasJobDescription ? 6 : 8;
  const subSkillsProofMax = hasJobDescription ? 4 : 5;
  const subSkillsOrgMax = hasJobDescription ? 2 : 3;

  let skillsPts = skillsMax;
  const skillsDeductions: string[] = [];

  const resumeDetectedSkills = KNOWN_SKILLS.filter((sk) => containsCanonicalTerm(resumeRaw, sk));
  const experienceAndProjectsCorpus = [
    ...sections.experience,
    ...sections.projects,
    ...sections.achievements,
  ].join('\n');

  const substantiatedSkills = resumeDetectedSkills.filter((sk) =>
    containsCanonicalTerm(experienceAndProjectsCorpus, sk)
  );

  // 4a. Dedicated Skills section heading
  if (!detectedHeadingKeys.has('skills')) {
    skillsPts -= subSkillsHeadingMax;
    skillsDeductions.push(
      `-${subSkillsHeadingMax} pts: Dedicated "Skills" or "Technical Skills" section heading is missing.`
    );
    missingInformation.push(
      'Dedicated "Skills" section heading is missing—add a clear Skills section so ATS parsers index your tools.'
    );
    if (resumeDetectedSkills.length === 0) {
      addIssue({
        id: 'missing_skills_section',
        severity: 'critical',
        category: 'Technical Skills',
        title: 'Missing Skills section and technical skills',
        explanation:
          'Neither a Skills heading nor recognizable technical/domain skills were found in the resume.',
        solution:
          'Create a "Technical Skills" section listing the programming languages, frameworks, and tools you genuinely know.',
      });
    } else {
      addIssue({
        id: 'missing_skills_heading',
        severity: 'warning',
        category: 'Technical Skills',
        title: 'No dedicated "Technical Skills" heading found',
        explanation:
          'Skills are mentioned in text, but without a standard "Skills" heading some ATS parsers fail to populate your skill profile.',
        solution: 'Group your core tools and technologies under a dedicated "Technical Skills" heading.',
      });
    }
  }

  // 4b. Breadth of concrete skills
  let breadthLoss = 0;
  if (resumeDetectedSkills.length === 0) {
    breadthLoss = subSkillsBreadthMax;
    skillsDeductions.push(
      `-${breadthLoss} pts: Zero recognizable technical or domain skills were detected.`
    );
    if (detectedHeadingKeys.has('skills')) {
      addIssue({
        id: 'missing_skills_section',
        severity: 'critical',
        category: 'Technical Skills',
        title: 'No concrete technical or domain skills listed',
        explanation:
          'Vague traits (like "hardworking" or "team player") do not match technical ATS search filters.',
        solution:
          'List specific languages, software tools, frameworks, and methodologies relevant to your field.',
      });
    }
  } else if (resumeDetectedSkills.length <= 2) {
    breadthLoss = hasJobDescription ? 4 : 6;
    skillsDeductions.push(
      `-${breadthLoss} pts: Only ${resumeDetectedSkills.length} concrete skill(s) detected (${resumeDetectedSkills.map(formatDisplayTerm).join(', ')}); list at least 6–12 core tools/technologies.`
    );
  } else if (resumeDetectedSkills.length <= 5) {
    breadthLoss = hasJobDescription ? 2 : 3;
    skillsDeductions.push(
      `-${breadthLoss} pts: Modest skill breadth (${resumeDetectedSkills.length} skills detected); consider listing supporting frameworks, databases, or developer tools you use.`
    );
  }
  skillsPts -= breadthLoss;

  // 4c. Substantiation in Experience/Projects + Anti-Stuffing check
  let proofLoss = 0;
  if (resumeDetectedSkills.length > 0 && substantiatedSkills.length === 0) {
    proofLoss = subSkillsProofMax;
    skillsDeductions.push(
      `-${proofLoss} pts: Listed skills are not demonstrated in any Work Experience or Project bullet points.`
    );
    addIssue({
      id: 'unsubstantiated_skills',
      severity: 'warning',
      category: 'Technical Skills',
      title: 'Listed skills are not backed up in Experience or Projects',
      explanation:
        'Listing skills without showing how you used them in projects or roles lowers credibility with both ATS rankers and recruiters.',
      solution:
        'Mention the specific tools and technologies you used inside your Project and Work Experience bullet points.',
    });
  } else if (resumeDetectedSkills.length >= 3 && substantiatedSkills.length === 1) {
    proofLoss = 2;
    skillsDeductions.push(
      `-2 pts: Only 1 of ${resumeDetectedSkills.length} listed skills appears in your Experience or Project descriptions.`
    );
  }

  if (stuffing.keywordStuffingDetected && proofLoss < subSkillsProofMax) {
    const extraStuffPenalty = Math.min(subSkillsProofMax - proofLoss, hasJobDescription ? 3 : 4);
    proofLoss += extraStuffPenalty;
    skillsDeductions.push(
      `-${extraStuffPenalty} pts: Keyword repetition/stuffing detected (${stuffing.stuffedTerms.join(', ')}).`
    );
  }
  skillsPts -= proofLoss;

  if (stuffing.keywordStuffingDetected) {
    addIssue({
      id: 'keyword_stuffing',
      severity: 'warning',
      category: 'Technical Skills',
      title: 'Keyword stuffing / unnatural repetition detected',
      explanation:
        stuffing.reason ||
        'Repeating the same technical keywords excessively does not increase your ATS score and can trigger spam filters.',
      solution:
        'List each skill once in your Skills section and reference it naturally in 1–3 genuine project or experience bullets.',
    });
  }

  // 4d. Clean skill grouping/formatting
  const skillsLines = sections.skills;
  const hasCategorizedOrCleanSkills =
    skillsLines.length > 0 &&
    skillsLines.some((l) => /[:,|•]/.test(l) && l.split(/\s+/).length <= 35);
  if (!hasCategorizedOrCleanSkills) {
    skillsPts -= subSkillsOrgMax;
    skillsDeductions.push(
      `-${subSkillsOrgMax} pts: Skills are not organized into clear comma-separated or categorized groups (e.g., "Languages: Python, TypeScript").`
    );
  }

  skillsPts = Math.max(0, skillsPts);
  if (
    detectedHeadingKeys.has('skills') &&
    resumeDetectedSkills.length >= 6 &&
    substantiatedSkills.length >= 2 &&
    !stuffing.keywordStuffingDetected
  ) {
    addPassed({
      id: 'technical_skills_substantiated',
      category: 'Technical Skills',
      detail: `${resumeDetectedSkills.length} concrete technical skills identified and substantiated across project/work bullets.`,
    });
  }

  // ===========================================================================
  // CATEGORY 5: JOB DESCRIPTION KEYWORD MATCHING (20 pts w/ JD | 0 pts w/o JD)
  // ===========================================================================
  const jdMax = WEIGHTS.jd_keyword_matching;
  let jdPts = 0;
  const jdDeductions: string[] = [];

  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];
  const matchedPreferredSkills: string[] = [];
  const missingPreferredSkills: string[] = [];
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  const synonymMatches: AtsSynonymMatch[] = [];

  if (hasJobDescription) {
    const parsedJd = parseJobDescriptionRequirements(jdRaw);

    for (const sk of parsedJd.requiredSkills) {
      const resumeSurface = findMatchingVariantInText(resumeRaw, sk);
      const jdSurface = parsedJd.jdSurfaceForms.get(sk) || formatDisplayTerm(sk);
      if (resumeSurface) {
        matchedRequiredSkills.push(formatDisplayTerm(sk));
        if (resumeSurface.toLowerCase() !== jdSurface.toLowerCase()) {
          synonymMatches.push({ resumeTerm: resumeSurface, jobTerm: jdSurface });
        }
      } else {
        missingRequiredSkills.push(formatDisplayTerm(sk));
      }
    }

    for (const sk of parsedJd.preferredSkills) {
      const resumeSurface = findMatchingVariantInText(resumeRaw, sk);
      const jdSurface = parsedJd.jdSurfaceForms.get(sk) || formatDisplayTerm(sk);
      if (resumeSurface) {
        matchedPreferredSkills.push(formatDisplayTerm(sk));
        if (resumeSurface.toLowerCase() !== jdSurface.toLowerCase()) {
          synonymMatches.push({ resumeTerm: resumeSurface, jobTerm: jdSurface });
        }
      } else {
        missingPreferredSkills.push(formatDisplayTerm(sk));
      }
    }

    for (const kw of parsedJd.roleKeywords) {
      if (containsKeywordOrInflection(resumeRaw, kw)) {
        matchedKeywords.push(kw);
      } else {
        missingKeywords.push(kw);
      }
    }

    // Weighted match across Required Skills (70%), Preferred Skills (12%), Role Keywords (18%)
    let activeWeightSum = 0;
    let weightedMatchSum = 0;

    const reqTotal = parsedJd.requiredSkills.length;
    const prefTotal = parsedJd.preferredSkills.length;
    const kwTotal = parsedJd.roleKeywords.length;

    if (reqTotal > 0) {
      activeWeightSum += 0.7;
      weightedMatchSum += (matchedRequiredSkills.length / reqTotal) * 0.7;
    }
    if (prefTotal > 0) {
      activeWeightSum += 0.12;
      weightedMatchSum += (matchedPreferredSkills.length / prefTotal) * 0.12;
    }
    if (kwTotal > 0) {
      activeWeightSum += 0.18;
      weightedMatchSum += (matchedKeywords.length / kwTotal) * 0.18;
    }

    const rawRatio = activeWeightSum > 0 ? weightedMatchSum / activeWeightSum : 0;
    jdPts = Math.round(rawRatio * jdMax);

    // Anti-stuffing penalty on JD matching so stuffing never pays off
    if (stuffing.keywordStuffingDetected && jdPts > 0) {
      const stuffDeduct = Math.min(jdPts, 4);
      jdPts -= stuffDeduct;
      jdDeductions.push(
        `-${stuffDeduct} pts: Keyword stuffing penalty applied—repeating keywords artificially does not improve ATS relevance.`
      );
    }

    const lostFromGap = jdMax - jdPts - (stuffing.keywordStuffingDetected ? Math.min(4, jdMax) : 0);
    if (missingRequiredSkills.length > 0) {
      jdDeductions.push(
        `Missing ${missingRequiredSkills.length} of ${reqTotal} required job skill(s): ${missingRequiredSkills.slice(0, 6).join(', ')}.`
      );
    }
    if (missingPreferredSkills.length > 0) {
      jdDeductions.push(
        `Missing ${missingPreferredSkills.length} preferred/bonus skill(s): ${missingPreferredSkills.slice(0, 5).join(', ')}.`
      );
    }
    if (missingKeywords.length > 0 && lostFromGap > 0) {
      jdDeductions.push(
        `Missing ${missingKeywords.length} domain keyword(s) from the job posting: ${missingKeywords.slice(0, 6).join(', ')}.`
      );
    }
    if (jdPts < jdMax && jdDeductions.length > 0) {
      jdDeductions.unshift(
        `-${jdMax - jdPts} pts total in Job Description Keyword Matching (${jdPts}/${jdMax} pts earned).`
      );
    }

    // Critical vs Warning diagnostics for JD match
    if (reqTotal >= 2 && matchedRequiredSkills.length === 0) {
      addIssue({
        id: 'zero_required_jd_skills',
        severity: 'critical',
        category: 'Job Description Keyword Matching',
        title: 'None of the required job skills were found on your resume',
        explanation: `This job description requires ${missingRequiredSkills.slice(0, 6).join(', ')}, none of which appear in your resume.`,
        solution:
          'Tailor your resume to include required skills you genuinely possess, or verify whether this job posting matches your background.',
      });
    } else if (missingRequiredSkills.length > 0) {
      addIssue({
        id: 'missing_required_jd_skills',
        severity: 'warning',
        category: 'Job Description Keyword Matching',
        title: `${missingRequiredSkills.length} required skill(s) from the job description are missing`,
        explanation: `Required skills not detected in your resume: ${missingRequiredSkills.slice(0, 6).join(', ')}.`,
        solution:
          'If you have genuine hands-on experience with any of these required skills, add them to your Skills section and show how you used them in a bullet point.',
      });
    }

    if (missingPreferredSkills.length > 0) {
      addIssue({
        id: 'missing_preferred_jd_skills',
        severity: 'warning',
        category: 'Job Description Keyword Matching',
        title: `${missingPreferredSkills.length} preferred/nice-to-have skill(s) not found`,
        explanation: `Preferred qualifications mentioned in the job description: ${missingPreferredSkills.slice(0, 5).join(', ')}.`,
        solution:
          'Preferred skills are optional, but adding any that you truthfully know can strengthen alignment.',
      });
    }

    if (
      reqTotal > 0 &&
      matchedRequiredSkills.length / reqTotal >= 0.75 &&
      !stuffing.keywordStuffingDetected
    ) {
      addPassed({
        id: 'jd_required_skills_aligned',
        category: 'Job Description Keyword Matching',
        detail: `Strong alignment with required job skills (${matchedRequiredSkills.length} of ${reqTotal} required skills matched).`,
      });
    }
  } else {
    jdPts = 0;
  }

  // ===========================================================================
  // CATEGORY 6: WORK EXPERIENCE (14 pts w/ JD | 17 pts w/o JD)
  // ===========================================================================
  const expMax = WEIGHTS.work_experience;
  let expPts = 0;
  const expDeductions: string[] = [];

  const expLines = sections.experience;
  const expCorpus = expLines.join('\n');
  const hasExpSection = detectedHeadingKeys.has('experience') && expLines.length > 0;

  let expActionVerbHits = 0;
  for (const line of expLines) {
    const cleaned = line.replace(/^[•\-*▪◦\d.)\s]+/, '').trim();
    const first = (cleaned.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (ACTION_VERBS.has(first)) {
      expActionVerbHits++;
    }
  }

  let globalActionVerbHits = 0;
  for (const line of allLines) {
    const cleaned = line.replace(/^[•\-*▪◦\d.)\s]+/, '').trim();
    const first = (cleaned.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (ACTION_VERBS.has(first)) {
      globalActionVerbHits++;
    }
  }

  let weakPhraseHits = 0;
  const foundWeakPhrases: string[] = [];
  for (const phrase of WEAK_PASSIVE_PHRASES) {
    if (resumeRaw.toLowerCase().includes(phrase)) {
      weakPhraseHits++;
      foundWeakPhrases.push(`"${phrase}"`);
    }
  }

  const metricRegex =
    /\b\d+(?:\.\d+)?%|\$\d[\d,.]*[kKmMbB]?|\b\d+\+?\s*(?:users|customers|clients|requests|ms|seconds|minutes|hours|days|projects|endpoints|services|pipelines|servers|students|members|tickets|queries|transactions|records|pages|tests)\b|\b(?:reduced|increased|improved|cut|saved|scaled|boosted|grew)\s+[^.\n]{0,35}\b\d+/gi;

  if (!hasExpSection) {
    expPts = 0;
    expDeductions.push(
      `-${expMax} pts: No Work Experience or Internship section was found.`
    );
  } else {
    const subRoleMax = hasJobDescription ? 4 : 5;
    const subDatesMax = hasJobDescription ? 2 : 3;
    const subVerbsMax = hasJobDescription ? 4 : 5;
    const subImpactMax = 4;

    expPts = expMax;

    if (expLines.length < 2) {
      expPts -= subRoleMax;
      expDeductions.push(
        `-${subRoleMax} pts: Work Experience section lacks role title, company name, and descriptive bullets.`
      );
    }

    const hasExpDates = /\b(?:199\d|20[0-3]\d|present|current)\b/i.test(expCorpus);
    if (!hasExpDates) {
      expPts -= subDatesMax;
      expDeductions.push(
        `-${subDatesMax} pts: Employment/internship date ranges (e.g., "Jun 2023 – Aug 2024") are missing.`
      );
    }

    const expWeakHits = WEAK_PASSIVE_PHRASES.filter((p) =>
      expCorpus.toLowerCase().includes(p)
    ).length;

    let verbLoss = 0;
    if (expActionVerbHits === 0) {
      verbLoss = subVerbsMax;
      expDeductions.push(
        `-${verbLoss} pts: Experience descriptions do not start with strong action verbs (e.g., "Engineered", "Developed", "Reduced").`
      );
    } else if (expActionVerbHits < 3) {
      verbLoss = 2;
      expDeductions.push(
        `-2 pts: Only ${expActionVerbHits} experience bullet(s) start with strong action verbs.`
      );
    }
    if (expWeakHits > 0 && verbLoss < subVerbsMax) {
      const addLoss = Math.min(subVerbsMax - verbLoss, 2);
      verbLoss += addLoss;
      expDeductions.push(
        `-${addLoss} pts: Passive phrasing (${foundWeakPhrases.slice(0, 3).join(', ')}) weakens experience bullets.`
      );
    }
    expPts -= verbLoss;

    const expMetrics = expCorpus.match(metricRegex) || [];
    if (expMetrics.length === 0) {
      expPts -= subImpactMax;
      expDeductions.push(
        `-${subImpactMax} pts: Experience bullets contain no measurable metrics or concrete scale indicators (e.g., %, latency, users, or volume).`
      );
    } else if (expMetrics.length === 1) {
      expPts -= 1;
      expDeductions.push(
        `-1 pt: Only 1 quantified outcome detected in Work Experience; add concrete scope or results to additional roles/bullets.`
      );
    }

    expPts = Math.max(0, expPts);
  }

  if (weakPhraseHits > 0) {
    addIssue({
      id: 'weak_passive_bullets',
      severity: 'warning',
      category: 'Work Experience',
      title: 'Passive phrasing detected in bullet points',
      explanation: `Found passive openings (${foundWeakPhrases.slice(0, 3).join(', ')}) instead of direct action verbs.`,
      solution:
        'Start every bullet with a strong past-tense action verb such as "Built", "Engineered", "Automated", or "Optimized".',
    });
  }

  if (hasExpSection && expActionVerbHits >= 3 && weakPhraseHits === 0) {
    addPassed({
      id: 'experience_action_driven',
      category: 'Work Experience',
      detail: `Work Experience section includes ${expActionVerbHits} action-driven bullet points with clear timeline dates.`,
    });
  }

  // ===========================================================================
  // CATEGORY 7: PROJECTS & ACHIEVEMENTS (10 pts w/ JD | 12 pts w/o JD)
  // ===========================================================================
  const projMax = WEIGHTS.projects_achievements;
  let projPts = 0;
  const projDeductions: string[] = [];

  const projLines = [...sections.projects, ...sections.achievements];
  const projCorpus = projLines.join('\n');
  const hasProjectsOrAchievements =
    (detectedHeadingKeys.has('projects') || detectedHeadingKeys.has('achievements')) &&
    projLines.length > 0;

  if (!hasProjectsOrAchievements) {
    projPts = 0;
    projDeductions.push(
      `-${projMax} pts: Neither a Projects section nor an Achievements section was found.`
    );

    if (!hasExpSection) {
      missingInformation.push(
        'Both Work Experience and Projects sections are missing—add projects or experience to demonstrate applied skills.'
      );
      addIssue({
        id: 'missing_experience_and_projects',
        severity: 'critical',
        category: 'Projects & Achievements',
        title: 'Missing both Work Experience and Projects sections',
        explanation:
          'Your resume contains neither work history nor technical/academic projects, leaving zero applied evidence of your skills.',
        solution:
          'Add a "Projects" and/or "Work Experience" section with 2–4 concrete entries detailing what you built, tools used, and outcomes.',
      });
    } else {
      addIssue({
        id: 'no_projects_section',
        severity: 'warning',
        category: 'Projects & Achievements',
        title: 'No Projects or Achievements section found',
        explanation:
          'A dedicated Projects or Key Achievements section accounts for 10–12 points and showcases hands-on technical ownership.',
        solution:
          'Add 1–3 notable projects, open-source contributions, or key career achievements with tech stack and measurable impact.',
      });
    }
  } else {
    const subPresenceMax = hasJobDescription ? 4 : 5;
    const subTechMax = hasJobDescription ? 3 : 4;
    const subOutcomeMax = 3;

    projPts = projMax;

    if (projLines.length < 2) {
      projPts -= subPresenceMax - 1;
      projDeductions.push(
        `-${subPresenceMax - 1} pts: Projects/Achievements section has minimal detail; include project title and 2+ descriptive bullets.`
      );
    }

    const projSkillsCount = KNOWN_SKILLS.filter((sk) =>
      containsCanonicalTerm(projCorpus, sk)
    ).length;
    if (projSkillsCount === 0) {
      projPts -= subTechMax;
      projDeductions.push(
        `-${subTechMax} pts: Project descriptions do not mention specific technologies, tools, or frameworks used.`
      );
    } else if (projSkillsCount === 1) {
      projPts -= 1;
      projDeductions.push(
        `-1 pt: Mention the full tech stack used for each project (e.g., frontend, backend, database, or testing tools).`
      );
    }

    const projMetrics = projCorpus.match(metricRegex) || [];
    const hasProjLink = /(?:github\.com|gitlab\.com|https?:\/\/|live\s+demo)/i.test(projCorpus);
    if (projMetrics.length === 0 && !hasProjLink) {
      projPts -= subOutcomeMax;
      projDeductions.push(
        `-${subOutcomeMax} pts: Projects lack measurable outcomes, scale details, or repository/demo links.`
      );
    } else if (projMetrics.length === 0) {
      projPts -= 1;
      projDeductions.push(
        `-1 pt: Add concrete outcome or scale details to your project bullets alongside your link.`
      );
    }

    projPts = Math.max(0, projPts);
  }

  const globalMetrics = resumeRaw.match(metricRegex) || [];
  if ((hasExpSection || hasProjectsOrAchievements) && globalMetrics.length === 0) {
    addIssue({
      id: 'missing_quantified_impact',
      severity: 'warning',
      category: 'Projects & Achievements',
      title: 'No measurable outcomes or scope numbers in bullets',
      explanation:
        'None of your experience or project bullets quantify scope, scale, performance, or concrete deliverables.',
      solution:
        'Include truthful metrics where applicable (e.g., number of API endpoints, test coverage %, response time improvement, or users supported).',
    });
  }

  if (hasProjectsOrAchievements && projPts >= Math.ceil(projMax * 0.8)) {
    addPassed({
      id: 'projects_documented',
      category: 'Projects & Achievements',
      detail: 'Projects & Achievements section documents specific technologies and concrete outcomes.',
    });
  }

  // ===========================================================================
  // CATEGORY 8: EDUCATION (6 pts w/ JD | 7 pts w/o JD)
  // ===========================================================================
  const eduMax = WEIGHTS.education;
  let eduPts = 0;
  const eduDeductions: string[] = [];

  const eduCorpus =
    sections.education.length > 0 ? sections.education.join('\n') : resumeRaw;
  const hasEduHeading = detectedHeadingKeys.has('education');
  const hasDegreeOrSchool =
    /\b(?:bachelor|master|ph\.?d|doctorate|associate|diploma|b\.?s\.?|b\.?a\.?|b\.?tech|b\.?e\.?|m\.?s\.?|m\.?tech|m\.?b\.?a\.?|bca|mca|university|college|institute\s+of\s+technology|polytechnic|school\s+of)\b/i.test(
      eduCorpus
    );
  const hasEduYear = /\b(?:198\d|199\d|20[0-3]\d)\b/.test(
    sections.education.length > 0 ? sections.education.join(' ') : ''
  );

  if (!hasEduHeading && !hasDegreeOrSchool) {
    eduPts = 0;
    eduDeductions.push(
      `-${eduMax} pts: No Education section, degree, or academic institution was found.`
    );
    missingInformation.push(
      'Education section is missing—include your degree, institution, and graduation year.'
    );
    addIssue({
      id: 'missing_education',
      severity: 'critical',
      category: 'Education',
      title: 'Missing Education section',
      explanation:
        'Most employer ATS configurations check for an Education section containing your degree/program and institution.',
      solution:
        'Add an "Education" section listing your school/university, degree or field of study, and graduation (or expected graduation) year.',
    });
  } else {
    const subEduHead = 2;
    const subEduDegree = hasJobDescription ? 2 : 3;
    const subEduYear = 2;
    eduPts = eduMax;

    if (!hasEduHeading) {
      eduPts -= subEduHead;
      eduDeductions.push(`-${subEduHead} pts: Education details lack a dedicated "Education" heading.`);
    }
    if (!hasDegreeOrSchool) {
      eduPts -= subEduDegree;
      eduDeductions.push(
        `-${subEduDegree} pts: Degree title or institution name is unclear in the Education section.`
      );
    }
    if (!hasEduYear) {
      eduPts -= subEduYear;
      eduDeductions.push(
        `-${subEduYear} pts: Graduation year (or expected graduation date) is missing from Education.`
      );
      missingInformation.push('Graduation year is missing from your Education section.');
      addIssue({
        id: 'incomplete_education_dates',
        severity: 'warning',
        category: 'Education',
        title: 'Missing graduation year in Education',
        explanation:
          'Your Education entry does not include a clear graduation year or expected completion date.',
        solution:
          'Add your graduation year (e.g., "May 2025" or "Expected 2026") next to your degree entry.',
      });
    }
    eduPts = Math.max(0, eduPts);
  }

  if (eduPts === eduMax) {
    addPassed({
      id: 'education_complete',
      category: 'Education',
      detail: 'Education section verified with institution, degree/field, and graduation year.',
    });
  }

  // ===========================================================================
  // CATEGORY 9: CERTIFICATIONS (3 pts w/ JD | 3 pts w/o JD)
  // ===========================================================================
  const certMax = WEIGHTS.certifications;
  let certPts = 0;
  const certDeductions: string[] = [];

  const certLines = sections.certifications;
  const certCorpus = certLines.join('\n');
  const inlineCertMatch =
    /\b(?:aws\s+certified|google\s+cloud\s+certified|microsoft\s+certified|azure\s+fundamentals|certified\s+kubernetes|cka|ckad|pmp|certified\s+scrum|comptia|ccna|cissp|oracle\s+certified|meta\s+front-end|hashicorp\s+certified)\b/i.test(
      resumeRaw
    );

  if (detectedHeadingKeys.has('certifications') && certLines.length > 0) {
    const hasIssuerOrYear =
      /\b(?:199\d|20[0-3]\d|amazon|aws|google|microsoft|coursera|udemy|ibm|cisco|oracle|linux\s+foundation|pmi|scrum|comptia|meta|stanford|harvard|edx|freecodecamp)\b/i.test(
        certCorpus
      ) || /[—–\-|()]/.test(certCorpus);
    if (hasIssuerOrYear) {
      certPts = certMax;
    } else {
      certPts = 2;
      certDeductions.push(
        '-1 pt: Add the issuing organization and completion year to your Certifications section.'
      );
    }
  } else if (inlineCertMatch) {
    certPts = 2;
    certDeductions.push(
      '-1 pt: Certification mentioned inline without a dedicated "Certifications" section heading.'
    );
  } else {
    certPts = 0;
    certDeductions.push(
      `-${certMax} pts: No Certifications section or industry credential listed (optional for many roles; add only real credentials you have earned).`
    );
  }

  if (certPts === certMax) {
    addPassed({
      id: 'certifications_verified',
      category: 'Certifications',
      detail: 'Dedicated Certifications section includes credential title and issuer/date.',
    });
  }

  // ===========================================================================
  // CATEGORY 10: GRAMMAR & SPELLING (5 pts w/ JD | 6 pts w/o JD)
  // ===========================================================================
  const grammarMax = WEIGHTS.grammar_spelling;
  let grammarPts = grammarMax;
  const grammarDeductions: string[] = [];

  const totalGrammarSignals =
    grammar.misspelledExamples.length +
    grammar.repeatedWordExamples.length +
    (grammar.hasLowercasePronounI ? 1 : 0) +
    (grammar.lowercaseBulletCount >= 2 ? 1 : 0) +
    (grammar.issues.some((i) => i.includes('punctuation')) ? 1 : 0);

  if (wordCount < 25) {
    grammarPts = 0;
    grammarDeductions.push(`-${grammarMax} pts: Insufficient readable text to verify grammar and spelling.`);
  } else if (totalGrammarSignals > 0) {
    const deduct =
      totalGrammarSignals === 1
        ? 2
        : totalGrammarSignals === 2
          ? Math.min(grammarMax, 4)
          : grammarMax;
    grammarPts = Math.max(0, grammarMax - deduct);
    for (const issueText of grammar.issues) {
      grammarDeductions.push(issueText);
    }
    grammarDeductions.unshift(
      `-${deduct} pts: ${totalGrammarSignals} spelling, grammar, or capitalization issue(s) found.`
    );

    addIssue({
      id: 'grammar_spelling_errors',
      severity: totalGrammarSignals >= 3 ? 'critical' : 'warning',
      category: 'Grammar & Spelling',
      title: `${totalGrammarSignals} spelling or grammar issue(s) detected`,
      explanation: grammar.issues.join(' '),
      solution:
        'Proofread and fix all flagged typos, duplicate words, and capitalization inconsistencies before submitting.',
    });
  } else {
    addPassed({
      id: 'grammar_clean',
      category: 'Grammar & Spelling',
      detail: 'Zero common resume misspellings, repeated words, or capitalization errors detected.',
    });
  }

  // ===========================================================================
  // ASSEMBLE ALL 10 WEIGHTED CATEGORIES (TOTAL MAX POINTS = 100 EXACTLY)
  // ===========================================================================
  const criteriaBreakdown: AtsCriterionScore[] = [
    {
      key: 'formatting_readability',
      label: 'Resume Formatting & Readability',
      pointsEarned: formatPts,
      maxPoints: formatMax,
      plainExplanation:
        formatDeductions.length === 0
          ? `Clean layout (${wordCount} words, ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}), standard section headings, and scannable bullet points.`
          : `${formatDeductions.length} formatting or readability deduction(s) lowered your score in this category.`,
      deductions: formatDeductions,
    },
    {
      key: 'contact_information',
      label: 'Contact Information',
      pointsEarned: contactPts,
      maxPoints: contactMax,
      plainExplanation:
        contactDeductions.length === 0
          ? 'Name, email, phone number, and location or professional profile link are all present.'
          : 'One or more essential contact fields could not be found in your header.',
      deductions: contactDeductions,
    },
    {
      key: 'professional_summary',
      label: 'Professional Summary',
      pointsEarned: summaryPts,
      maxPoints: summaryMax,
      plainExplanation:
        summaryDeductions.length === 0
          ? `Clear, role-focused summary (${summaryWords} words) sets strong context at the top of your resume.`
          : effectiveSummary
            ? 'Your summary was found, with room to tighten heading, length, or technical focus.'
            : 'No dedicated Professional Summary or Career Objective section was detected.',
      deductions: summaryDeductions,
    },
    {
      key: 'technical_skills',
      label: 'Technical Skills',
      pointsEarned: skillsPts,
      maxPoints: skillsMax,
      plainExplanation:
        skillsDeductions.length === 0
          ? `Detected ${resumeDetectedSkills.length} concrete skills organized cleanly and backed up in your experience/projects.`
          : `Detected ${resumeDetectedSkills.length} recognizable skill(s), with deductions noted below.`,
      deductions: skillsDeductions,
    },
    {
      key: 'jd_keyword_matching',
      label: 'Job Description Keyword Matching',
      pointsEarned: jdPts,
      maxPoints: jdMax,
      plainExplanation: !hasJobDescription
        ? 'No job description was pasted (0 / 0 pts). Paste a target job posting to evaluate required and preferred job keywords (worth 20 pts).'
        : matchedRequiredSkills.length + matchedPreferredSkills.length + matchedKeywords.length > 0
          ? `Matched ${matchedRequiredSkills.length} of ${matchedRequiredSkills.length + missingRequiredSkills.length} required skills, ${matchedPreferredSkills.length} of ${matchedPreferredSkills.length + missingPreferredSkills.length} preferred skills, and ${matchedKeywords.length} of ${matchedKeywords.length + missingKeywords.length} role keywords.`
          : 'Zero required skills, preferred skills, or domain keywords from the job description matched your resume.',
      deductions: jdDeductions,
    },
    {
      key: 'work_experience',
      label: 'Work Experience',
      pointsEarned: expPts,
      maxPoints: expMax,
      plainExplanation:
        expDeductions.length === 0
          ? 'Work Experience entries include clear dates, strong action verbs, and measurable outcomes.'
          : hasExpSection
            ? 'Work Experience section found; see specific deductions for dates, action verbs, or quantified impact.'
            : 'No Work Experience or Internship section was detected.',
      deductions: expDeductions,
    },
    {
      key: 'projects_achievements',
      label: 'Projects & Achievements',
      pointsEarned: projPts,
      maxPoints: projMax,
      plainExplanation:
        projDeductions.length === 0
          ? 'Projects & Achievements clearly document tech stack, implementation details, and concrete results.'
          : hasProjectsOrAchievements
            ? 'Projects/Achievements section found; adding tech stack details or measurable results will earn full marks.'
            : 'No dedicated Projects or Achievements section was found.',
      deductions: projDeductions,
    },
    {
      key: 'education',
      label: 'Education',
      pointsEarned: eduPts,
      maxPoints: eduMax,
      plainExplanation:
        eduDeductions.length === 0
          ? 'Education section clearly lists institution, degree/field, and graduation year.'
          : 'Education section is missing or incomplete.',
      deductions: eduDeductions,
    },
    {
      key: 'certifications',
      label: 'Certifications',
      pointsEarned: certPts,
      maxPoints: certMax,
      plainExplanation:
        certDeductions.length === 0
          ? 'Verified Certifications section with credential name and issuer/year.'
          : certPts > 0
            ? 'Certification detected, with minor formatting or issuer/year detail missing.'
            : 'No Certifications section found (worth 3 pts; include only genuine credentials).',
      deductions: certDeductions,
    },
    {
      key: 'grammar_spelling',
      label: 'Grammar & Spelling',
      pointsEarned: grammarPts,
      maxPoints: grammarMax,
      plainExplanation:
        grammarDeductions.length === 0
          ? 'Clean spelling, consistent capitalization, and error-free punctuation.'
          : 'Spelling typos, repeated words, or capitalization issues reduced marks in this category.',
      deductions: grammarDeductions,
    },
  ];

  const totalMaxPoints = criteriaBreakdown.reduce((sum, c) => sum + c.maxPoints, 0);
  const overallScore = Math.max(
    0,
    Math.min(
      100,
      criteriaBreakdown.reduce((sum, c) => sum + c.pointsEarned, 0)
    )
  );

  const criticalIssues = Array.from(criticalMap.values());
  const warnings = Array.from(warningMap.values());
  const passedChecks = Array.from(passedMap.values());

  // Legacy top-level compatibility arrays
  const skillMatches = hasJobDescription
    ? Array.from(new Set([...matchedRequiredSkills, ...matchedPreferredSkills]))
    : resumeDetectedSkills.slice(0, 20).map(formatDisplayTerm);

  const missingSkills = hasJobDescription
    ? Array.from(new Set([...missingRequiredSkills, ...missingPreferredSkills]))
    : [];

  // Deduplicated, prioritized actionable suggestions
  const suggestionSet = new Set<string>();
  for (const crit of criticalIssues) {
    suggestionSet.add(`${crit.title}: ${crit.solution}`);
  }
  for (const warn of warnings) {
    if (suggestionSet.size >= 7) break;
    suggestionSet.add(`${warn.title}: ${warn.solution}`);
  }
  if (!hasJobDescription) {
    suggestionSet.add(
      'Paste a target job description in Step 2 and run the check again to evaluate Required vs. Preferred job skill alignment.'
    );
  }
  if (suggestionSet.size === 0) {
    suggestionSet.add(
      'Your resume scored strongly across all 10 categories. Double-check dates and role-specific terminology before submitting your application.'
    );
  }
  const practicalSuggestions = Array.from(suggestionSet);

  const jobMatch: AtsJobMatchBreakdown = {
    hasJobDescription,
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    matchedKeywords,
    missingKeywords,
    synonymMatches,
    keywordStuffingDetected: stuffing.keywordStuffingDetected,
    stuffedTerms: stuffing.stuffedTerms,
  };

  const summaryPlainEnglish = hasJobDescription
    ? overallScore >= 80
      ? `Strong estimated ATS compatibility (${overallScore}/100). Your resume parses cleanly and matches ${matchedRequiredSkills.length} of ${matchedRequiredSkills.length + missingRequiredSkills.length} required skills from the job description.`
      : overallScore >= 60
        ? `Moderate estimated ATS compatibility (${overallScore}/100). Review the category deductions, ${criticalIssues.length} critical issue(s), and missing required job skills below to strengthen your application truthfully.`
        : `Low estimated ATS compatibility (${overallScore}/100) for this job description. Address the ${criticalIssues.length} critical issue(s) and required skill/section gaps detailed below.`
    : overallScore >= 80
      ? `Strong general ATS structure (${overallScore}/100 across intrinsic resume checks). Paste a specific job description above to measure Required vs. Preferred skill alignment.`
      : `Estimated general ATS readiness: ${overallScore}/100. Review the category-by-category deductions below and paste a job description to test role-specific keyword matching.`;

  return {
    overallScore,
    totalMaxPoints,
    hasJobDescription,
    summaryPlainEnglish,
    disclaimer: HONEST_ATS_DISCLAIMER,
    extractedWordCount: wordCount,
    pageCount,
    detectedSections: detectedSectionLabels,
    criteriaBreakdown,
    criticalIssues,
    warnings,
    passedChecks,
    jobMatch,
    skillMatches,
    missingSkills,
    matchedKeywords,
    missingKeywords,
    missingInformation,
    formattingIssues,
    practicalSuggestions,
  };
}
