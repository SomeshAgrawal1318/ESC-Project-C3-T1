// src/components/ImageViewer.jsx
// -------------------------------
// The zoomable, pannable view of the original scan. Verifying a flagged
// mistake means looking closely at the child's actual handwriting, so the
// educator needs to zoom right in.
//
// How it works: the image sits inside a fixed-size box with overflow-hidden.
// We keep a zoom level and an x/y offset in state, and apply them with a
// CSS transform. Dragging the image updates the offset; the buttons update
// the zoom.

import { useState, useRef } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

function ImageViewer({ imageUrl, altText }) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Drag bookkeeping lives in a ref, not state, because it changes on every
  // mouse movement and doesn't need to re-render anything by itself.
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 })

  function zoomIn() {
    setZoomLevel((current) => Math.min(current * 1.4, 8))
  }

  function zoomOut() {
    setZoomLevel((current) => Math.max(current / 1.4, 0.5))
  }

  function resetView() {
    setZoomLevel(1)
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerDown(event) {
    // Pointer capture keeps the drag alive even if the cursor briefly
    // leaves the image while moving fast.
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      isDragging: true,
      startX: event.clientX - offset.x,
      startY: event.clientY - offset.y,
    }
  }

  function handlePointerMove(event) {
    if (!dragState.current.isDragging) {
      return
    }
    setOffset({
      x: event.clientX - dragState.current.startX,
      y: event.clientY - dragState.current.startY,
    })
  }

  function handlePointerUp() {
    dragState.current.isDragging = false
  }

  const buttonClasses =
    'rounded-lg border border-stone-300 bg-white p-2 text-stone-700 shadow-sm transition-colors hover:border-primary hover:text-primary'

  const isPdf = imageUrl.toLowerCase().split('?')[0].endsWith('.pdf')

  if (isPdf) {
    return (
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <iframe
          src={imageUrl}
          title={altText}
          className="h-[70vh] w-full"
        />
        <p className="border-t border-stone-200 px-4 py-2 text-center text-sm text-stone-500">
          Use the PDF viewer controls to zoom and move between pages
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
      {/* The zoom controls float over the image, top-right. */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button type="button" onClick={zoomIn} aria-label="Zoom in" className={buttonClasses}>
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={zoomOut} aria-label="Zoom out" className={buttonClasses}>
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={resetView} aria-label="Reset zoom and position" className={buttonClasses}>
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        className="flex h-[70vh] items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={imageUrl}
          alt={altText}
          draggable={false}
          className="max-h-full max-w-full cursor-grab select-none active:cursor-grabbing"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomLevel})`,
          }}
        />
      </div>

      <p className="border-t border-stone-200 bg-white px-4 py-2 text-center text-sm text-stone-500">
        Drag to move · use the buttons to zoom
      </p>
    </div>
  )
}

export default ImageViewer
