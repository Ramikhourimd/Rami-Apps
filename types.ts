export enum SectionId {
  INTRO = 'INTRO',
  PERSONAL_HISTORY = 'PERSONAL_HISTORY',
  SAFETY = 'SAFETY',
  CORE = 'CORE',
  PANIC = 'PANIC',
  INTRUSIONS = 'INTRUSIONS',
  TRAUMA = 'TRAUMA',
  WORRY = 'WORRY',
  EXECUTIVE = 'EXECUTIVE',
  MOOD = 'MOOD',
  ACTIVATION = 'ACTIVATION',
  REALITY = 'REALITY',
  SUBSTANCE = 'SUBSTANCE',
  RESULTS = 'RESULTS',
  EMERGENCY = 'EMERGENCY', // Special state
}

export interface QuestionnaireState {
  answers: Record<string, any>;
  activeSections: SectionId[];
  currentSectionIndex: number;
  isComplete: boolean;
}

export interface SectionConfig {
  id: SectionId;
  title: string;
  description?: string;
}

export type QuestionType = 'yes-no' | 'single-select' | 'multi-select' | 'scale' | 'text' | 'date';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For single/multi select
  min?: number; // For scale
  max?: number; // For scale
  subText?: string;
  placeholder?: string;
}

// Logic Types
export interface PatternResult {
  name: string;
  detected: boolean;
  message?: string;
  urgent?: boolean;
  dsmDifferential?: string;
}