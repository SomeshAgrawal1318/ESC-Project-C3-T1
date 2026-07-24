// /styleguide — the living reference for the LexiPath design system.
// Renders the real components with the real tokens so the team can see
// (and copy) the approved patterns. The written rules live in
// client/DESIGN.md; if you add a reusable pattern, show it here too.

import Button from '../components/Button.jsx';
import StatusPill from '../components/StatusPill.jsx';
import SampleRow from '../components/SampleRow.jsx';
import Logo from '../components/Logo.jsx';

// Display-only fixtures — nothing here touches the API.
const DEMO_SAMPLES = [
  {
    sampleId: 'demo_ready',
    title: 'Composition — “My School Holiday”',
    uploadedAt: '2026-07-12T09:15:00.000Z',
    analysisStatus: 'ANALYSED',
    imageCount: 2,
  },
  {
    sampleId: 'demo_waiting',
    title: 'Spelling exercise — Week 28',
    uploadedAt: '2026-07-10T08:02:00.000Z',
    analysisStatus: 'UPLOADED',
    imageCount: 1,
  },
];

const SWATCHES = [
  { name: 'Ink', varName: '--ink', use: 'sidebar · primary · text' },
  { name: 'Sage', varName: '--sage', use: 'accent only' },
  { name: 'Sage strong', varName: '--sage-strong', use: 'sage for text' },
  { name: 'Mist', varName: '--mist', use: 'quiet rules' },
  { name: 'Paper', varName: '--paper', use: 'content ground' },
  { name: 'Surface', varName: '--surface', use: 'card faces' },
];

export default function StyleguidePage() {
  return (
    <div className="guide">
      <header className="students__id">
        <span className="eyebrow">Design system</span>
        <h1 className="students__title">Styleguide</h1>
        <p className="guide__intro">
          Live render of the approved LexiPath patterns. The rules and the
          reasoning are written down in <code>client/DESIGN.md</code> — read
          it before inventing a new pattern.
        </p>
      </header>

      <Section label="Brand mark">
        <div className="guide__row">
          <Logo size={44} />
          <Logo size={44} variant="light" />
        </div>
        <p className="guide__note">
          “brand” for light surfaces, “light” for the navy sidebar. The sage
          bowl survives in both — it is where the bowl-corner radius comes
          from.
        </p>
      </Section>

      <Section label="Palette">
        <div className="guide__row">
          {SWATCHES.map((swatch) => (
            <div key={swatch.varName} className="guide__swatch">
              <div
                className="guide__chip"
                style={{ background: `var(${swatch.varName})` }}
              />
              <div className="guide__swatch-meta">
                <span>{swatch.name}</span>
                <code>{swatch.varName}</code>
                <code>{swatch.use}</code>
              </div>
            </div>
          ))}
        </div>
        <p className="guide__note">
          Always use the CSS variables from index.css, never raw hex. Navy is
          the primary action colour; sage never carries white text.
        </p>
      </Section>

      <Section label="Page header pattern">
        <span className="eyebrow">Student profile</span>
        <h2 className="students__title">Page title in Lexend 500</h2>
        <span className="grade">Primary 4</span>
        <p className="guide__note">
          Every screen opens eyebrow → title → meta chip → actions. On a
          student’s own screens the header sits on the ruled band (see the
          profile page).
        </p>
      </Section>

      <Section label="Buttons">
        <div className="guide__row">
          <Button variant="primary" icon="upload">
            Upload writing sample
          </Button>
          <Button variant="secondary" icon="trends">
            View error trends
          </Button>
          <Button
            variant="secondary"
            disabled
            disabledHint="Available once a sample has been analysed"
          >
            View recommendations
          </Button>
        </div>
        <p className="guide__note">
          Locked actions are dashed, never hidden — the educator should see
          what unlocks and when.
        </p>
      </Section>

      <Section label="Status margin notes">
        <div className="guide__row">
          <StatusPill analysisStatus="ANALYSED" />
          <StatusPill analysisStatus="REVIEWED" />
          <StatusPill analysisStatus="UPLOADED" />
          <StatusPill analysisStatus="FAILED" />
        </div>
        <p className="guide__note">
          A teacher’s annotation, not a badge: status ink never fills a
          shape. Rounded pill badges are explicitly banned (DESIGN.md §2).
        </p>
      </Section>

      <Section label="Sample rows">
        <div className="guide__row">
          {DEMO_SAMPLES.map((sample) => (
            <SampleRow key={sample.sampleId} sample={sample} />
          ))}
        </div>
        <p className="guide__note">
          Ready rows link to the report; analysing rows are dashed and inert.
          The thumbnail is a miniature ruled page with the bowl corner.
        </p>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <section className="guide__section">
      <span className="eyebrow">{label}</span>
      {children}
    </section>
  );
}
