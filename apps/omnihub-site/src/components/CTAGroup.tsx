interface CTAButton {
  label: string;
  href: string;
}

type CTAGroupProps = Readonly<{
  primary?: CTAButton;
  secondary?: CTAButton;
  link?: CTAButton;
  centered?: boolean;
}>;

export function CTAGroup({
  primary,
  secondary,
  link,
  centered = false,
}: CTAGroupProps) {
  return (
    <div className={`cta-group ${centered ? 'cta-group--center' : ''}`}>
      {primary && (
        <a href={primary.href} className="btn btn--primary btn--lg">
          {primary.label}
        </a>
      )}
      {secondary && (
        <a href={secondary.href} className="btn btn--secondary btn--lg">
          {secondary.label}
        </a>
      )}
      {link && (
        <a href={link.href} className="btn btn--ghost">
          {link.label} &rarr;
        </a>
      )}
    </div>
  );
}
