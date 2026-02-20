import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button } from './components/UI';
import { QuestionRenderer } from './components/QuestionRenderer';
import { SECTIONS_MAP } from './constants';
import { SectionId, QuestionnaireState } from './types';
import { calculateRoute, analyzePatterns } from './logic';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [state, setState] = useState<QuestionnaireState>({
    answers: {},
    activeSections: [SectionId.INTRO, SectionId.PERSONAL_HISTORY, SectionId.SAFETY, SectionId.CORE],
    currentSectionIndex: 0,
    isComplete: false,
  });

  const [emergencyMode, setEmergencyMode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Helper to scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.currentSectionIndex, emergencyMode]);

  const currentSectionId = state.activeSections[state.currentSectionIndex];
  const sectionData = SECTIONS_MAP[currentSectionId];

  // Update answers
  const handleAnswer = (questionId: string, value: any) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value },
    }));

    // Immediate check for Safety Section 0.1
    if (questionId === 's0_1' && value === 'Yes') {
      setEmergencyMode(true);
    }
  };

  const handleNext = () => {
    const isCore = currentSectionId === SectionId.CORE;
    
    // If we just finished Core, recalculate routing
    if (isCore) {
      const newRoute = calculateRoute(state.answers);
      setState((prev) => ({
        ...prev,
        activeSections: newRoute,
        currentSectionIndex: prev.activeSections.findIndex(id => id === SectionId.CORE) + 1, // Move to next after Core
      }));
    } else {
      // Normal next
      if (state.currentSectionIndex < state.activeSections.length - 1) {
        setState((prev) => ({
          ...prev,
          currentSectionIndex: prev.currentSectionIndex + 1,
        }));
      }
    }
  };

  const handleBack = () => {
    if (state.currentSectionIndex > 0) {
      setState((prev) => ({
        ...prev,
        currentSectionIndex: prev.currentSectionIndex - 1,
      }));
    }
  };

  const handlePrint = () => {
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Print failed:", err);
        alert("We couldn't open the print dialog. Please try the 'Copy Summary' option instead.");
      }
    }, 100);
  };

  const generateSummaryText = () => {
    const patterns = analyzePatterns(state.answers);
    const score = state.answers['c3'] || 0;
    const timeCourse = state.answers['c1'] || 'Not specified';
    const domains = (state.answers['c2'] as string[]) || [];

    let summaryText = "SCREENING RESULTS SUMMARY\n";
    summaryText += "==========================\n\n";
    
    // Add Personal History to Copy Text
    if (state.answers['ph_1']) {
        summaryText += "PATIENT HISTORY:\n";
        summaryText += `DOB: ${state.answers['ph_2'] || 'N/A'}\n`;
        summaryText += `Gender: ${state.answers['ph_1'] || 'N/A'}\n`;
        summaryText += `Diagnoses: ${state.answers['ph_12'] || 'None listed'}\n`;
        summaryText += "--------------------------\n\n";
    }

    summaryText += `Impairment Score: ${score}/10\n`;
    summaryText += `Time Course: ${timeCourse}\n`;
    summaryText += `Affected Domains: ${domains.join(", ")}\n\n`;
    summaryText += "DETECTED PATTERNS:\n";
    
    patterns.forEach(p => {
      if (p.detected) {
        summaryText += `- ${p.name}: ${p.message || 'Likely'}\n`;
        if (p.dsmDifferential) {
          summaryText += `  Provisional DSM Diff: ${p.dsmDifferential}\n`;
        }
      }
    });

    if (patterns.filter(p => p.detected).length === 0) {
      summaryText += "No specific patterns strongly detected.\n";
    }

    if (aiAnalysis) {
        summaryText += "\n\nAI CLINICAL COMPANION:\n";
        summaryText += aiAnalysis;
    }

    summaryText += "\nDisclaimer: This is not a diagnosis. Please share with a clinician.";
    
    return summaryText;
  };

  const handleCopySummary = () => {
    const summaryText = generateSummaryText();

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopyFeedback("Copied to clipboard!");
      setTimeout(() => setCopyFeedback(null), 3000);
    }).catch(err => {
      console.error("Copy failed:", err);
      alert("Failed to copy. You can manually select and copy the text on the results page.");
    });
  };

  const handleEmailDoctor = () => {
    const summaryText = generateSummaryText();
    const subject = encodeURIComponent(`Confidential Screening Report - ${new Date().toLocaleDateString()}`);
    // Note: mailto body length is limited in some clients, but usually sufficient for summaries.
    const body = encodeURIComponent(
        `Dear Dr. Khouri,\n\nPlease find the patient screening report below.\n\n` + 
        summaryText + 
        `\n\n(Note: This report was generated by the Patient Self-Screening Tool)`
    );
    const email = "rami.salim.khouri@gmail.com";
    
    // Open the default mail client
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const generateAIAnalysis = async () => {
    setIsAiLoading(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const patterns = analyzePatterns(state.answers);
        const positivePatterns = patterns.filter(p => p.detected);
        const score = state.answers['c3'] || 0;
        const history = state.answers['ph_12'] || 'None listed';

        let prompt = `Act as a professional Clinical Mental Health Assistant. Analyze the following patient self-screening data.\n\n`;
        prompt += `PATIENT CONTEXT:\n`;
        prompt += `- Reported Diagnoses: ${history}\n`;
        prompt += `- Functional Impairment Score: ${score}/10\n`;
        prompt += `- Symptom Time Course: ${state.answers['c1']}\n\n`;
        
        prompt += `DETECTED SYMPTOM CLUSTERS:\n`;
        if (positivePatterns.length > 0) {
            positivePatterns.forEach(p => {
                prompt += `- ${p.name} (Differential: ${p.dsmDifferential || 'N/A'})\n`;
            });
        } else {
            prompt += `- No specific clinical thresholds met on this screener.\n`;
        }

        prompt += `\nPlease provide a structured clinical analysis with the following sections:\n`;
        prompt += `1. **Professional Insights**: A concise summary of what these results might indicate clinically.\n`;
        prompt += `2. **Coping Tips**: 3 specific, evidence-based strategies relevant to the detected patterns (e.g., grounding for trauma, activation for mood).\n`;
        prompt += `3. **Recommendations**: Key points the patient should discuss with their doctor.\n\n`;
        prompt += `Tone: Empathetic, professional, and objective. \n`;
        prompt += `IMPORTANT: Start with a clear disclaimer that this is AI-generated and not a medical diagnosis.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });
        
        setAiAnalysis(response.text || "No analysis generated.");
    } catch (error) {
        console.error("AI Generation Error:", error);
        alert("Unable to generate AI analysis. Please check your connection or API key configuration.");
    } finally {
        setIsAiLoading(false);
    }
  };

  // Validation: Check if current section questions are answered
  const canProceed = useMemo(() => {
    if (currentSectionId === SectionId.INTRO || currentSectionId === SectionId.RESULTS) return true;
    
    // Special handling for T1 skip logic inside Section T
    if (currentSectionId === SectionId.TRAUMA) {
        if (state.answers['t1'] === 'No') return true; 
    }

    const questions = sectionData.questions;
    return questions.every((q) => {
      const val = state.answers[q.id];
      if (q.type === 'multi-select') return true;
      if (q.type === 'text' || q.type === 'date') return true; 
      
      return val !== undefined && val !== null && val !== '';
    });
  }, [currentSectionId, sectionData, state.answers]);

  // Special Check for T1 Skip Logic
  const shouldSkipRestOfTrauma = currentSectionId === SectionId.TRAUMA && state.answers['t1'] === 'No';

  // Helper to format answers for display in transcript
  const formatAnswer = (val: any) => {
    if (Array.isArray(val)) return val.join(', ');
    if (val === undefined || val === null || val === '') return 'Not answered';
    return String(val);
  };

  // --- RENDERERS ---

  if (emergencyMode) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full border-red-200 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-800 mb-4">Please Stop and Seek Help</h1>
          <p className="text-slate-700 mb-6 text-lg">
            Since you indicated you are in immediate danger, please stop this questionnaire and contact emergency services immediately.
          </p>
          <div className="space-y-3">
             <Button variant="danger" className="w-full" onClick={() => window.location.href = "tel:911"}>Call Emergency Services (911)</Button>
             <p className="text-sm text-slate-500 mt-4">If you are outside the US, please call your local emergency number.</p>
          </div>
        </Card>
      </div>
    );
  }

  // --- RESULTS PAGE ---
  if (currentSectionId === SectionId.RESULTS) {
    const patterns = analyzePatterns(state.answers);
    const score = state.answers['c3'] || 0;
    const timeCourse = state.answers['c1'] || 'Not specified';
    const domains = (state.answers['c2'] as string[]) || [];

    const positivePatterns = patterns.filter(p => p.detected);
    const negativePatterns = patterns.filter(p => !p.detected);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Helper for Severity Visualization
    const getSeverityDetails = (val: number) => {
        if (val >= 7) return { label: 'Severe', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
        if (val >= 4) return { label: 'Moderate', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
        return { label: 'Mild', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' };
    };
    const severity = getSeverityDetails(score);

    // Helpers to access history
    const getAns = (id: string) => state.answers[id] ? String(state.answers[id]) : 'Not ascertained';
    const getAnsArr = (id: string) => Array.isArray(state.answers[id]) ? state.answers[id].join(', ') : 'Not ascertained';

    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:bg-white print:p-0">
        <div className="max-w-4xl mx-auto space-y-6">
           {/* Document Container */}
           <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                
                {/* Header */}
                <div className="bg-slate-800 text-white p-8 print:bg-white print:text-black print:p-0 print:mb-6 print:border-b-2 print:border-black">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight uppercase">Confidential Screening Report</h1>
                            <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Patient Self-Administered Questionnaire</p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <div className="text-sm opacity-80">Report Date</div>
                            <div className="font-mono font-bold text-lg">{today}</div>
                        </div>
                    </div>
                </div>

                {/* Patient History / Demographics Section (New) */}
                <div className="px-8 pt-2 pb-6 border-b border-slate-200 print:pb-6 print:mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Patient History (AMDP)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-sm">
                        <div className="space-y-3">
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Gender:</span>
                                <span className="font-semibold text-slate-900">{getAns('ph_1')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Date of Birth:</span>
                                <span className="font-semibold text-slate-900">{getAns('ph_2')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Accommodation:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_3')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Living Arrangements:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAnsArr('ph_4')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Education:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_5')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Employment:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_6')}</span>
                             </div>
                        </div>
                        <div className="space-y-3">
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Exam Setting:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_7')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Referral:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_8')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Course of Illness:</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_9')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Family History:</span>
                                <span className="font-semibold text-slate-900">{getAns('ph_10')}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="text-slate-500">Severity (CGI Self-Rate):</span>
                                <span className="font-semibold text-slate-900 text-right">{getAns('ph_11')}</span>
                             </div>
                             <div className="block pt-1">
                                <span className="text-slate-500 block mb-1">Diagnoses:</span>
                                <div className="font-semibold text-slate-900 bg-slate-50 p-2 rounded border border-slate-100">
                                    {getAns('ph_12')}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Executive Summary Section */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Executive Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Impairment */}
                            <div className={`p-4 rounded-lg border ${severity.bg} border-opacity-50`}>
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Impairment Score</div>
                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-3xl font-bold text-slate-800">{score}</span>
                                    <span className="text-sm text-slate-500 mb-1">/ 10</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full ${severity.color}`} style={{ width: `${score * 10}%` }}></div>
                                </div>
                                <div className={`text-xs font-bold mt-2 ${severity.text} uppercase`}>{severity.label} Impact</div>
                            </div>

                            {/* Time Course */}
                            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Symptom Pattern</div>
                                <div className="font-medium text-slate-800 leading-snug">{timeCourse}</div>
                            </div>

                            {/* Domains */}
                            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Key Domains</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {domains.length > 0 ? domains.map(d => (
                                        <span key={d} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 shadow-sm">
                                            {d}
                                        </span>
                                    )) : <span className="text-slate-400 text-sm italic">None selected</span>}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Findings Section */}
                    <section>
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Clinical Findings</h3>
                         
                         {positivePatterns.length === 0 ? (
                            <div className="p-6 bg-green-50 rounded-lg border border-green-100 text-center">
                                <p className="text-green-800 font-medium">No specific patterns met the threshold for clinical flagging based on this screener.</p>
                            </div>
                         ) : (
                             <div className="space-y-4">
                                {positivePatterns.map((p, idx) => (
                                    <div key={idx} className={`border rounded-lg overflow-hidden ${p.urgent ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                                        <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-start gap-4">
                                            {/* Icon/Status */}
                                            <div className="flex-shrink-0 mt-1">
                                                {p.urgent ? (
                                                     <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                     </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className={`text-lg font-bold ${p.urgent ? 'text-red-800' : 'text-slate-800'}`}>{p.name}</h4>
                                                    {p.urgent && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 uppercase tracking-wide">Urgent Review</span>}
                                                </div>
                                                
                                                <p className="text-slate-600 mb-4">{p.message}</p>

                                                {/* DSM Differential Box - Prominent */}
                                                {p.dsmDifferential && (
                                                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 md:p-4 print:bg-slate-50 print:border-slate-300">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                            </svg>
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Consideration (DSM-5)</span>
                                                        </div>
                                                        <div className="text-slate-800 font-semibold pl-6">
                                                            {p.dsmDifferential}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                         )}

                         {/* Negative Findings */}
                         {negativePatterns.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <span className="text-xs font-semibold text-slate-400 uppercase">Ruled Out / Sub-threshold</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {negativePatterns.map((p, idx) => (
                                        <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5"></span>
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                         )}
                    </section>
                    
                    {/* AI Analysis Section */}
                    <section className="print:break-inside-avoid scroll-mt-24" id="ai-analysis">
                         <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-2">
                             <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Clinical Companion</h3>
                             {aiAnalysis && <span className="text-xs text-indigo-300 font-mono">Powered by Gemini 3 Pro</span>}
                         </div>

                         {!aiAnalysis ? (
                             <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-6 flex flex-col items-center justify-center text-center print:hidden">
                                 <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                 </div>
                                 <h4 className="text-lg font-bold text-indigo-900 mb-2">Professional AI Assistant</h4>
                                 <p className="text-indigo-700 mb-6 max-w-md">
                                     Generate a professional mental health summary, personalized coping strategies, and clinical recommendations based on your screening results.
                                 </p>
                                 <Button 
                                    onClick={generateAIAnalysis} 
                                    disabled={isAiLoading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md"
                                 >
                                     {isAiLoading ? (
                                         <span className="flex items-center">
                                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                             Generating Analysis...
                                         </span>
                                     ) : (
                                         "Generate Clinical Analysis"
                                     )}
                                 </Button>
                             </div>
                         ) : (
                             <div className="bg-white rounded-lg border-2 border-indigo-100 overflow-hidden shadow-sm">
                                 <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex items-start gap-3">
                                     <div className="mt-1">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                     </div>
                                     <div>
                                         <h4 className="font-bold text-indigo-900">Professional Analysis</h4>
                                         <p className="text-xs text-indigo-600">Generated by AI Assistant • Review with Clinician</p>
                                     </div>
                                 </div>
                                 <div className="p-6 text-slate-800 prose prose-indigo prose-sm max-w-none whitespace-pre-wrap">
                                    {aiAnalysis}
                                 </div>
                             </div>
                         )}
                    </section>

                    {/* Detailed Transcript Section */}
                    <section className="print:break-before-page pt-8 mt-8 border-t-2 border-slate-200">
                         <h3 className="text-xl font-bold text-slate-800 uppercase tracking-wider mb-6">Detailed Response Transcript</h3>
                         <div className="space-y-8">
                             {state.activeSections
                                .filter(id => id !== SectionId.INTRO && id !== SectionId.RESULTS && id !== SectionId.EMERGENCY)
                                .map(sectionId => {
                                    const section = SECTIONS_MAP[sectionId];
                                    return (
                                        <div key={sectionId} className="break-inside-avoid">
                                            <h4 className="text-sm font-bold text-slate-500 uppercase border-b border-slate-200 pb-2 mb-4">
                                                {section.title}
                                            </h4>
                                            <div className="space-y-2">
                                                {section.questions.map(q => {
                                                    const answer = state.answers[q.id];
                                                    return (
                                                        <div key={q.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 text-sm">
                                                            <div className="md:col-span-8 text-slate-700 font-medium">
                                                                {q.text}
                                                            </div>
                                                            <div className="md:col-span-4 text-slate-900 font-bold md:text-right bg-slate-50 p-1 md:bg-transparent rounded">
                                                                {formatAnswer(answer)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                             }
                         </div>
                    </section>
                </div>

                {/* Footer / Print Only Signature */}
                <div className="bg-slate-50 p-6 border-t border-slate-200 print:bg-white print:border-t-2 print:border-black print:mt-8">
                     <div className="hidden print:block mt-8 mb-4">
                         <div className="flex justify-between items-end">
                            <div className="w-64 border-b border-black pb-1 text-center">
                                <span className="text-xs text-slate-500 block text-left mb-8">Clinician Signature</span>
                            </div>
                            <div className="w-40 border-b border-black pb-1 text-center">
                                <span className="text-xs text-slate-500 block text-left mb-8">Date</span>
                            </div>
                         </div>
                     </div>
                     <p className="text-xs text-slate-400 text-center max-w-2xl mx-auto">
                        This summary is generated by a self-administered screening tool. It indicates potential symptom clusters but 
                        <strong> does not constitute a formal medical diagnosis.</strong> A comprehensive clinical interview is required for diagnosis and treatment planning.
                     </p>
                </div>
           </div>

           {/* Actions */}
           <div className="flex flex-col sm:flex-row gap-3 print:hidden justify-center pt-4 pb-12">
                <Button onClick={handlePrint} variant="primary" className="shadow-lg">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Clinical Report
                </Button>
                <Button onClick={handleCopySummary} variant="outline" className="bg-white">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    {copyFeedback || 'Copy Text Summary'}
                </Button>
                <Button onClick={handleEmailDoctor} variant="secondary" className="bg-slate-200 hover:bg-slate-300">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Email to Doctor
                </Button>
           </div>
        </div>
      </div>
    );
  }

  // --- INTRO PAGE ---
  if (currentSectionId === SectionId.INTRO) {
     return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Patient Self-Screening Tool</h1>
                <div className="prose prose-slate text-slate-600 mb-8">
                    <p>
                        This questionnaire helps map your current difficulties and decide which areas need a deeper clinical assessment. 
                        <strong> It is not a medical diagnosis.</strong>
                    </p>
                    <p className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400 text-yellow-800 font-medium">
                        If you are in immediate danger or thinking of harming yourself or someone else, stop now and contact local emergency services.
                    </p>
                    <p>
                        <strong>Answer choices:</strong><br/>
                        • For Yes/No questions, choose: Yes / No / Not sure<br/>
                        • If a question feels too uncomfortable, choose Not sure.
                    </p>
                </div>
                <Button onClick={handleNext} className="w-full md:w-auto md:px-12">Start Questionnaire</Button>
            </Card>
        </div>
     )
  }

  // --- STANDARD SECTION RENDERING ---
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="fixed top-0 left-0 w-full h-1.5 bg-slate-200 z-50 print:hidden">
        <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out" 
            style={{ width: `${((state.currentSectionIndex) / (state.activeSections.length - 1)) * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto pt-12 px-4">
        <div className="mb-8">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                Section {state.currentSectionIndex} of {state.activeSections.length - 1}
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mt-2">{sectionData.title}</h2>
            {sectionData.description && <p className="text-slate-500 mt-2">{sectionData.description}</p>}
        </div>

        {currentSectionId === SectionId.SAFETY && state.answers['s0_2'] === 'Yes' && (
             <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 text-sm border border-amber-200 animate-fade-in">
                <strong>Note:</strong> A clinician review is recommended urgently based on your answer, but please continue the questionnaire.
             </div>
        )}
        {currentSectionId === SectionId.MOOD && state.answers['m6'] === 'Yes' && (
             <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 text-sm border border-amber-200 animate-fade-in">
                <strong>Important:</strong> You indicated thoughts that life isn't worth living. Please consider seeking urgent support or speaking to a professional immediately.
             </div>
        )}

        <Card>
            {shouldSkipRestOfTrauma ? (
                <div className="text-slate-500 italic py-4">
                    Since you answered "No" to the first question, you can proceed to the next section.
                </div>
            ) : (
                sectionData.questions.map((q) => (
                    <QuestionRenderer
                        key={q.id}
                        question={q}
                        value={state.answers[q.id]}
                        onChange={(val) => handleAnswer(q.id, val)}
                    />
                ))
            )}
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-40 print:hidden">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
            <Button 
                onClick={handleBack} 
                variant="secondary" 
                disabled={state.currentSectionIndex <= 0}
            >
                Back
            </Button>
            
            <Button 
                onClick={handleNext} 
                disabled={!canProceed}
                className={!canProceed ? 'opacity-50 cursor-not-allowed' : ''}
            >
                {state.currentSectionIndex === state.activeSections.length - 2 ? 'Finish' : 'Next'}
            </Button>
        </div>
      </div>
    </div>
  );
}