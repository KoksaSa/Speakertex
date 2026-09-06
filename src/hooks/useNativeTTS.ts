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
  // Маркер эпохи фразы: cancel()/замена фразы инвалидирует колбэки предыдущей.
  // Без этого cancel() в Chrome вызывает onend у УБИТОЙ фразы → цепочка
  // диктовки получала ложное «предложение закончилось» и улетала вперёд
  // (симптом: после паузы предложения «быстро перескакивают»).
  const utteranceTokenRef = useRef(0);

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
      const synth = window.speechSynthesis;
      synth.cancel();
      // «Залипшая» пауза: Chrome, получив pause() при пустой очереди, держит
      // paused=true, и следующая фраза молча застревает в очереди («тишина
      // после продолжить»). Явно снимаем паузу перед новой фразой.
      if (synth.paused) synth.resume();

      const myToken = ++utteranceTokenRef.current;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      if (voice) {
        utterance.voice = voice;
      }

      // Колбэки окончания — только если фраза всё ещё актуальна
      utterance.onend = () => {
        if (utteranceTokenRef.current === myToken) onEndRef.current?.();
      };

      utterance.onerror = () => {
        if (utteranceTokenRef.current === myToken) onEndRef.current?.();
      };

      synth.speak(utterance);
    }
  }, []);

  const stop = useCallback(() => {
    if (window.AndroidTTS) {
      window.AndroidTTS.stop();
    } else if ('speechSynthesis' in window) {
      // Инвалидируем колбэки ДО cancel(): onend/onerror отменённой фразы
      // не должны вернуться в цепочку диктовки
      utteranceTokenRef.current++;
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
