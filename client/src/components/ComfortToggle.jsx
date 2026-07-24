// The reading-comfort switch that lives in the sidebar. A real switch
// (role/aria-checked) so it is keyboard- and screen-reader-operable.

import { useComfort } from '../context/ComfortContext.jsx';

export default function ComfortToggle() {
  const { comfort, toggle } = useComfort();
  return (
    <div className="comfort">
      <div className="comfort__text">
        <span className="comfort__label">
          <span aria-hidden="true">Aa</span> Reading comfort
        </span>
        <span className="comfort__hint">Warm tint · wider spacing</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={comfort}
        aria-label="Reading comfort"
        className={`switch${comfort ? ' switch--on' : ''}`}
        onClick={toggle}
      >
        <span className="switch__knob" />
      </button>
    </div>
  );
}
