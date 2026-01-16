interface ShowcaseItem {
  title: string;
  image: string;
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
            <img
              src={item.image}
              alt=""
              className="showcase__image"
              loading="lazy"
            />
          </div>
          <div className="showcase__meta">
            <div className="showcase__title">{item.title}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
