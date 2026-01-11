import { proofConfig } from '@/content/site';

export function ProofGrid() {
  return (
    <div className="proof-grid">
      {proofConfig.tiles.map((tile) => (
        <div key={tile.id} className="proof-tile">
          <p className="proof-tile__label">{tile.label}</p>
          <p
            className={`proof-tile__value ${
              tile.verified ? 'proof-tile__value--verified' : ''
            }`}
          >
            {tile.value}
          </p>
        </div>
      ))}
    </div>
  );
}
