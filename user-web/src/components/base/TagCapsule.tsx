interface TagCapsuleProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  showHash?: boolean;
}

export default function TagCapsule({ label, selected, onClick, showHash = true }: TagCapsuleProps) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
        selected
          ? 'bg-primary-500 text-background-50'
          : 'bg-background-200 text-foreground-400 hover:bg-background-300'
      }`}
    >
      {showHash ? '#' : ''}{label}
    </button>
  );
}