interface FeatureItem {
  title: string;
  description: string;
}

interface FeatureHighlightGridProps {
  items: readonly FeatureItem[];
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M12 2l1.3 6.2L20 10l-6.7 1.8L12 18l-1.3-6.2L4 10l6.7-1.8L12 2Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M12 2l1.3 6.2L20 10l-6.7 1.8L12 18l-1.3-6.2L4 10l6.7-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeatureHighlightGrid({ items }: Readonly<FeatureHighlightGridProps>) {
  return (
    <ul className="feature-grid">
      {items.map((item) => (
        <li key={item.title} className="card feature-card">
          <div className="feature-card__icon">
            <SparkIcon />
          </div>
          <h3 className="heading-4 feature-card__title">{item.title}</h3>
          <p className="text-sm text-secondary mt-4">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
