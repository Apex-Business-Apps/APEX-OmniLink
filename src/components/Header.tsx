import { Link } from 'react-router-dom';
import apexHeaderLogo from '@/assets/apex-header-logo.png';

export const Header = () => {
  return <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="max-w-[calc(1280px+0.6cm)] mx-auto px-4 h-[61.6px] flex items-center justify-between">
      {/* Center - Wordmark */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[95%] flex items-center">
        <img
          src={apexHeaderLogo}
          alt="APEX OmniHub"
          className="h-full w-auto object-contain py-1 transition-transform duration-300 hover:scale-[1.02]"
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
  </header>;
};