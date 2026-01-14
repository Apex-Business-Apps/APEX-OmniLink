import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  id?: string;
  variant?: 'default' | 'surface' | 'navy';
  className?: string;
}

export function Section({
  children,
  id,
  variant = 'default',
  className = '',
}: Readonly<SectionProps>) {
  const variantClass = variant === 'default' ? '' : `section--${variant}`;

  return (
    <section id={id} className={`section ${variantClass} ${className}`.trim()}>
      <div className="container">{children}</div>
    </section>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  centered = true,
}: Readonly<SectionHeaderProps>) {
  return (
    <div className={`mb-8 ${centered ? 'text-center' : ''}`}>
      <h2 className="heading-2">{title}</h2>
      {subtitle && (
        <p className="text-lg text-secondary mt-4">{subtitle}</p>
      )}
    </div>
  );
}
