// The scanned sample with zoom controls and outline markers over each
// (non-dismissed) error, positioned from its normalised locationOnScan box.
// Clicking an outline selects the matching card, and vice versa.

import { useState } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { categoryFor } from '../lib/category.js';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

export default function ScanViewer({ imageUrl, pageCount=1, currentPage, onPageChange, errors, selectedErrorId, onSelect }) {
  const [zoom, setZoom] = useState(1);
  const outlined = errors.filter((e) => !e.dismissed && e.locationOnScan);

  return (
    <div className="scan">
      <div className="scan__toolbar">
        <span className="scan__label">Scanned sample</span>
        {pageCount > 1 && (
            <div className="scan__pages">
            <Button variant="tertiary" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>
                <Icon name="chevronLeft" size={16} />
            </Button>
            <span>{currentPage + 1} / {pageCount}</span>
            <Button variant="tertiary" disabled={currentPage === pageCount - 1} onClick={() => onPageChange(currentPage + 1)}>
                <Icon name="chevronRight" size={16} />
            </Button>
          </div>
        )}
        <div className="scan__zoom">
          <Button
            variant="tertiary"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          >
            <Icon name="zoomOut" size={17} />
          </Button>
          <span className="scan__zoom-value">{Math.round(zoom * 100)}%</span>
          <Button
            variant="tertiary"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          >
            <Icon name="zoomIn" size={17} />
          </Button>
          <Button variant="tertiary" aria-label="Fit to width" onClick={() => setZoom(1)}>
            <Icon name="fit" size={17} />
          </Button>
        </div>
      </div>

      <div className="scan__viewport">
        <div className="scan__scaler" style={{ transform: `scale(${zoom})` }}>
          <div className="scan__image-wrap">
            {imageUrl ? (
              <img src={imageUrl} alt="Scanned handwriting sample" className="scan__image" />
            ) : (
              <div className="scan__image scan__image--placeholder">
                <Icon name="page" size={32} />
                <span>Scan preview unavailable in mock mode</span>
              </div>
            )}
            {outlined.map((error, index) => {
              const box = error.locationOnScan;
              const isSelected = error.errorId === selectedErrorId;
              const { short } = categoryFor(error.category);
              return (
                <button
                  key={error.errorId}
                  type="button"
                  className={`scan__outline${isSelected ? ' scan__outline--selected' : ''}`}
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                  }}
                  onClick={() => onSelect(error.errorId)}
                  aria-label={`Error ${index + 1}, ${categoryFor(error.category).label}${
                    isSelected ? ', selected' : ''
                  }`}
                >
                  <span className="scan__outline-label">
                    {index + 1} · {short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="scan__hint">Click an outline to select its card, or vice versa.</p>
    </div>
  );
}
