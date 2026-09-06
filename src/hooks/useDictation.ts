import { useState, useRef, useEffect, useCallback } from 'react';
import useNativeTTS from './useNativeTTS';
import { splitIntoSentences, compareTexts } from '../utils/textUtils';
import { piperEngine } from '../utils/piperEngine';

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
  // Отложенный шаг цепочки (следующий повтор / следующее предложение).
  // Пауза отменяет таймер, но НЕ стирает шаг: resume() восстановит его,
  // иначе при паузе «в интервале между предложениями» цепочка умрёт навсегда.
  const pendingNextRef = useRef<(() => void) | null>(null);
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

  // Отложенное продолжение цепочки. fn сохраняется в pendingNextRef,
  // чтобы pauseDictation мог остановить таймер, а resume — восстановить шаг.
  const scheduleNext = useCallback((fn: () => void, delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingNextRef.current = fn;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingNextRef.current = null;
      fn();
    }, delay);
  }, []);

  // Полная отмена продолжения (стоп / старт нового предложения)
  const cancelChainTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingNextRef.current = null;
  }, []);

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

  // Разбиваем текст на предложения (с сохранением исходной пунктуации)
  useEffect(() => {
    if (!text) return;
    const sentences = splitIntoSentences(text);
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

  // «Сырые» функции системного TTS (Android-мост / Web Speech API)
  const ttsSpeakRawRef = useRef<((text: string, l: string, r: number, v?: SpeechSynthesisVoice | null) => void) | null>(null);

  useEffect(() => {
    ttsSpeakRawRef.current = ttsSpeak;
    // Stop/Pause/Resume действуют на активный движок. Активен всегда максимум один:
    // если озвучивает Piper, нативный TTS трогать нельзя — в частности,
    // AndroidTTS.resume() безусловно начинает говорить и даст двойную озвучку.
    const piperActive = () => piperEngine.isActive();
    ttsStopRef.current = () => { piperEngine.stop(); if (!piperActive()) ttsStop(); };
    ttsPauseRef.current = () => { piperEngine.pause(); if (!piperActive()) ttsPause(); };
    ttsResumeRef.current = () => { piperEngine.resume(); if (!piperActive()) ttsResume(); };
  }, [ttsSpeak, ttsStop, ttsPause, ttsResume]);

  // Единая точка маршрутизации озвучки: Piper (нейро, офлайн) → системный TTS
  const routeSpeak = useCallback((text: string, l: string, r: number, v?: SpeechSynthesisVoice | null) => {
    if (piperEngine.isActive()) {
      piperEngine.speak(text, r, () => handleUtteranceEnd());
      return;
    }
    ttsSpeakRawRef.current?.(text, l, r, v ?? voiceRef.current);
  }, [handleUtteranceEnd]);

  useEffect(() => {
    ttsSpeakRef.current = routeSpeak;
  }, [routeSpeak]);

  // Озвучивание через speakWithEnd (для первого предложения и startSentenceDictation)
  const speakWithEnd = useCallback((sentenceText: string, l: string, r: number, v?: SpeechSynthesisVoice | null) => {
    routeSpeak(sentenceText, l, r, v);
  }, [routeSpeak]);

  // Функция озвучивания
  const speak = useCallback((sentenceText: string, rate: number = 1, step: number, index: number) => {
    if (!isActiveRef.current || isPausedRef.current) return;
    currentStepRef.current = step;
    currentSentenceRef.current = sentenceText;
    currentIndexRef.current = index;
    ttsStopRef.current?.();
    cancelChainTimers();
    speakWithEnd(sentenceText, langRef.current, rate * speedRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSentenceDictation = useCallback((sentenceIndex: number) => {
    if (sentenceIndex < 0 || sentenceIndex >= sentencesRef.current.length) return;
    if (orderModeRef.current === 'random') initializeRandomOrder();
    cancelChainTimers();
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
    if (sentencesRef.current.length === 0) return;
    startSentenceDictation(0);
  }, [startSentenceDictation]);

  const pauseDictation = useCallback(() => {
    if (!isPlayingRef.current && !isPausedRef.current) {
      startDictation();
      return;
    }
    if (isPlayingRef.current && !isPausedRef.current) {
      // ПАУЗА: глушим движок и останавливаем таймер, но отложенный шаг цепочки
      // (pendingNextRef) сохраняем — «Продолжить» восстановит его.
      ttsPauseRef.current?.();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isPausedRef.current = true; // синхронно, не дожидаясь эффекта
      setIsPaused(true);
    } else if (isPausedRef.current) {
      // ПРОДОЛЖИТЬ
      isPausedRef.current = false;
      setIsPaused(false);
      isActiveRef.current = true;
      ttsResumeRef.current?.();

      const pending = pendingNextRef.current;
      const piperActive = piperEngine.isActive();
      const androidBridge = typeof window !== 'undefined' && !!window.AndroidTTS;

      if (pending && (piperActive || !androidBridge)) {
        // Пауза пришлась на интервал между предложениями: таймер продолжения был
        // остановлен — восстанавливаем его. Движки закончившееся аудио не
        // перезапускают (Piper: resume() пропускает ended-аудио; Web Speech:
        // resume() — no-op), так что двойного старта не будет.
        pendingNextRef.current = null;
        scheduleNext(pending, Math.max(pauseDurationRef.current, 300));
      } else if (!pending) {
        // Пауза пришлась посреди предложения — движок продолжит аудио сам после
        // resume(). Если же возобновлять нечего (пауза попала на стык до старта
        // озвучки), перезапускаем текущее предложение, чтобы цепочка не умерла.
        const webSpeechMid = typeof window !== 'undefined'
          && 'speechSynthesis' in window
          && window.speechSynthesis.paused;
        const nothingToResume = piperActive
          ? !piperEngine.hasResumableAudio()
          : androidBridge
            ? false // нативный resume() сам перезапускает предложение и вернёт onDone
            : !webSpeechMid;
        if (nothingToResume) {
          currentStepRef.current = 0;
          ttsSpeakRef.current?.(currentSentenceRef.current, langRef.current, 1 * speedRef.current, voiceRef.current);
        }
      }
    }
  }, [startDictation, scheduleNext]);

  const stopDictation = useCallback(() => {
    cancelChainTimers();
    ttsStopRef.current?.();
    setIsPlaying(false);
    setIsPaused(false);
    isActiveRef.current = false;
  }, [cancelChainTimers]);

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

  const checkResults = useCallback((userInput: string, strictPunctuation: boolean = false) => {
    // Сам алгоритм (LCS-выравнивание слов, строгость пунктуации, маппинг на предложения)
    // вынесен в utils/textUtils.ts — см. compareTexts()
    //
    // При случайном порядке диктовки эталон берём В ПОРЯДКЕ ДИКТОВКИ:
    // пользователь печатает предложения в том порядке, в котором услышал.
    const orderMode = orderModeRef.current;
    const order = orderMode === 'random' && randomOrderIndicesRef.current.length > 0
      ? randomOrderIndicesRef.current
      : null;
    const refSentences = order
      ? order.map(idx => sentencesRef.current[idx]).filter(Boolean)
      : sentencesRef.current;

    const res = compareTexts(refSentences, userInput, strictPunctuation);

    // Переводим индексы предложений из порядка диктовки обратно в порядок текста
    // (нужно режиму «Работа над ошибками»)
    if (order) {
      res.errorSentenceIndices = res.errorSentenceIndices
        .map(i => order[i])
        .filter((idx): idx is number => typeof idx === 'number');
    }
    return res;
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
