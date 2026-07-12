// src/App.jsx
// ------------
// The root component. It decides which of the three screens is visible and
// owns the two pieces of state they all share.
//
// How the screens flow into each other:
//
//   SamplesList  --"Upload new sample"-->  UploadScreen
//   UploadScreen --after a successful upload-->  ReviewScreen (which runs
//                                                the AI analysis)
//   ReviewScreen --"Back to samples"-->  SamplesList
//
// There is no URL router here on purpose: three screens driven by one piece
// of state is simpler to read than a routing library, and this module
// doesn't need shareable URLs.

import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import SamplesList from './components/SamplesList.jsx'
import UploadScreen from './components/UploadScreen.jsx'
import ReviewScreen from './components/ReviewScreen.jsx'

function App() {
  // Which screen is showing: 'list', 'upload' or 'review'.
  const [screen, setScreen] = useState('list')

  // Which sample the review screen should show (null until one is chosen).
  const [currentSampleId, setCurrentSampleId] = useState(null)

  // The reading-comfort preference. Kept in React state (not browser
  // storage), so it simply resets on refresh.
  const [readingComfort, setReadingComfort] = useState(false)

  // Reading comfort works by nudging the ROOT font size up. Tailwind sizes
  // are in rem - multiples of the root size - so this one change scales the
  // whole interface at once. The wrapper div below adds the cream background
  // and the extra line/letter spacing.
  useEffect(() => {
    document.documentElement.style.fontSize = readingComfort ? '18.5px' : '17px'
  }, [readingComfort])

  function showSamplesList() {
    setCurrentSampleId(null)
    setScreen('list')
  }

  function showUploadScreen() {
    setScreen('upload')
  }

  function showReviewScreen(sampleId) {
    setCurrentSampleId(sampleId)
    setScreen('review')
  }

  const comfortClasses = readingComfort
    ? 'bg-comfort leading-loose tracking-wide'
    : 'bg-paper'

  return (
    <div className={`min-h-screen text-stone-800 transition-colors ${comfortClasses}`}>
      <Header
        readingComfort={readingComfort}
        onToggleReadingComfort={() => setReadingComfort(!readingComfort)}
        onGoHome={showSamplesList}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {screen === 'list' && (
          <SamplesList
            onUploadNew={showUploadScreen}
            onOpenSample={showReviewScreen}
          />
        )}

        {screen === 'upload' && (
          <UploadScreen
            onCancel={showSamplesList}
            onUploaded={showReviewScreen}
          />
        )}

        {screen === 'review' && currentSampleId && (
          <ReviewScreen
            sampleId={currentSampleId}
            onBackToList={showSamplesList}
          />
        )}
      </main>
    </div>
  )
}

export default App
