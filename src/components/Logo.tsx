import React, { useState } from 'react';

export default function Logo({ className = "w-40" }: { className?: string }) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = "/input_file_0.png";

  if (!hasError) {
    return (
      <div className={`${className} relative flex items-center justify-center overflow-hidden`}>
        <img 
          src={logoUrl}
          alt="MyTuc"
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col items-center justify-center p-4 bg-slate-950 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group`}>
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-600/10 to-red-900/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
      
      <div className="relative w-full flex flex-col items-center z-10">
          {/* Professional Stylized Bus Logo (TUC Style) */}
          <div className="relative mb-3">
             <div className="absolute inset-0 bg-red-600/20 blur-xl rounded-full scale-150 animate-pulse"></div>
             <svg viewBox="0 0 100 60" className="w-24 h-16 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] transform transition-transform group-hover:scale-105 duration-500" xmlns="http://www.w3.org/2000/svg">
               {/* Modern Bus Body */}
               <path d="M5 15 C5 10 10 8 15 8 L85 8 C90 8 95 10 95 15 L95 45 C95 50 90 52 85 52 L15 52 C10 52 5 50 5 45 Z" fill="#ef4444" />
               <rect x="5" y="30" width="90" height="15" fill="#ffffff" /> {/* White stripe */}
               
               {/* Windows */}
               <rect x="10" y="12" width="15" height="12" rx="2" fill="#1e293b" />
               <rect x="28" y="12" width="15" height="12" rx="2" fill="#1e293b" />
               <rect x="46" y="12" width="15" height="12" rx="2" fill="#1e293b" />
               <rect x="64" y="12" width="15" height="12" rx="2" fill="#1e293b" />
               <rect x="82" y="12" width="10" height="12" rx="2" fill="#0f172a" /> {/* Front */}
               
               {/* Wheels */}
               <circle cx="25" cy="50" r="6" fill="#0f172a" />
               <circle cx="25" cy="50" r="3" fill="#334155" />
               <circle cx="75" cy="50" r="6" fill="#0f172a" />
               <circle cx="75" cy="50" r="3" fill="#334155" />
               
               {/* Lights */}
               <rect x="92" y="40" width="3" height="6" rx="1" fill="#fbbf24" /> {/* Headlight */}
               <rect x="5" y="40" width="2" height="6" rx="1" fill="#7f1d1d" /> {/* Taillight */}
             </svg>
          </div>
          
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-black italic tracking-tighter flex items-center leading-none">
              <span className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">MY</span>
              <span className="text-white">TUC</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-[2px] w-8 bg-gradient-to-r from-transparent to-red-500 rounded-full"></div>
              <span className="text-[10px] font-black tracking-[0.3em] text-slate-300 uppercase">TRANSPORTE URBANO</span>
              <div className="h-[2px] w-8 bg-gradient-to-l from-transparent to-red-500 rounded-full"></div>
            </div>
            <p className="text-[7px] font-bold text-slate-500 tracking-[0.4em] mt-2 uppercase">Sincronización Total Managua</p>
          </div>
      </div>
    </div>
  );
}
