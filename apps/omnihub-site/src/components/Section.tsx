import { ReactNode } from 'react';

type SectionProps = Readonly<{
  children: ReactNode;
  id?: string;
  variant?: 'default' | 'surface' | 'navy';
  className?: string;
}>;

export function Section({
  children,
  id,
  variant = 'default',
  className = '',
}: SectionProps) {
  const variantClass = variant === 'default' ? '' : `section--${variant}`;

  return (
    <section id={id} className={`section ${variantClass} ${className}`.trim()}>
      <div className="container">{children}</div>
    </section>
  );
}

type SectionHeaderProps = Readonly<{
  title: string;
  subtitle?: string;
  centered?: boolean;
}>;

export function SectionHeader({
  title,
  subtitle,
  centered = true,
}: SectionHeaderProps) {
  return (
    <div className={`mb-8 ${centered ? 'text-center' : ''}`}>
      <h2 className="heading-2">{title}</h2>
      {subtitle && (
        <p className="text-lg text-secondary mt-4">{subtitle}</p>
      )}
    </div>
  );
}
