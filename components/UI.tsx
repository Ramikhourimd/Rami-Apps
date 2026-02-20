import React from 'react';

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  className?: string;
}) => {
  const baseStyle = "px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 active:scale-95",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-md active:scale-95",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

export const CheckboxGroup = ({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) => {
  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="grid gap-3">
      {options.map((opt) => (
        <label
          key={opt}
          className={`
            flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all
            ${selected.includes(opt) 
              ? 'border-blue-500 bg-blue-50/50' 
              : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}
          `}
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${selected.includes(opt) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
             {selected.includes(opt) && (
               <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
               </svg>
             )}
          </div>
          <span className="text-slate-700 font-medium">{opt}</span>
          <input
            type="checkbox"
            className="hidden"
            checked={selected.includes(opt)}
            onChange={() => toggleOption(opt)}
          />
        </label>
      ))}
    </div>
  );
};

export const RadioGroup = ({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected?: string;
  onChange: (val: string) => void;
}) => {
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <label
          key={opt}
          className={`
            flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all
            ${selected === opt
              ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
              : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}
          `}
        >
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors ${selected === opt ? 'border-blue-500' : 'border-slate-300'}`}>
             {selected === opt && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
          </div>
          <span className="text-slate-700 font-medium">{opt}</span>
          <input
            type="radio"
            className="hidden"
            checked={selected === opt}
            onChange={() => onChange(opt)}
          />
        </label>
      ))}
    </div>
  );
};