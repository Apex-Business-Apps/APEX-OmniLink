import { Link } from 'react-router-dom';
import builtCanadianBadge from '@/assets/built_canadian_badge.svg';
import apexEmblem from '@/assets/apex_emblem_logo.svg';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left group */}
        <div className="flex items-center gap-3">
          <img 
            src={builtCanadianBadge} 
            alt="" 
            aria-hidden="true" 
            className="h-6 md:h-7 w-auto opacity-90 hover:opacity-100 transition-opacity" 
            title="Built Canadian" 
          />
          <div className="flex items-center gap-2">
            <img 
              src={apexEmblem} 
              alt="APEX Business Systems emblem" 
              className="h-8 w-8" 
            />
            <span className="text-sm font-semibold text-[hsl(var(--navy))] hidden sm:inline">
              APEX Business Systems
            </span>
          </div>
        </div>

        {/* Right group - empty for now, nav can go here */}
        <div className="flex items-center gap-4">
          {/* Future nav items */}
        </div>
      </div>
    </header>
  );
};