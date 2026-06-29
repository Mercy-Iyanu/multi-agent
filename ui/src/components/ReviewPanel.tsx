import type { ReviewPanelData } from "../App.tsx";

interface Props {
  panel: ReviewPanelData;
  recommendation: string;
}

const ROLES: Array<{ key: keyof ReviewPanelData; label: string }> = [
  { key: "flightSpecialist",       label: "✈ Flight Specialist" },
  { key: "convenienceSpecialist",  label: "⏱ Convenience" },
  { key: "budgetAnalyst",          label: "💰 Budget Analyst" },
  { key: "familyReviewer",         label: "👨‍👩‍👧 Family Reviewer" },
];

export default function ReviewPanel({ panel, recommendation }: Props) {
  return (
    <div className="row row--assistant">
      <div className="review-wrap">
        <div className="review-card">
          <div className="review-card-header">
            <span>⭐</span>
            Specialist Review
          </div>

          <div className="review-grid">
            {ROLES.map(({ key, label }) => (
              <div key={key} className="review-cell">
                <span className="review-cell-role">{label}</span>
                <p>{panel[key]}</p>
              </div>
            ))}
          </div>

          <div className="review-recommendation">
            <span className="review-rec-label">Recommended</span>
            <p className="review-rec-text">{recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
