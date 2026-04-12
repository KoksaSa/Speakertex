import { useState, useRef, useEffect, useCallback } from 'react';
import useNativeTTS from './useNativeTTS';

interface UseDictationProps {
  text: string;
  lang: string;
  speed: number;
  pauseDuration?: number;
  repeatCount?: number;
  orderMode?: 'sequential' | 'random';
  voice?: SpeechSynthesisVoice | null;
}

export default function useDictation({
  text,
  lang,
  speed,
  pauseDuration = 500,
  repeatCount = 3,
  orderMode = 'sequential',
  voice = null
}: UseDictationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const [currentRepeat, setCurrentRepeat] = useState<number>(1);
  const sentencesRef = useRef<string[]>([]);
  const randomOrderIndicesRef = useRef<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const currentStepRef = useRef<number>(0);
  const currentSentenceRef = useRef<string>('');
  const currentIndexRef = useRef<number>(0);
  const langRef = useRef<string>(lang);
  const pauseDurationRef = useRef<number>(pauseDuration);
  const repeatCountRef = useRef<number>(repeatCount);
  const speedRef = useRef<number>(speed);
  const orderModeRef = useRef<string>(orderMode);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  // Ref-обёртки для функций
  const ttsSpeakRef = useRef<((text: string, l: string, r: number, v?: SpeechSynthesisVoice | null) => void) | null>(null);
  const ttsStopRef = useRef<(() => void) | null>(null);
  const ttsPauseRef = useRef<(() => void) | null>(null);
  const ttsResumeRef = useRef<(() => void) | null>(null);
  const getSentenceByModeRef = useRef<((index: number) => string) | null>(null);

  // Синхронизируем ref с состояниями
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { pauseDurationRef.current = pauseDuration; }, [pauseDuration]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { orderModeRef.current = orderMode; }, [orderMode]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  // Функция для перемешивания массива
  const shuffleArray = useCallback((array: number[]): number[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Получение предложения с учетом режима порядка
  const getSentenceByMode = useCallback((index: number): string => {
    if (orderMode === 'random' && randomOrderIndicesRef.current.length > 0) {
      const randomIndex = randomOrderIndicesRef.current[index];
      return sentencesRef.current[randomIndex] || '';
    }
    return sentencesRef.current[index] || '';
  }, [orderMode]);

  useEffect(() => { getSentenceByModeRef.current = getSentenceByMode; }, [getSentenceByMode]);

  // Инициализация случайного порядка
  const initializeRandomOrder = useCallback(() => {
    if (sentencesRef.current.length === 0) return;
    const indices = Array.from({ length: sentencesRef.current.length }, (_, i) => i);
    randomOrderIndicesRef.current = shuffleArray(indices);
  }, [shuffleArray]);

  // Разбиваем текст на предложения
  useEffect(() => {
    if (!text) return;
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sentences = [];
    for (const line of lines) {
      if (/[.!?]/.test(line)) {
        const parts = line.split(/[.!?]+/).filter(part => part.trim().length > 0);
        for (const part of parts) {
          sentences.push(part.trim() + '.');
        }
      } else {
        sentences.push(line.trim());
      }
    }
    sentencesRef.current = sentences;
    if (orderMode === 'random' && sentences.length > 0) {
      initializeRandomOrder();
    }
    const firstSentence = sentences[0] || '';
    setCurrentSentence(firstSentence);
    currentSentenceRef.current = firstSentence;
  }, [text, orderMode, initializeRandomOrder]);

  // Обработчик окончания озвучки — объявлен ДО useNativeTTS
  const handleUtteranceEnd = useCallback(() => {
    console.log('Utterance ended, step:', currentStepRef.current, 'index:', currentIndexRef.current);
    if (!isActiveRef.current || isPausedRef.current) return;

    const step = currentStepRef.current;
    const index = currentIndexRef.current;
    const currentSentenceText = currentSentenceRef.current;
    const reps = repeatCountRef.current;
    const pauseDur = pauseDurationRef.current;
    const getSent = getSentenceByModeRef.current;
    const doSpeak = ttsSpeakRef.current;
    const voice = voiceRef.current;

    if (!getSent || !doSpeak) return;

    const scheduleNext = (fn: () => void, delay: number) => {
      timerRef.current = setTimeout(fn, delay);
    };

    if (reps === 1) {
      const nextIndex = index + 1;
      scheduleNext(() => {
        if (isActiveRef.current && !isPausedRef.current && nextIndex < sentencesRef.current.length) {
          setCurrentSentenceIndex(nextIndex);
          currentIndexRef.current = nextIndex;
          const nextSentence = getSent(nextIndex);
          setCurrentSentence(nextSentence);
          currentSentenceRef.current = nextSentence;
          currentStepRef.current = 0;
          doSpeak(nextSentence, langRef.current, 1 * speedRef.current, voice);
        } else {
          console.log('All sentences done');
          setIsPlaying(false);
          isActiveRef.current = false;
          setCurrentRepeat(1);
        }
      }, pauseDur);
    } else if (reps === 2) {
      if (step === 0) {
        scheduleNext(() => {
          if (isActiveRef.current && !isPausedRef.current) {
            currentStepRef.current = 1;
            doSpeak(currentSentenceText, langRef.current, 0.8 * speedRef.current, voice);
          }
        }, pauseDur);
      } else if (step === 1) {
        const nextIndex = index + 1;
        scheduleNext(() => {
          if (isActiveRef.current && !isPausedRef.current && nextIndex < sentencesRef.current.length) {
            setCurrentSentenceIndex(nextIndex);
            currentIndexRef.current = nextIndex;
            const nextSentence = getSent(nextIndex);
            setCurrentSentence(nextSentence);
            currentSentenceRef.current = nextSentence;
            currentStepRef.current = 0;
            doSpeak(nextSentence, langRef.current, 1 * speedRef.current, voice);
          } else {
            console.log('All sentences done');
            setIsPlaying(false);
            isActiveRef.current = false;
          }
        }, pauseDur);
      }
    } else if (reps >= 3) {
      if (step === 0) {
        scheduleNext(() => {
          if (isActiveRef.current && !isPausedRef.current) {
            currentStepRef.current = 1;
            doSpeak(currentSentenceText, langRef.current, 0.7 * speedRef.current, voice);
          }
        }, pauseDur);
      } else if (step === 1) {
        scheduleNext(() => {
          if (isActiveRef.current && !isPausedRef.current) {
            currentStepRef.current = 2;
            const words = currentSentenceText.split(' ');
            const lastPart = words.slice(-3).join(' ');
            doSpeak(lastPart, langRef.current, 0.5 * speedRef.current, voice);
          }
        }, pauseDur);
      } else if (step === 2) {
        const nextIndex = index + 1;
        scheduleNext(() => {
          if (isActiveRef.current && !isPausedRef.current) {
            if (nextIndex < sentencesRef.current.length) {
              setCurrentSentenceIndex(nextIndex);
              currentIndexRef.current = nextIndex;
              const nextSentence = getSent(nextIndex);
              setCurrentSentence(nextSentence);
              currentSentenceRef.current = nextSentence;
              currentStepRef.current = 0;
              doSpeak(nextSentence, langRef.current, 1 * speedRef.current, voice);
            } else {
              console.log('All sentences done');
              setIsPlaying(false);
              isActiveRef.current = false;
            }
          }
        }, pauseDur);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Используем нативный TTS — передаём handleUtteranceEnd для цепочки
  const { speak: ttsSpeak, stop: ttsStop, pause: ttsPause, resume: ttsResume } = useNativeTTS(handleUtteranceEnd);

  useEffect(() => {
    ttsSpeakRef.current = ttsSpeak;
    ttsStopRef.current = ttsStop;
    ttsPauseRef.current = ttsPause;
    ttsResumeRef.current = ttsResume;
  }, [ttsSpeak, ttsStop, ttsPause, ttsResume]);

  // Озвучивание через speakWithEnd (для первого предложения и startSentenceDictation)
  const speakWithEnd = useCallback((sentenceText: string, l: string, r: number, v?: SpeechSynthesisVoice | null) => {
    if (!('speechSynthesis' in window)) {
      ttsSpeakRef.current?.(sentenceText, l, r);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utterance.lang = l;
    utterance.rate = r;
    const voiceToUse = v !== undefined ? v : voiceRef.current;
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }
    utterance.onend = () => { handleUtteranceEnd(); };
    utterance.onerror = () => { handleUtteranceEnd(); };
    window.speechSynthesis.speak(utterance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Функция озвучивания
  const speak = useCallback((sentenceText: string, rate: number = 1, step: number, index: number) => {
    if (!isActiveRef.current || isPausedRef.current) return;
    console.log('Speaking:', sentenceText, 'at rate:', rate, 'step:', step, 'index:', index);
    currentStepRef.current = step;
    currentSentenceRef.current = sentenceText;
    currentIndexRef.current = index;
    ttsStopRef.current?.();
    if (timerRef.current) clearTimeout(timerRef.current);
    speakWithEnd(sentenceText, langRef.current, rate * speedRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSentenceDictation = useCallback((sentenceIndex: number) => {
    if (sentenceIndex < 0 || sentenceIndex >= sentencesRef.current.length) return;
    if (orderModeRef.current === 'random') initializeRandomOrder();
    if (timerRef.current) clearTimeout(timerRef.current);
    ttsStopRef.current?.();
    setIsPlaying(true);
    setIsPaused(false);
    isActiveRef.current = true;
    setCurrentSentenceIndex(sentenceIndex);
    currentIndexRef.current = sentenceIndex;
    setTimeout(() => {
      const sentence = getSentenceByMode(sentenceIndex);
      setCurrentSentence(sentence);
      currentSentenceRef.current = sentence;
      speak(sentence, 1, 0, sentenceIndex);
    }, 100);
  }, [speak, getSentenceByMode, initializeRandomOrder]);

  const startDictation = useCallback(() => {
    console.log('startDictation called, sentences:', sentencesRef.current);
    if (sentencesRef.current.length === 0) return;
    startSentenceDictation(0);
  }, [startSentenceDictation]);

  const pauseDictation = useCallback(() => {
    console.log('pauseDictation called, isPlaying:', isPlayingRef.current, 'isPaused:', isPausedRef.current);
    if (!isPlayingRef.current && !isPausedRef.current) {
      startDictation();
      return;
    }
    if (isPlayingRef.current && !isPausedRef.current) {
      ttsPauseRef.current?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsPaused(true);
      console.log('Dictation paused');
    } else if (isPausedRef.current) {
      setIsPaused(false);
      isActiveRef.current = true;
      ttsResumeRef.current?.();
      console.log('Dictation resumed');
    }
  }, [startDictation]);

  const stopDictation = useCallback(() => {
    console.log('stopDictation called');
    if (timerRef.current) clearTimeout(timerRef.current);
    ttsStopRef.current?.();
    setIsPlaying(false);
    setIsPaused(false);
    isActiveRef.current = false;
  }, []);

  const goToNextSentence = useCallback(() => {
    const nextIndex = currentSentenceIndex + 1;
    if (nextIndex < sentencesRef.current.length) {
      if (isPlaying) stopDictation();
      setTimeout(() => startSentenceDictation(nextIndex), 100);
    } else if (orderMode === 'random') {
      setTimeout(() => startSentenceDictation(0), 100);
    }
  }, [currentSentenceIndex, isPlaying, stopDictation, startSentenceDictation, orderMode]);

  const goToPreviousSentence = useCallback(() => {
    const prevIndex = currentSentenceIndex - 1;
    if (prevIndex >= 0) {
      if (isPlaying) stopDictation();
      setTimeout(() => startSentenceDictation(prevIndex), 100);
    }
  }, [currentSentenceIndex, isPlaying, stopDictation, startSentenceDictation]);

  const toggleTrainingMode = useCallback(() => {
    setIsTrainingMode(prev => !prev);
  }, []);

  const checkResults = useCallback((userInput: string): {
    correct: string;
    errors: number;
    total: number;
    errorWords: Array<{ original: string; user: string; hasError: boolean }>;
  } => {
    const removePunctuation = (str: string) => str.replace(/[.,!?;:—\-"'""'']/g, '');
    const fullOriginal = sentencesRef.current.join(' ').replace(/\s+/g, ' ').trim();
    const normalize = (str: string) => str.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
    const original = normalize(removePunctuation(fullOriginal));
    const user = normalize(removePunctuation(userInput));
    let errors = 0;
    const originalWords = original.split(' ');
    const userWords = user.split(' ');
    const minLen = Math.min(originalWords.length, userWords.length);
    const maxLen = Math.max(originalWords.length, userWords.length);
    const errorWords = [];
    for (let i = 0; i < minLen; i++) {
      if (originalWords[i] !== userWords[i]) {
        errors += 1;
        errorWords.push({ original: originalWords[i], user: userWords[i], hasError: true });
      } else {
        errorWords.push({ original: originalWords[i], user: userWords[i], hasError: false });
      }
    }
    for (let i = minLen; i < maxLen; i++) {
      if (i < originalWords.length) {
        errors += 1;
        errorWords.push({ original: originalWords[i], user: '', hasError: true });
      } else if (i < userWords.length) {
        errors += 1;
        errorWords.push({ original: '', user: userWords[i], hasError: true });
      }
    }
    const total = originalWords.length;
    const percentCorrect = total > 0 ? ((total - errors) / total) * 100 : 100;
    return { correct: `${Math.round(percentCorrect)}%`, errors, total, errorWords };
  }, []);

  return {
    isPlaying,
    isPaused,
    currentSentence,
    currentSentenceIndex,
    currentRepeat,
    totalSentences: sentencesRef.current.length,
    startDictation,
    pauseDictation,
    stopDictation,
    goToNextSentence,
    goToPreviousSentence,
    checkResults,
    isTrainingMode,
    toggleTrainingMode,
  };
}
