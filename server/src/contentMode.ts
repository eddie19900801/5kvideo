export type ContentMode = 'normal' | 'adult';

export const contentMode = (value: unknown): ContentMode => value === 'adult' ? 'adult' : 'normal';

