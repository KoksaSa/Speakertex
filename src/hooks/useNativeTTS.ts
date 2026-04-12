import { useEffect, useState, useCallback, useRef } from 'react';

// Определяем интерфейс для Android TTS
declare global {
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
}

interface UseNativeTTSResult {
  isReady: boolean;
  speak: (text: string, lang: string, rate: number, voice?: SpeechSynthesisVoice | null) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export default function useNativeTTS(onEnd?: () => void): UseNativeTTSResult {
  const [isReady, setIsReady] = useState(false);
  const onEndRef = useRef(onEnd);

  // Обновляем ref при изменении колбэка
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    // Проверяем, доступен ли Android TTS
    const checkTTS = () => {
      if (window.AndroidTTS) {
        setIsReady(true);
      }
    };

    // Колбэк для инициализации TTS
    window.ttsReadyCallback = (ready: boolean) => {
      setIsReady(ready);
    };

    // Колбэк для окончания озвучки (для Android)
    window.ttsEndCallback = () => {
      onEndRef.current?.();
    };

    // Проверяем сразу и через небольшую задержку
    checkTTS();
    const timer = setTimeout(checkTTS, 500);

    return () => clearTimeout(timer);
  }, []);

  const speak = useCallback((text: string, lang: string, rate: number, voice?: SpeechSynthesisVoice | null) => {
    if (window.AndroidTTS) {
      window.AndroidTTS.speak(text, lang, rate);
    } else if ('speechSynthesis' in window) {
      // Фолбэк на Web Speech API для браузера
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      if (voice) {
        utterance.voice = voice;
      }

      // Колбэк при окончании озвучки
      utterance.onend = () => {
        onEndRef.current?.();
      };

      utterance.onerror = () => {
        onEndRef.current?.();
      };

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const stop = useCallback(() => {
    if (window.AndroidTTS) {
      window.AndroidTTS.stop();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const pause = useCallback(() => {
    if (window.AndroidTTS) {
      window.AndroidTTS.pause();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (window.AndroidTTS) {
      window.AndroidTTS.resume();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }, []);

  return {
    isReady,
    speak,
    stop,
    pause,
    resume,
  };
}
