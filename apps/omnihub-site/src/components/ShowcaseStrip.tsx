interface ShowcaseItem {
  title: string;
  image: string;
}

interface ShowcaseStripProps {
  items: readonly ShowcaseItem[];
}

export function ShowcaseStrip({ items }: Readonly<ShowcaseStripProps>) {
  return (
    <ul className="showcase">
      {items.map((item) => (
        <li key={item.title} className="showcase__item">
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
        </li>
      ))}
    </ul>
  );
}
