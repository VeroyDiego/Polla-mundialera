interface DigitCellInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function DigitCellInput({ value, onChange, disabled, ariaLabel }: DigitCellInputProps) {
  return (
    <input
      className="digit-cell"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        if (raw === "") {
          onChange("");
          return;
        }
        const n = Number(raw);
        onChange(Math.min(99, n));
      }}
    />
  );
}

interface DigitCellStaticProps {
  value: number;
  correct?: boolean;
}

export function DigitCellStatic({ value, correct }: DigitCellStaticProps) {
  return <div className={`digit-cell digit-cell--static ${correct ? "digit-cell--correct" : ""}`}>{value}</div>;
}

export function DigitSeparator() {
  return <span className="digit-sep">:</span>;
}
