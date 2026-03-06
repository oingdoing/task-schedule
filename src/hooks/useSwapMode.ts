import { useState } from 'react';
import type { SwapDutyType } from '../types/schedule';

export interface SwapTarget {
  slotId: string;
  date: string;
  dutyType: SwapDutyType;
  person: string;
}

export function useSwapMode() {
  const [source, setSource] = useState<SwapTarget | null>(null);

  const reset = () => setSource(null);
  const selectSource = (target: SwapTarget) => setSource(target);

  return {
    source,
    reset,
    selectSource,
    isSelecting: source !== null,
  };
}
