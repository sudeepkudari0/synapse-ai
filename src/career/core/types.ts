/**
 * Core Types for Career Hub
 * Ported from cv-tailor/src/core/types.ts + ApplyPilot schema
 */

// ─── Resume Types (from cv-tailor) ─────────────────────────────────────────

export interface SkillCategory {
  label: string;
  items: string;
}

export interface MasterResume {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  categorized_skills?: SkillCategory[];
  certifications?: string[];
  projects?: Project[];
}

export interface Experience {
  title: string;
  company: string;
  dates: string;
  location?: string;
  technologies?: string[];
  bullets: string[];
  intern_bullets?: string[];
}

export interface Education {
  degree: string;
  school: string;
  year: string;
  gpa?: string;
}

export interface Project {
  name: string;
  url?: string;
  description?: string;
  bullets?: string[];
}

export interface JDAnalysis {
  hard_skills: string[];
  soft_skills: string[];
  tools_technologies: string[];
  action_verbs: string[];
  role_expectations: string[];
  seniority_indicators: string[];
  keyword_priorities: {
    must_have: string[];
    nice_to_have: string[];
    industry_terms: string[];
  };
  years_experience: string | null;
  education_requirements: string[];
  culture_signals: string[];
  key_phrases_verbatim: string[];
}

export interface GenerationResult {
  resume: string;
  coverLetter: string;
  jdAnalysis: JDAnalysis;
}

// ─── Job Types (from ApplyPilot schema) ────────────────────────────────────

export type JobStatus =
  | 'discovered'
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'archived';

export interface Job {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description?: string;
  fullDescription?: string;
  isRemote: boolean;
  source: string;
  dateFound: string;
  datePosted?: string;
  status: JobStatus;
  notes: string;
  fitScore?: number;
  scoreReasoning?: string;
  tailoredResumePath?: string;
  tailoredResumeText?: string;
  coverLetterPath?: string;
  coverLetterText?: string;
  appliedAt?: string;
  applicationUrl?: string;
  tags?: string[];
  updatedAt: string;
}

// ─── LLM Provider Interface (from cv-tailor) ──────────────────────────────

export interface LLMResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface GenerateOptions {
  systemPrompt: string;
  temperature?: number;
  forceJson?: boolean;
}

export interface LLMProvider {
  generate(prompt: string, options: GenerateOptions): Promise<LLMResponse>;
  getModelId(): string;
}

// ─── User Profile ──────────────────────────────────────────────────────────

export interface CareerProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  totalYearsExperience: number;
  currentRole: string;
  currentCompany: string;
  topSkills: string[];
  preferredJobTitles: string[];
  preferredLocations: string[];
  masterResumeYaml: string;
  masterResumeText: string;
  updatedAt: string;
}
