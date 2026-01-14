import { siteConfig } from '@/content/site';

export function Steps() {
  return (
    <div className="steps">
      {siteConfig.howItWorks.steps.map((step, index) => (
        <div key={step.title} className="step">
          <div className="step__number">{index + 1}</div>
          <h3 className="step__title">{step.title}</h3>
          <p className="step__description">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
