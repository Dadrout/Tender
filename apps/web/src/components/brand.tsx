export type BrandIconName =
  | "catalog"
  | "tender-document"
  | "product-match"
  | "calculator"
  | "risk-assessment"
  | "report";

export function QazBidMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 80 80"
      width={size}
      height={size}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 8h34l15 15v29" strokeWidth="6" />
        <path d="M14 8v58h22" strokeWidth="6" />
        <path d="M48 8v16h15" strokeWidth="5" />
        <path d="M24 35h25M24 45h25" strokeWidth="5" />
        <path d="m34 59 10 10 26-28" stroke="var(--good)" strokeWidth="7" />
      </g>
    </svg>
  );
}

export function BrandIcon({
  name,
  size = 20,
}: {
  name: BrandIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="brand-icon"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="4.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "catalog" && (
        <>
          <rect x="9" y="8" width="46" height="48" rx="3" />
          <rect x="16" y="15" width="12" height="12" rx="1" />
          <rect
            x="36"
            y="15"
            width="12"
            height="12"
            rx="1"
            fill="var(--good)"
            stroke="var(--good)"
          />
          <rect x="16" y="35" width="12" height="12" rx="1" />
          <rect x="36" y="35" width="12" height="12" rx="1" />
        </>
      )}
      {name === "tender-document" && (
        <>
          <path d="M17 7h22l10 10v40H17z" />
          <path d="M39 7v11h10M24 29h18M24 37h18M24 45h13" />
          <path d="M24 45h13" stroke="var(--good)" strokeWidth="5.2" />
        </>
      )}
      {name === "product-match" && (
        <>
          <path d="m10 21 20-11 20 11-20 12zM10 21v23l20 11 20-11V21M30 33v22M10 21l20 12 20-12" />
          <circle
            cx="47"
            cy="46"
            r="10"
            fill="var(--panel)"
            stroke="var(--good)"
          />
          <path
            d="m42.5 46 3 3 6-6.5"
            stroke="var(--good)"
            strokeWidth="5.2"
          />
        </>
      )}
      {name === "calculator" && (
        <>
          <rect x="11" y="6" width="42" height="52" rx="4" />
          <rect x="18" y="13" width="28" height="10" rx="1.5" />
          <rect x="18" y="30" width="6" height="6" rx="1" />
          <rect x="29" y="30" width="6" height="6" rx="1" />
          <rect
            x="40"
            y="30"
            width="6"
            height="6"
            rx="1"
            fill="var(--warning)"
            stroke="var(--warning)"
          />
          <rect x="18" y="42" width="6" height="6" rx="1" />
          <rect x="29" y="42" width="6" height="6" rx="1" />
          <rect x="40" y="42" width="6" height="6" rx="1" />
        </>
      )}
      {name === "risk-assessment" && (
        <>
          <path d="M32 6 51 14v15c0 13-8 22-19 29C21 51 13 42 13 29V14z" />
          <path
            d="m23 32 6 6 13-14"
            stroke="var(--good)"
            strokeWidth="5.2"
          />
        </>
      )}
      {name === "report" && (
        <>
          <path d="M15 7h24l10 10v40H15zM39 7v11h10" />
          <path d="M23 47V38M32 47V31M41 47V24" stroke="var(--good)" strokeWidth="6" />
          <path d="M22 50h21" />
        </>
      )}
    </svg>
  );
}
