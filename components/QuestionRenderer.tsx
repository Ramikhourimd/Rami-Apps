import React from 'react';
import { Question } from '../types';
import { RadioGroup, CheckboxGroup } from './UI';

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (val: any) => void;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({ question, value, onChange }) => {
  return (
    <div className="mb-8 last:mb-0 animate-fade-in-up">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 leading-snug">{question.text}</h3>
        {question.subText && <p className="text-sm text-slate-500 mt-1">{question.subText}</p>}
      </div>

      <div className="mt-3">
        {question.type === 'yes-no' || question.type === 'single-select' ? (
          <RadioGroup
            options={question.options || []}
            selected={value as string}
            onChange={onChange}
          />
        ) : question.type === 'multi-select' ? (
          <CheckboxGroup
            options={question.options || []}
            selected={(value as string[]) || []}
            onChange={onChange}
          />
        ) : question.type === 'text' ? (
          <textarea
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            rows={3}
            placeholder={question.placeholder || 'Type here...'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : question.type === 'date' ? (
          <input
            type="date"
            className="w-full md:w-auto p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : question.type === 'scale' ? (
          <div className="px-2 py-4">
            <div className="relative mb-6">
               <input
                type="range"
                min={question.min}
                max={question.max}
                value={typeof value === 'number' ? value : 0}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div
                className="absolute top-8 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded shadow pointer-events-none transition-all"
                style={{ left: `${((typeof value === 'number' ? value : 0) / (question.max || 10)) * 100}%` }}
              >
                {typeof value === 'number' ? value : 0}
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wide font-medium">
              <span>Not at all</span>
              <span>Severely</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};