import { siteConfig } from '@/content/site';

export function Stamp() {
  return (
    <div className="stamp">
      <p className="stamp__headline">{siteConfig.stamp.headline}</p>
      <p className="stamp__tagline">{siteConfig.stamp.tagline}</p>
    </div>
  );
}
