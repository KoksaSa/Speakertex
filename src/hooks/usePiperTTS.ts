// usePiperTTS.ts — React-привязка к синглтону piperEngine
import { useSyncExternalStore } from 'react';
import { piperEngine, PiperSnapshot } from '../utils/piperEngine';

export function usePiperTTS(): PiperSnapshot {
  return useSyncExternalStore(
    piperEngine.subscribe,
    piperEngine.getSnapshot
  );
}
