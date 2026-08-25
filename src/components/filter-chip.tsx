export function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        selected
          ? "border-accent/60 bg-accent-soft text-accent"
          : "border-white/10 bg-white/[0.04] text-muted-strong hover:border-white/25"
      }`}
    >
      {label}
    </button>
  );
}
