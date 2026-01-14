interface ShowcaseItem {
  title: string;
  caption: string;
}

interface ShowcaseStripProps {
  items: readonly ShowcaseItem[];
}

export function ShowcaseStrip({ items }: ShowcaseStripProps) {
  return (
    <div className="showcase" role="list">
      {items.map((item) => (
        <div key={item.title} className="showcase__item" role="listitem">
          <div className="showcase__thumb" aria-hidden="true">
            <div className="showcase__thumb-inner" />
          </div>
          <div className="showcase__meta">
            <div className="showcase__title">{item.title}</div>
            <div className="showcase__caption">{item.caption}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
