import { Link } from 'react-router-dom';
import builtCanadianBadge from '@/assets/built_canadian_badge.svg';
import SecretLogin from '@/components/SecretLogin';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[calc(1280px+0.6cm)] mx-auto px-4 h-[61.6px] flex items-center justify-between">
        {/* Left group */}
        <div className="flex items-center gap-3">
          <SecretLogin>
            <img
              src={builtCanadianBadge}
              alt=""
              aria-hidden="true"
              className="h-6 md:h-7 w-auto opacity-90 hover:opacity-100 transition-opacity scale-[1.822]"
              title="Built Canadian"
            />
          </SecretLogin>
        </div>

        {/* Center - Wordmark */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img
            src="/apex-omnihub-wordmark.png"
            alt="APEX OmniHub"
            className="h-[48px] w-auto"
          />
        </div>

        {/* Right group */}
        <div className="flex items-center gap-4">
          <Link
            to="/tech-specs"
            className="text-sm font-medium text-[hsl(var(--navy))] hover:text-[hsl(var(--navy-600))] transition-colors"
          >
            Tech Specs
          </Link>
        </div>
      </div>
    </header>
  );
};