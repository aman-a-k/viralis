// Viralis logo mark: a rounded tile with a "V" chevron and the orange dot.
// "reversed" (white tile) is for dark surfaces, "primary" (dark tile) for light.
export function BrandMark({
  size = 28,
  variant = "reversed",
}: {
  size?: number;
  variant?: "reversed" | "primary";
}) {
  const tile = variant === "reversed" ? "#ffffff" : "#111111";
  const chevron = variant === "reversed" ? "#111111" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" role="img" aria-label="Viralis" style={{ flexShrink: 0 }}>
      <rect width="96" height="96" rx="24" fill={tile} />
      <path d="M24 31L48 69L72 31" stroke={chevron} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="26" r="7.5" fill="#FF5A1F" />
    </svg>
  );
}
