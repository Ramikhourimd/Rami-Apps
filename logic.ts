import { SectionId, PatternResult } from './types';

// Helper to check yes/not sure
const isYesOrNotSure = (val: string) => val === 'Yes' || val === 'Not sure';
const isYes = (val: string) => val === 'Yes';

/**
 * Calculates the sequence of sections based on Core answers.
 */
export const calculateRoute = (answers: Record<string, any>): SectionId[] => {
  // Always include Personal History in the base route
  const route: SectionId[] = [SectionId.INTRO, SectionId.PERSONAL_HISTORY, SectionId.SAFETY, SectionId.CORE];

  const c1 = answers['c1'] as string;
  const c2 = (answers['c2'] as string[]) || [];
  const s0_2 = answers['s0_2'] as string;

  // Routing Rules
  const hasPanic = c2.some(x => x.includes('Panic')) || c1 === 'It comes in sudden spikes that peak within minutes–hours';
  if (hasPanic) route.push(SectionId.PANIC);

  const hasIntrusions = c2.some(x => x.includes('Intrusive thoughts'));
  if (hasIntrusions) route.push(SectionId.INTRUSIONS);

  const hasTrauma = c2.some(x => x.includes('Trauma reminders')) || c1 === 'It’s mostly triggered by specific cues (places/people/memories/sensations)';
  if (hasTrauma) route.push(SectionId.TRAUMA);

  const hasWorry = c2.some(x => x.includes('Worry'));
  if (hasWorry) route.push(SectionId.WORRY);

  const hasExecutive = c2.some(x => x.includes('Attention'));
  if (hasExecutive) route.push(SectionId.EXECUTIVE);

  const hasMood = c2.some(x => x.includes('Mood'));
  if (hasMood) route.push(SectionId.MOOD);

  const hasSubstance = c2.some(x => x.includes('Alcohol'));
  if (hasSubstance) route.push(SectionId.SUBSTANCE);

  const hasReality = isYesOrNotSure(s0_2) || c2.some(x => x.includes('Unusual experiences'));
  if (hasReality) route.push(SectionId.REALITY);

  const hasActivation = c1 === 'It comes in distinct episodes lasting days–weeks';
  if (hasActivation) route.push(SectionId.ACTIVATION);

  route.push(SectionId.RESULTS);

  return route;
};

/**
 * Analyzes answers to provide the final report summary.
 */
export const analyzePatterns = (answers: Record<string, any>): PatternResult[] => {
  const c3 = typeof answers['c3'] === 'number' ? answers['c3'] : 0;
  const results: PatternResult[] = [];

  // Panic (Section P)
  // Rule: P1 Yes/NS AND P2 Yes/NS AND (P5 Yes or P6 Yes) and C3 >= 5
  if (answers['p1']) {
    const p1 = isYesOrNotSure(answers['p1']);
    const p2 = isYesOrNotSure(answers['p2']);
    const p5 = isYes(answers['p5']);
    const p6 = isYes(answers['p6']);
    const detected = p1 && p2 && (p5 || p6) && c3 >= 5;
    results.push({ 
        name: 'Panic/body alarm surges', 
        detected, 
        message: detected ? 'Panic/alarm pattern likely' : undefined,
        dsmDifferential: detected ? 'Panic Disorder, Agoraphobia' : undefined
    });
  }

  // Intrusions (Section O)
  // Rule: O1 Yes/NS AND O2 Yes/NS AND O9 is Moderately/Severely
  if (answers['o1']) {
    const o1 = isYesOrNotSure(answers['o1']);
    const o2 = isYesOrNotSure(answers['o2']);
    const o9 = answers['o9'] === 'Moderately' || answers['o9'] === 'Severely';
    const detected = o1 && o2 && o9;
    results.push({ 
        name: 'Intrusion/compulsion loop', 
        detected, 
        message: detected ? 'Intrusion/compulsion loop likely' : undefined,
        dsmDifferential: detected ? 'Obsessive-Compulsive Disorder (OCD)' : undefined
    });
  }

  // Trauma (Section T)
  // Rule: T1 Yes/NS AND T2 Yes/NS AND T3 Yes/NS AND T5 is not "<1 month" AND C3 >= 5
  if (answers['t1']) {
    const t1 = isYesOrNotSure(answers['t1']);
    const t2 = isYesOrNotSure(answers['t2']);
    const t3 = isYesOrNotSure(answers['t3']);
    const t5Short = answers['t5'] === '<1 month';
    const detected = t1 && t2 && t3 && !t5Short && c3 >= 5;
    results.push({ 
        name: 'Trauma/cue reactivity', 
        detected, 
        message: detected ? 'Trauma/cue reactivity pattern likely' : undefined,
        dsmDifferential: detected ? 'PTSD, Acute Stress Disorder' : undefined
    });
  }

  // Worry (Section W)
  // Rule: W1 Yes/NS AND (W2 is “hard to stop” or “can’t stop”) AND 3+ somatic symptoms (W3) AND C3 >= 5
  if (answers['w1']) {
    const w1 = isYesOrNotSure(answers['w1']);
    const w2Hard = answers['w2'] === 'It’s hard to stop' || answers['w2'] === 'I can’t stop once it starts';
    const w3Count = (answers['w3'] as string[])?.length || 0;
    const detected = w1 && w2Hard && w3Count >= 3 && c3 >= 5;
    results.push({ 
        name: 'Worry/tension loop', 
        detected, 
        message: detected ? 'Worry/tension pattern likely (GAD-like)' : undefined,
        dsmDifferential: detected ? 'Generalized Anxiety Disorder (GAD)' : undefined
    });
  }

  // Mood (Section M)
  // Rule: (M1 Yes/NS OR M2 Yes/NS) AND M3 >= “1–2 weeks” AND 5+ total symptoms
  // Total symptoms = M1(1) + M2(1) + M_SYMPTOMS(count) + M6(1)
  if (answers['m1']) {
    const m1 = isYesOrNotSure(answers['m1']);
    const m2 = isYesOrNotSure(answers['m2']);
    const m3Dur = answers['m3'] !== '<1 week';
    
    // Calculate symptom count according to DSM-5 (SIGECAPS + Mood/Anhedonia)
    let symCount = 0;
    if (m1) symCount++;
    if (m2) symCount++;
    if (answers['m6'] === 'Yes' || answers['m6'] === 'Not sure') symCount++;
    symCount += (answers['m_symptoms'] as string[])?.length || 0;

    const detected = (m1 || m2) && m3Dur && symCount >= 5;
    results.push({ 
        name: 'Mood shutdown/low reward', 
        detected, 
        message: detected ? 'Mood shutdown pattern likely (MDD-like)' : undefined,
        dsmDifferential: detected ? 'Major Depressive Disorder (MDD)' : undefined
    });
  }

  // Activation (Section A)
  // Rule: A1 Yes/NS AND 3+ symptoms (A2) AND A5 Yes/NS
  if (answers['a1']) {
    const a1 = isYesOrNotSure(answers['a1']);
    const a2Count = (answers['a2'] as string[])?.length || 0;
    const a5 = isYesOrNotSure(answers['a5']);
    const detected = a1 && a2Count >= 3 && a5;
    results.push({ 
        name: 'Activation/drive shift', 
        detected, 
        message: detected ? 'Activation/drive shift pattern likely' : undefined,
        dsmDifferential: detected ? 'Bipolar Spectrum Disorder' : undefined
    });
  }

  // Executive (Section E)
  // Rule: E6 Yes/NS AND at least 4 of E1–E5+E_Hyper are Yes/NS AND C3 >= 5
  // (DSM-5 requires 5-6 symptoms for adults/children, sticking to conservative >3 for screener but let's say 4 to be safe including hyper)
  if (answers['e1']) {
    const e6 = isYesOrNotSure(answers['e6']);
    const count = ['e1', 'e2', 'e3', 'e4', 'e5', 'e_hyper'].filter(k => isYesOrNotSure(answers[k] as string)).length;
    const detected = e6 && count >= 4 && c3 >= 5;
    results.push({ 
        name: 'Executive control pattern', 
        detected, 
        message: detected ? 'Chronic executive control pattern likely' : undefined,
        dsmDifferential: detected ? 'ADHD (Attention-Deficit/Hyperactivity Disorder)' : undefined
    });
  }

  // Substance (Section S)
  // Rule: S2 Yes/NS AND S4 Yes/NS
  if (answers['s1']) {
    const s2 = isYesOrNotSure(answers['s2']);
    const s4 = isYesOrNotSure(answers['s4']);
    const detected = s2 && s4;
    results.push({ 
        name: 'Substance-related pattern', 
        detected, 
        message: detected ? 'Substance-related pattern likely' : undefined,
        dsmDifferential: detected ? 'Substance Use Disorder' : undefined
    });
  }

  // Reality (Section R)
  // Urgent if any R1-R3 are Yes
  if (answers['r1'] || answers['s0_2']) {
    const r1 = answers['r1'] === 'Yes';
    const r2 = answers['r2'] === 'Yes';
    const r3 = answers['r3'] === 'Yes';
    const s02 = answers['s0_2'] === 'Yes';
    const detected = r1 || r2 || r3 || s02;
    results.push({ 
        name: 'Reality-testing concerns', 
        detected, 
        urgent: detected, 
        message: detected ? 'Urgent clinician review recommended' : undefined,
        dsmDifferential: detected ? 'Psychotic Disorder, Schizophrenia Spectrum' : undefined
    });
  }

  return results;
};