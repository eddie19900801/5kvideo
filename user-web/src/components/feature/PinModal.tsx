import { useState, useRef, useEffect } from 'react';

interface PinModalProps {
  mode: 'setup' | 'verify';
  error?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

export default function PinModal({ mode, error: externalError, onConfirm, onCancel }: PinModalProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const digitsRef = useRef(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDigits(['', '', '', '']);
    setError('');
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

  const handleChange = (index: number, value: string) => {
    const num = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digitsRef.current];
    newDigits[index] = num;
    setDigits(newDigits);
    setError('');

    if (num && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digitsRef.current[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    const pin = digitsRef.current.join('');
    if (pin.length !== 4) {
      setError('请输入完整的4位PIN码');
      return;
    }
    onConfirm(pin);
  };

  const title = mode === 'setup' ? '设置PIN码' : '验证PIN码';
  const subtitle = mode === 'setup'
    ? '首次进入18+模式，请先设置4位数字PIN码'
    : '请输入4位PIN码以切换到18+模式';

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-[300px] bg-background-200 rounded-2xl p-6">
        <h3 className="text-foreground-100 text-lg font-semibold text-center">{title}</h3>
        <p className="text-foreground-500 text-xs text-center mt-1 mb-6">{subtitle}</p>

        <div className="flex justify-center gap-3 mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 bg-background-100 rounded-xl text-center text-xl font-bold text-foreground-100 border border-background-300/60 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all outline-none"
            />
          ))}
        </div>

        {(error || externalError) && (
          <p className="text-red-400 text-xs text-center mb-4">{error || externalError}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-background-300 text-foreground-400 rounded-xl text-sm font-medium hover:bg-background-400 transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-primary-500 text-background-50 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors whitespace-nowrap"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}