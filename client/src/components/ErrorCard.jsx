// one detected error
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import CategoryChip from './CategoryChip.jsx';
import { categoryFor } from '../lib/category.js';

export default function ErrorCard({
  error,
  isSelected,
  onSelect,
  onReclassify = () => {},
  onRemove = () => {},
  onConfirm = () => {},
}) {
  const wasCorrected = Boolean(error.previousCategory);
  const isUncertain = error.isUncertain && !wasCorrected;

  const className = [
    'err-card',
    isSelected && 'err-card--selected',
    isUncertain && 'err-card--uncertain',
    wasCorrected && 'err-card--corrected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(error.errorId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(error.errorId);
      }}
    >
      {isUncertain && (
        <div className="err-card__badge err-card__badge--uncertain">
          Uncertain — needs your judgement
        </div>
      )}
      {wasCorrected && (
        <div className="err-card__badge err-card__badge--corrected">
          <Icon name="swap" size={13} /> Teacher-corrected — was{' '}
          {categoryFor(error.previousCategory).label}
        </div>
      )}

      <p className="err-card__text">“{error.originalText}”</p>

      <div className="err-card__meta">
        <CategoryChip category={error.category} />
        {!wasCorrected && (
          <span className="err-card__confidence">
            Confidence {Math.round(error.confidenceScore * 100)}%
          </span>
        )}
        {wasCorrected && error.correctionNote && (
          <span className="err-card__note">Note: “{error.correctionNote}”</span>
        )}
      </div>

      <div className="err-card__actions" onClick={(e) => e.stopPropagation()}>
        {isUncertain && (
          <Button variant="primary" icon="check" onClick={() => onConfirm(error.errorId)}>
            Confirm tag
          </Button>
        )}
        <Button variant="secondary" icon="swap" onClick={() => onReclassify(error.errorId)}>
          Reclassify
        </Button>
        <Button variant="tertiary" icon="trash" onClick={() => onRemove(error.errorId)}>
          Remove tag
        </Button>
      </div>
    </div>
  );
}
