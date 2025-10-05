import { Link } from 'react-router-dom';
import builtCanadianBadge from '@/assets/built_canadian_badge.svg';
import apexEmblem from '@/assets/apex_emblem_logo.svg';
import apexWordmark from '@/assets/apex_wordmark_hero.svg';
import SecretLogin from '@/components/SecretLogin';

export const Header = () => {
  return <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[calc(1280px+0.6cm)] mx-auto px-4 h-[61.6px] flex items-center justify-between">
        {/* Left group */}
        <div className="flex items-center gap-3">
          <SecretLogin>
            <img src={builtCanadianBadge} alt="" aria-hidden="true" className="h-6 md:h-7 w-auto opacity-90 hover:opacity-100 transition-opacity scale-[1.2]" title="Built Canadian" />
          </SecretLogin>
        </div>

        {/* Center - Wordmark */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img src={apexWordmark} alt="Apex" className="h-[142px] w-auto" style={{ transform: 'skewX(-5deg) translateY(0.2cm) scaleX(1.2)' }} />
        </div>

        {/* Right group - empty for now, nav can go here */}
        <div className="flex items-center gap-4">
          {/* Future nav items */}
        </div>
      </div>
    </header>;
};