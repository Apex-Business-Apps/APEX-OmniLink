/**
 * FeatureCard Component
 * Displays a feature with icon, title, and description
 */

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="feature-card">
            <div className="feature-card__icon">{icon}</div>
            <h3 className="feature-card__title heading-4">{title}</h3>
            <p className="feature-card__description text-secondary">{description}</p>
        </div>
    );
}
