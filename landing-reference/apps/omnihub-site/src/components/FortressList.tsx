import { siteConfig } from '@/content/site';

export function FortressList() {
  return (
    <ul className="fortress-list">
      {siteConfig.fortress.items.map((item) => (
        <li key={item} className="fortress-list__item">
          {item}
        </li>
      ))}
    </ul>
  );
}
