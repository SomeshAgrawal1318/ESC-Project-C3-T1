// Root component - picks which screen is showing. No router; a few screens
// driven by one state value is simpler here and we don't need shareable URLs.

import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import SamplesList from './components/SamplesList.jsx'
import UploadScreen from './components/UploadScreen.jsx'
import ReviewScreen from './components/ReviewScreen.jsx'
import StudentProfile from './pages/StudentProfile.jsx'

function App() {
  // 'list' | 'upload' | 'review' | 'profile'
  const [screen, setScreen] = useState('list')
  const [currentSampleId, setCurrentSampleId] = useState(null)
  const [readingComfort, setReadingComfort] = useState(false)

  // Tailwind sizes are in rem, so bumping the root font size scales everything at once.
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

  function showStudentProfile() {
    setScreen('profile')
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
        onOpenStudents={showStudentProfile}
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

        {screen === 'profile' && (
          <StudentProfile onOpenSample={showReviewScreen} />
        )}
      </main>
    </div>
  )
}

export default App
