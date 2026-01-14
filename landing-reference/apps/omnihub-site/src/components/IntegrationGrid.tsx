interface IntegrationItem {
  title: string;
  description: string;
}

interface IntegrationGridProps {
  items: readonly IntegrationItem[];
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IntegrationGrid({ items }: IntegrationGridProps) {
  return (
    <div className="integration-grid" role="list">
      {items.map((item) => (
        <div key={item.title} className="card integration-card" role="listitem">
          <div className="integration-card__icon">
            <LinkIcon />
          </div>
          <h3 className="heading-4 integration-card__title">{item.title}</h3>
          <p className="text-sm text-secondary mt-4">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
