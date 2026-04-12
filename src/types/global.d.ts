// Глобальные типы для Android TTS и других глобальных объектов

interface Window {
  AndroidTTS?: {
    speak(text: string, lang: string, rate: number): void;
    stop(): void;
    pause(): void;
    resume(): void;
    isReady(): boolean;
  };
  ttsReadyCallback?: (ready: boolean) => void;
  ttsEndCallback?: () => void;
}
