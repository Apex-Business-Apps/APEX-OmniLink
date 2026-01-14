/**
 * ShowcaseCard Component
 * Displays a showcase item with image and label
 */

interface ShowcaseCardProps {
    image: string;
    label: string;
    alt: string;
}

export function ShowcaseCard({ image, label, alt }: Readonly<ShowcaseCardProps>) {
    return (
        <div className="showcase-card">
            <img src={image} alt={alt} className="showcase-card__image" />
            <div className="showcase-card__label">{label}</div>
        </div>
    );
}
