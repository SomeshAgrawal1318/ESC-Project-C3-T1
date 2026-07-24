// Honest stand-in for screens that belong to later slices (error report,
// trends, recommendations). Keeps links from dead-ending.

export default function Placeholder({ label }) {
  return (
    <div className="feedback">
      <h2 className="feedback__title">{label}</h2>
      <p className="feedback__text">
        This screen isn’t built yet — it’s part of a later slice.
      </p>
    </div>
  );
}
