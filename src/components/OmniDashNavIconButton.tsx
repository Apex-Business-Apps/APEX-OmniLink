import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface OmniDashNavIconButtonProps {
  to: string;
  label: string;
  icon: string;
  isActive?: boolean;
}

export const OmniDashNavIconButton = ({ to, label, icon }: OmniDashNavIconButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          data-testid={`omnidash-nav-${icon.toLowerCase()}`}
          aria-label={label}
          className={({ isActive }) =>
            `flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/20'
                : 'bg-muted hover:bg-muted/70 border-muted-foreground/20'
            }`
          }
        >
          <span className="sr-only">{label}</span>
          {icon}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};