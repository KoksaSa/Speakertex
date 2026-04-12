import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import DictationInput from './components/DictationInput';
import ResultDisplay from './components/ResultDisplay';
import CountdownOverlay from './components/CountdownOverlay';
import MyTextsModal from './components/MyTextsModal';
import useDictation from './hooks/useDictation';
import HelpPage from './components/HelpPage';
import { dictationTextsSimple, Language, Difficulty } from './utils/dictationTextsSimple';

// Проверка доступности TTS
const isTTSAvailable = (): boolean => {
  if ('speechSynthesis' in window) return true;
  if ('AndroidTTS' in window && (window as unknown as Record<string, unknown>).AndroidTTS) return true;
  return false;
};

// Helper для dark-классов
const dk = (isDark: boolean, lightClass: string, darkClass: string): string => isDark ? darkClass : lightClass;

// Интерфейс для сохранения состояния
interface AppState {
  inputText: string;
  originalText: string;
  selectedLang: Language;
  dictationSpeed: number;
  pauseDuration: number;
  repeatCount: 1 | 2 | 3;
  showOriginalTextInput: boolean;
  isTrainingMode: boolean;
  orderMode: 'sequential' | 'random';
}

const App: React.FC = () => {
  // Функция для загрузки состояния из localStorage
  const loadSavedState = (): Partial<AppState> => {
    try {
      const saved = localStorage.getItem('dictationAppState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
    return {};
  };
  const [showHelp, setShowHelp] = useState(false);

  // Функция для сохранения состояния в localStorage
  const saveState = (state: Partial<AppState>) => {
    try {
      localStorage.setItem('dictationAppState', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state:', error);
    }
  };

  // Загружаем начальное состояние из localStorage
  const savedState = loadSavedState();

  const [inputText, setInputText] = useState(savedState.inputText || '');
  const [originalText, setOriginalText] = useState(savedState.originalText || '');
  const [result, setResult] = useState<{ 
    correct: string; 
    errors: number; 
    total: number;
    errorWords: Array<{ original: string; user: string; hasError: boolean }>;
    originalSentences?: string[];
    typingTime?: number;
    cpm?: number;
  } | null>(null);
  const [selectedLang, setSelectedLang] = useState<Language>(savedState.selectedLang || 'ru-RU');
  const [dictationSpeed, setDictationSpeed] = useState(savedState.dictationSpeed || 1.0);
  const [pauseDuration, setPauseDuration] = useState(savedState.pauseDuration || 500);
  const [repeatCount, setRepeatCount] = useState<1 | 2 | 3>(savedState.repeatCount || 3);
  const [orderMode, setOrderMode] = useState<'sequential' | 'random'>(savedState.orderMode || 'sequential');
  const [showResult, setShowResult] = useState(false);

  const [showOriginalTextInput, setShowOriginalTextInput] = useState(savedState.showOriginalTextInput !== undefined ? savedState.showOriginalTextInput : true);
  const [isTrainingMode, setIsTrainingMode] = useState(savedState.isTrainingMode || false);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const {
    isPlaying,
    isPaused,
    currentSentenceIndex,
    totalSentences,
    startDictation,
    pauseDictation,
    stopDictation,
    goToNextSentence,
    goToPreviousSentence,
    checkResults
  } = useDictation({
    text: originalText,
    lang: selectedLang,
    speed: dictationSpeed,
    pauseDuration,
    repeatCount,
    orderMode,
    voice: availableVoices[selectedVoiceIndex] || null,
  });

  const [typingStartTime, setTypingStartTime] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('dictationTheme') === 'dark';
    } catch {
      return false;
    }
  });
  const [showMyTexts, setShowMyTexts] = useState(false);

  const stopClickCountRef = useRef<number>(0);
  const lastStopTimeRef = useRef<number>(0);
  const dictationInputRef = useRef<{ focus: () => void }>(null);

  // Применяем тему при изменении
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('dark-theme', isDark);
    try { localStorage.setItem('dictationTheme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  // Загружаем доступные голоса TTS
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ✅ Сохраняем состояние при изменении
  useEffect(() => {
    const state: Partial<AppState> = {
      inputText,
      originalText,
      selectedLang,
      dictationSpeed,
      pauseDuration,
      repeatCount,
      orderMode,
      showOriginalTextInput,
      isTrainingMode,
    };
    saveState(state);
  }, [
    inputText,
    originalText,
    selectedLang,
    dictationSpeed,
    pauseDuration,
    repeatCount,
    orderMode,
    showOriginalTextInput,
    isTrainingMode,
  ]);

  // ✅ Функция для очистки сохраненных данных
  const clearSavedData = () => {
    if (window.confirm(t('clearDataConfirm'))) {
      localStorage.removeItem('dictationAppState');
      setInputText('');
      setOriginalText('');
      setSelectedLang('ru-RU');
      setDictationSpeed(1.0);
      setPauseDuration(500);
      setRepeatCount(3);
      setOrderMode('sequential');
      setShowOriginalTextInput(true);
      setIsTrainingMode(false);
      setResult(null);
      setShowResult(false);
      stopDictation();
      setTypingStartTime(null);
      stopClickCountRef.current = 0;
      lastStopTimeRef.current = 0;

      alert(t('dataCleared'));
    }
  };

  const translations = {
    'ru-RU': {
      title: '🎙️ Приложение-Диктант',
      originalInputLabel: 'Введите текст для диктовки:',
      originalInputPlaceholder: 'Введите текст... Разделяйте предложения точками.',
      languageLabel: 'Выберите язык:',
      randomTextLabel: 'Случайный текст',
      speedLabel: 'Скорость диктовки:',
      pauseDurationLabel: 'Пауза между повторами:',
      pauseDurationUnit: 'мс',
      repeatLabel: 'Повторения предложений:',
      repeatOption1: '1 повтор',
      repeatOption2: '2 повтора',
      repeatOption3: '3 повтора (полный)',
      startButton: 'Старт',
      pauseButton: 'Пауза',
      resumeButton: 'Продолжить',
      stopButton: 'Стоп',
      checkButton: 'Проверить',
      showTextButton: 'Скрыть/Показать текст',
      trainingModeButton: 'Режим тренировки',
      userTextLabel: 'Ваш текст:',
      userTextPlaceholder: 'Начните печатать...',
      resultTitle: '✅ Результат проверки',
      correctnessLabel: 'Процент правильности написания текста:',
      errorsLabel: 'Ошибок:',
      errorWordsLabel: 'Слова с ошибками:',
      typingSpeedLabel: 'Скорость печати:',
      cpmLabel: 'символов/мин',
      prevSentenceButton: '◀️ Назад',
      nextSentenceButton: 'Вперед ▶️',
      correctionButton: 'Работа над ошибками',
      dictationBlockTitle: 'Диктовка',
      learningBlockTitle: 'Обучение',
      clearDataButton: 'Очистить данные',
      clearDataConfirm: 'Очистить все сохраненные данные?',
      dataCleared: 'Данные очищены!',
      helpTitle: 'Справка по приложению',
      helpIntro: 'Добро пожаловать в приложение-диктант!',
      helpSection1: '1. Выбор языка',
      helpSection1Desc: 'Нажмите на флаг нужного языка в верхнем левом углу.',
      helpSection2: '2. Случайный текст',
      helpSection2Desc: 'Нажмите кнопку "Случайный текст", чтобы вставить случайный текст для диктовки.',
      helpSection3: '3. Диктовка',
      helpSection3Desc: 'Нажмите "Старт", чтобы начать диктовку. Используйте "Пауза", "Продолжить", "Назад", "Вперед", "Стоп" для управления.',
      helpSection4: '4. Проверка',
      helpSection4Desc: 'Нажмите "Проверить", чтобы увидеть результаты проверки текста.',
      helpSection5: '5. Режим тренировки',
      helpSection5Desc: 'Включите "Режим тренировки", чтобы видеть ошибки в реальном времени.',
      helpSection6: '6. Повторения',
      helpSection6Desc: 'Выберите количество повторений (1, 2 или 3) для каждого предложения.',
      helpSection7: '7. Порядок диктовки',
      helpSection7Desc: 'Выберите "Стандартный порядок" или "Случайный порядок" для диктовки предложений.',
      helpTip: 'Совет:',
      helpTipDesc: 'При необходимости вы можете очистить все сохраненные данные, нажав на соответствующую кнопку в правом верхнем углу.',
      helpCloseButton: 'Закрыть',
      orderModeLabel: 'Порядок диктовки:',
      orderSequential: 'Стандартный порядок',
      orderRandom: 'Случайный порядок',
      orderSequentialDesc: 'Предложения диктуются последовательно',
      orderRandomDesc: 'Предложения диктуются в случайном порядке',
      repeatCount1Desc: 'Каждое предложение диктуется 1 раз',
      repeatCount2Desc: 'Каждое предложение диктуется 2 раза',
      repeatCount3Desc: 'Каждое предложение диктуется 3 раза (нормально → медленно → последние 3 слова)',
      noTextsAvailable: 'Для выбранного языка нет доступных текстов.',
      helpButton: 'Справка',
      myTextsButton: 'Мои тексты',
      voiceLabel: 'Голос',
    },
    'en-US': {
      title: '🎙️ Dictation App',
      originalInputLabel: 'Enter text for dictation:',
      originalInputPlaceholder: 'Enter text... Separate sentences with periods.',
      languageLabel: 'Select language:',
      randomTextLabel: 'Random Text',
      speedLabel: 'Dictation speed:',
      pauseDurationLabel: 'Pause between repeats:',
      pauseDurationUnit: 'ms',
      repeatLabel: 'Sentence repeats:',
      repeatOption1: '1 repeat',
      repeatOption2: '2 repeats',
      repeatOption3: '3 repeats (full)',
      startButton: 'Start',
      pauseButton: 'Pause',
      resumeButton: 'Resume',
      stopButton: 'Stop',
      checkButton: 'Check',
      showTextButton: 'Hide Text',
      trainingModeButton: 'Training Mode',
      userTextLabel: 'Your text:',
      userTextPlaceholder: 'Start typing...',
      resultTitle: '✅ Check Result',
      correctnessLabel: 'Text writing accuracy percentage:',
      errorsLabel: 'Errors:',
      errorWordsLabel: 'Words with errors:',
      typingSpeedLabel: 'Typing speed:',
      cpmLabel: 'chars/min',
      prevSentenceButton: '◀️ Previous',
      nextSentenceButton: 'Next ▶️',
      correctionButton: 'Work on Mistakes',
      dictationBlockTitle: 'Dictation',
      learningBlockTitle: 'Learning',
      clearDataButton: 'Clear Data',
      clearDataConfirm: 'Clear all saved data?',
      dataCleared: 'Data cleared!',
      helpTitle: 'Help with the application',
      helpIntro: 'Welcome to the dictation app!',
      helpSection1: '1. Language selection',
      helpSection1Desc: 'Click on the flag of the desired language in the top left corner.',
      helpSection2: '2. Random text',
      helpSection2Desc: 'Click the "Random text" button to insert random text for dictation.',
      helpSection3: '3. Dictation',
      helpSection3Desc: 'Press "Start" to begin dictation. Use "Pause", "Resume", "Back", "Forward", "Stop" to control.',
      helpSection4: '4. Check',
      helpSection4Desc: 'Press "Check" to see the results of the text verification.',
      helpSection5: '5. Training mode',
      helpSection5Desc: 'Enable "Training mode" to see errors in real time.',
      helpSection6: '6. Repetitions',
      helpSection6Desc: 'Choose the number of repetitions (1, 2 or 3) for each sentence.',
      helpSection7: '7. Dictation order',
      helpSection7Desc: 'Select "Standard order" or "Random order" for dictating sentences.',
      helpTip: 'Tip:',
      helpTipDesc: 'If necessary, you can clear all saved data by clicking the corresponding button in the top right corner.',
      helpButton: 'Help',
      myTextsButton: 'My Texts',
      voiceLabel: 'Voice',
      helpCloseButton: 'Close',
      orderModeLabel: 'Dictation order:',
      orderSequential: 'Sequential order',
      orderRandom: 'Random order',
      orderSequentialDesc: 'Sentences are dictated sequentially',
      orderRandomDesc: 'Sentences are dictated in random order',
      repeatCount1Desc: 'Each sentence is dictated 1 time',
      repeatCount2Desc: 'Each sentence is dictated 2 times',
      repeatCount3Desc: 'Each sentence is dictated 3 times (normal → slow → last 3 words)',
      noTextsAvailable: 'No texts available for selected language.',
    },
    'es-ES': {
      title: '🎙️ Aplicación de Dictado',
      originalInputLabel: 'Ingrese texto para dictado:',
      originalInputPlaceholder: 'Ingrese texto... Separe las oraciones con puntos.',
      languageLabel: 'Seleccionar idioma:',
      randomTextLabel: 'Texto aleatorio',
      speedLabel: 'Velocidad de dictado:',
      pauseDurationLabel: 'Pausa entre repeticiones:',
      pauseDurationUnit: 'ms',
      repeatLabel: 'Repeticiones de oraciones:',
      repeatOption1: '1 repetición',
      repeatOption2: '2 repeticiones',
      repeatOption3: '3 repeticiones (completo)',
      startButton: 'Iniciar',
      pauseButton: 'Pausa',
      resumeButton: 'Reanudar',
      stopButton: 'Detener',
      checkButton: 'Verificar',
      showTextButton: 'Ocultar texto',
      trainingModeButton: 'Modo de entrenamiento',
      userTextLabel: 'Su texto:',
      userTextPlaceholder: 'Comience a escribir...',
      resultTitle: '✅ Resultado de verificación',
      correctnessLabel: 'Porcentaje de precisión en escritura de texto:',
      errorsLabel: 'Errores:',
      errorWordsLabel: 'Palabras con errores:',
      typingSpeedLabel: 'Velocidad de escritura:',
      cpmLabel: 'caract/min',
      prevSentenceButton: '◀️ Anterior',
      nextSentenceButton: 'Siguiente ▶️',
      correctionButton: 'Trabajo sobre errores',
      dictationBlockTitle: 'Dictado',
      learningBlockTitle: 'Aprendizaje',
      clearDataButton: 'Borrar Datos',
      clearDataConfirm: '¿Borrar todos los datos guardados?',
      dataCleared: '¡Datos borrados!',
      orderModeLabel: 'Orden de dictado:',
      orderSequential: 'Orden secuencial',
      orderRandom: 'Orden aleatorio',
      orderSequentialDesc: 'Las oraciones se dictan secuencialmente',
      orderRandomDesc: 'Las oraciones se dictan en orden aleatorio',
      repeatCount1Desc: 'Cada oración se dicta 1 vez',
      repeatCount2Desc: 'Cada oración se dicta 2 veces',
      repeatCount3Desc: 'Cada oración se dicta 3 veces (normal → lento → últimas 3 palabras)',
      noTextsAvailable: 'No hay textos disponibles para el idioma seleccionado.',
      helpTitle: 'Ayuda con la aplicación',
      helpIntro: '¡Bienvenido a la aplicación de dictado!',
      helpSection1: '1. Selección de idioma',
      helpSection1Desc: 'Haga clic en la bandera del idioma deseado en la esquina superior izquierda.',
      helpSection2: '2. Texto aleatorio',
      helpSection2Desc: 'Haga clic en "Texto aleatorio" para insertar texto aleatorio para dictado.',
      helpSection3: '3. Dictado',
      helpSection3Desc: 'Presione "Iniciar" para comenzar el dictado. Use "Pausa", "Reanudar", "Anterior", "Siguiente", "Detener" para controlar.',
      helpSection4: '4. Verificación',
      helpSection4Desc: 'Presione "Verificar" para ver los resultados de la verificación del texto.',
      helpSection5: '5. Modo de entrenamiento',
      helpSection5Desc: 'Habilite "Modo de entrenamiento" para ver errores en tiempo real.',
      helpSection6: '6. Repeticiones',
      helpSection6Desc: 'Elija el número de repeticiones (1, 2 o 3) para cada oración.',
      helpSection7: '7. Orden de dictado',
      helpSection7Desc: 'Seleccione "Orden secuencial" u "Orden aleatorio" para dictar oraciones.',
      helpTip: 'Consejo:',
      helpTipDesc: 'Si es necesario, puede borrar todos los datos guardados haciendo clic en el botón correspondiente en la esquina superior derecha.',
      helpButton: 'Ayuda',
      myTextsButton: 'Mis Textos',
      voiceLabel: 'Voz',
      helpCloseButton: 'Cerrar',
    },
    'fr-FR': {
      title: '🎙️ Application de Dictée',
      originalInputLabel: 'Entrez le texte pour la dictée:',
      originalInputPlaceholder: 'Entrez le texte... Séparez les phrases par des points.',
      languageLabel: 'Sélectionnez la langue:',
      randomTextLabel: 'Texte aléatoire',
      speedLabel: 'Vitesse de dictée:',
      pauseDurationLabel: 'Pause entre les répétitions:',
      pauseDurationUnit: 'ms',
      repeatLabel: 'Répétitions de phrases:',
      repeatOption1: '1 répétition',
      repeatOption2: '2 répétitions',
      repeatOption3: '3 répétitions (complet)',
      startButton: 'Démarrer',
      pauseButton: 'Pause',
      resumeButton: 'Reprendre',
      stopButton: 'Arrêter',
      checkButton: 'Vérifier',
      showTextButton: 'Masquer le texte',
      trainingModeButton: 'Mode entraînement',
      userTextLabel: 'Votre texte:',
      userTextPlaceholder: 'Commencez à taper...',
      resultTitle: '✅ Résultat de vérification',
      correctnessLabel: 'Pourcentage de précision de la saisie de texto:',
      errorsLabel: 'Erreurs:',
      errorWordsLabel: 'Mots avec erreurs:',
      typingSpeedLabel: 'Vitesse de frappe:',
      cpmLabel: 'caract/min',
      prevSentenceButton: '◀️ Précédent',
      nextSentenceButton: 'Suivant ▶️',
      correctionButton: 'Travail sur les erreurs',
      dictationBlockTitle: 'Dictée',
      learningBlockTitle: 'Apprentissage',
      clearDataButton: 'Effacer les données',
      clearDataConfirm: 'Effacer toutes les données sauvegardées?',
      dataCleared: 'Données effacées!',
      orderModeLabel: 'Ordre de dictée:',
      orderSequential: 'Ordre séquentiel',
      orderRandom: 'Ordre aléatoire',
      orderSequentialDesc: 'Les phrases sont dictées séquentiellement',
      orderRandomDesc: 'Les phrases sont dictées dans un ordre aléatoire',
      repeatCount1Desc: 'Chaque phrase est dictée 1 fois',
      repeatCount2Desc: 'Chaque phrase est dictée 2 fois',
      repeatCount3Desc: 'Chaque phrase est dictée 3 fois (normal → lent → 3 derniers mots)',
      noTextsAvailable: 'Aucun texte disponible pour la langue sélectionnée.',
      helpTitle: 'Aide pour l\'application',
      helpIntro: 'Bienvenue dans l\'application de dictée !',
      helpSection1: '1. Sélection de la langue',
      helpSection1Desc: 'Cliquez sur le drapeau de la langue souhaitée dans le coin supérieur gauche.',
      helpSection2: '2. Texte aléatoire',
      helpSection2Desc: 'Cliquez sur "Texte aléatoire" pour insérer un texte aléatoire pour la dictée.',
      helpSection3: '3. Dictée',
      helpSection3Desc: 'Appuyez sur "Démarrer" pour commencer la dictée. Utilisez "Pause", "Reprendre", "Précédent", "Suivant", "Arrêter" pour contrôler.',
      helpSection4: '4. Vérification',
      helpSection4Desc: 'Appuyez sur "Vérifier" pour voir les résultats de la vérification du texte.',
      helpSection5: '5. Mode entraînement',
      helpSection5Desc: 'Activez le "Mode entraînement" pour voir les erreurs en temps réel.',
      helpSection6: '6. Répétitions',
      helpSection6Desc: 'Choisissez le nombre de répétitions (1, 2 ou 3) pour chaque phrase.',
      helpSection7: '7. Ordre de dictée',
      helpSection7Desc: 'Sélectionnez "Ordre séquentiel" ou "Ordre aléatoire" pour dicter les phrases.',
      helpTip: 'Conseil :',
      helpTipDesc: 'Si nécessaire, vous pouvez effacer toutes les données enregistrées en cliquant sur le bouton correspondant dans le coin supérieur droit.',
      helpButton: 'Aide',
      myTextsButton: 'Mes Textes',
      voiceLabel: 'Voix',
      helpCloseButton: 'Fermer',
    },
    'de-DE': {
      title: '🎙️ Diktier-App',
      originalInputLabel: 'Text für Diktat eingeben:',
      originalInputPlaceholder: 'Text eingeben... Sätze mit Punkten trennen.',
      languageLabel: 'Sprache auswählen:',
      randomTextLabel: 'Zufälliger Text',
      speedLabel: 'Diktiergeschwindigkeit:',
      pauseDurationLabel: 'Pause zwischen Wiederholungen:',
      pauseDurationUnit: 'ms',
      repeatLabel: 'Satzwiederholungen:',
      repeatOption1: '1 Wiederholung',
      repeatOption2: '2 Wiederholungen',
      repeatOption3: '3 Wiederholungen (vollständig)',
      startButton: 'Starten',
      pauseButton: 'Pause',
      resumeButton: 'Fortsetzen',
      stopButton: 'Stopp',
      checkButton: 'Überprüfen',
      showTextButton: 'Text ausblenden',
      trainingModeButton: 'Trainingsmodus',
      userTextLabel: 'Ihr Text:',
      userTextPlaceholder: 'Beginnen Sie zu tippen...',
      resultTitle: '✅ Überprüfungsergebnis',
      correctnessLabel: 'Textschreibgenauigkeit in Prozent:',
      errorsLabel: 'Fehler:',
      errorWordsLabel: 'Wörter mit Fehlern:',
      typingSpeedLabel: 'Schreibgeschwindigkeit:',
      cpmLabel: 'Zeichen/Min',
      prevSentenceButton: '◀️ Zurück',
      nextSentenceButton: 'Weiter ▶️',
      correctionButton: 'Arbeit an Fehlern',
      dictationBlockTitle: 'Diktat',
      learningBlockTitle: 'Lernen',
      clearDataButton: 'Daten löschen',
      clearDataConfirm: 'Alle gespeicherten Daten löschen?',
      dataCleared: 'Daten gelöscht!',
      orderModeLabel: 'Diktierreihenfolge:',
      orderSequential: 'Sequenzielle Reihenfolge',
      orderRandom: 'Zufällige Reihenfolge',
      orderSequentialDesc: 'Sätze werden sequenziell diktiert',
      orderRandomDesc: 'Sätze werden in zufälliger Reihenfolge diktiert',
      repeatCount1Desc: 'Jeder Satz wird 1 Mal diktiert',
      repeatCount2Desc: 'Jeder Satz wird 2 Mal diktiert',
      repeatCount3Desc: 'Jeder Satz wird 3 Mal diktiert (normal → langsam → letzte 3 Wörter)',
      noTextsAvailable: 'Keine Texte für die ausgewählte Sprache verfügbar.',
      helpTitle: 'Hilfe zur Anwendung',
      helpIntro: 'Willkommen in der Diktier-App!',
      helpSection1: '1. Sprachauswahl',
      helpSection1Desc: 'Klicken Sie auf die Flagge der gewünschten Sprache in der oberen linken Ecke.',
      helpSection2: '2. Zufälliger Text',
      helpSection2Desc: 'Klicken Sie auf "Zufälliger Text", um einen zufälligen Text für das Diktat einzufügen.',
      helpSection3: '3. Diktat',
      helpSection3Desc: 'Drücken Sie "Starten", um das Diktat zu beginnen. Verwenden Sie "Pause", "Fortsetzen", "Zurück", "Weiter", "Stopp" zur Steuerung.',
      helpSection4: '4. Überprüfung',
      helpSection4Desc: 'Drücken Sie "Überprüfen", um die Ergebnisse der Textüberprüfung zu sehen.',
      helpSection5: '5. Trainingsmodus',
      helpSection5Desc: 'Aktivieren Sie den "Trainingsmodus", um Fehler in Echtzeit zu sehen.',
      helpSection6: '6. Wiederholungen',
      helpSection6Desc: 'Wählen Sie die Anzahl der Wiederholungen (1, 2 oder 3) für jeden Satz.',
      helpSection7: '7. Diktierreihenfolge',
      helpSection7Desc: 'Wählen Sie "Sequenzielle Reihenfolge" oder "Zufällige Reihenfolge" für das Diktat.',
      helpTip: 'Tipp:',
      helpTipDesc: 'Bei Bedarf können Sie alle gespeicherten Daten löschen, indem Sie auf die entsprechende Schaltfläche in der oberen rechten Ecke klicken.',
      helpButton: 'Hilfe',
      myTextsButton: 'Meine Texte',
      voiceLabel: 'Stimme',
      helpCloseButton: 'Schließen',
    },
    'kk-KZ': {
      title: '🎙️ Диктант қолданбасы',
      originalInputLabel: 'Диктант үшін мәтінді енгізіңіз:',
      originalInputPlaceholder: 'Мәтінді енгізіңіз... Сөйлемдерді нүктелермен бөліңіз.',
      languageLabel: 'Тілді таңдаңыз:',
      randomTextLabel: 'Кездейсоқ мәтін',
      speedLabel: 'Диктант жылдамдығы:',
      pauseDurationLabel: 'Қайталау арасындағы кідіріс:',
      pauseDurationUnit: 'мс',
      repeatLabel: 'Сөйлем қайталаулары:',
      repeatOption1: '1 рет',
      repeatOption2: '2 рет',
      repeatOption3: '3 рет (толық)',
      startButton: 'Бастау',
      pauseButton: 'Кідірту',
      resumeButton: 'Жалғастыру',
      stopButton: 'Тоқтату',
      checkButton: 'Тексеру',
      showTextButton: 'Мәтінді жасыру',
      trainingModeButton: 'Тренировка режимі',
      userTextLabel: 'Сіздің мәтініңіз:',
      userTextPlaceholder: 'Теруді бастаңыз...',
      resultTitle: '✅ Тексеру нәтижесі',
      correctnessLabel: 'Мәтін жазу дәлдігі пайызы:',
      errorsLabel: 'Қателер:',
      errorWordsLabel: 'Қате сөздер:',
      typingSpeedLabel: 'Теру жылдамдығы:',
      cpmLabel: 'таңба/мин',
      prevSentenceButton: '◀️ Алдыңғы',
      nextSentenceButton: 'Келесі ▶️',
      correctionButton: 'Қателермен жұмыс',
      dictationBlockTitle: 'Диктант',
      learningBlockTitle: 'Оқыту',
      clearDataButton: 'Деректерді тазарту',
      clearDataConfirm: 'Барлық сақталған деректерді тазарту керек пе?',
      dataCleared: 'Деректер тазартылды!',
      orderModeLabel: 'Диктант тәртібі:',
      orderSequential: 'Стандартты тәртіп',
      orderRandom: 'Кездейсоқ тәртіп',
      orderSequentialDesc: 'Сөйлемдер рет-ретімен диктантталады',
      orderRandomDesc: 'Сөйлемдер кездейсоқ тәртіпте диктантталады',
      repeatCount1Desc: 'Әрбір сөйлем 1 рет диктантталады',
      repeatCount2Desc: 'Әрбір сөйлем 2 рет диктантталады',
      repeatCount3Desc: 'Әрбір сөйлем 3 рет диктантталады (қалыпты → баяу → соңғы 3 сөз)',
      noTextsAvailable: 'Таңдалған тілде мәтіндер жоқ.',
      helpTitle: 'Қолданба бойынша анықтама',
      helpIntro: 'Диктант қолданбасына қош келдіңіз!',
      helpSection1: '1. Тілді таңдау',
      helpSection1Desc: 'Жоғарғы сол жақ бұрыштағы қажетті тілдің туын басыңыз.',
      helpSection2: '2. Кездейсоқ мәтін',
      helpSection2Desc: 'Диктант үшін кездейсоқ мәтінді енгізу үшін "Кездейсоқ мәтін" түймесін басыңыз.',
      helpSection3: '3. Диктант',
      helpSection3Desc: 'Диктантты бастау үшін "Бастау" түймесін басыңыз. Басқару үшін "Кідірту", "Жалғастыру", "Алдыңғы", "Келесі", "Тоқтату" түймелерін қолданыңыз.',
      helpSection4: '4. Тексеру',
      helpSection4Desc: 'Мәтінді тексеру нәтижелерін көру үшін "Тексеру" түймесін басыңыз.',
      helpSection5: '5. Тренировка режимі',
      helpSection5Desc: 'Қателерді нақты уақытта көру үшін "Тренировка режимін" қосыңыз.',
      helpSection6: '6. Қайталаулар',
      helpSection6Desc: 'Әр сөйлем үшін қайталау санын таңдаңыз (1, 2 немесе 3).',
      helpSection7: '7. Диктант тәртібі',
      helpSection7Desc: 'Сөйлемдерді диктанттау үшін "Стандартты тәртіп" немесе "Кездейсоқ тәртіп" түймесін таңдаңыз.',
      helpTip: 'Кеңес:',
      helpTipDesc: 'Қажет болса, жоғарғы оң жақ бұрыштағы сәйкес түймені басу арқылы барлық сақталған деректерді тазарта аласыз.',
      helpButton: 'Анықтама',
      myTextsButton: 'Менің мәтіндерім',
      voiceLabel: 'Дауыс',
      helpCloseButton: 'Жабу',
    },
  };

  // Функция перевода
  const t = (key: keyof typeof translations['ru-RU']): string => {
    const langTranslations = translations[selectedLang as keyof typeof translations];
    return langTranslations?.[key] || key;
  };

  // ✅ Функция для вставки случайного текста
  const handleRandomText = () => {
    if (!dictationTextsSimple[selectedLang]) {
      alert(t('noTextsAvailable'));
      return;
    }

    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    
    const text = dictationTextsSimple[selectedLang][randomDifficulty];
    if (text) {
      setOriginalText(text);
      setTypingStartTime(null);
      setInputText(''); // Очищаем поле ввода при смене текста
      setResult(null);
      setShowResult(false);
    } else {
      alert(t('noTextsAvailable'));
    }
  };

  const handleStart = () => {
    if (!originalText.trim()) {
      alert(t('originalInputLabel') + ' ' + t('originalInputPlaceholder'));
      return;
    }
    if (!isTTSAvailable()) {
      setTtsError(true);
      return;
    }
    setTtsError(false);
    setResult(null);
    setShowResult(false);
    setTypingStartTime(Date.now());

    stopClickCountRef.current = 0;
    lastStopTimeRef.current = 0;

    // Запускаем отсчёт 3-2-1, потом начинаем диктовку
    setCountdown(3);

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        setCountdown(0);
        clearInterval(timer);
        startDictation();
        // Автофокус на поле ввода ПОСЛЕ отсчёта
        setTimeout(() => {
          dictationInputRef.current?.focus();
        }, 50);
      }
    }, 1000);
  };

  const handleStop = () => {
    const now = Date.now();
    
    if (now - lastStopTimeRef.current > 1500) {
      stopClickCountRef.current = 0;
    }
    
    stopClickCountRef.current++;
    lastStopTimeRef.current = now;
    
    if (stopClickCountRef.current === 1) {
      stopDictation();
    }
    else if (stopClickCountRef.current >= 2) {
      stopDictation();
      
      setTypingStartTime(null);
      
      setTimeout(() => {
        stopClickCountRef.current = 0;
      }, 500);
    }
  };

  const handlePauseResume = () => {
    pauseDictation();
  };

  const handleCorrection = () => {
    if (result && result.errorWords && result.originalSentences && result.errors > 0) {
      const originalSentences = result.originalSentences;
      const errorWords = result.errorWords;

      const sentencesWithErrors = new Set<number>();
      let wordIndex = 0;

      for (let sentIndex = 0; sentIndex < originalSentences.length; sentIndex++) {
        const sentence = originalSentences[sentIndex];
        const wordsInSentence = sentence.trim().split(/\s+/);

        for (let i = 0; i < wordsInSentence.length; i++) {
          if (wordIndex < errorWords.length && errorWords[wordIndex].hasError) {
            sentencesWithErrors.add(sentIndex);
          }
          wordIndex++;
        }
      }

      const correctionText = Array.from(sentencesWithErrors)
        .map(index => originalSentences[index])
        .join(' ');

      if (correctionText) {
        setOriginalText(correctionText);
        setResult(null);
        setInputText('');
        setShowResult(false);
        setTypingStartTime(null);
        
        stopClickCountRef.current = 0;
        lastStopTimeRef.current = 0;
      }
    }
  };

  const handleCheck = () => {
    if (!inputText.trim()) {
      alert(t('userTextPlaceholder'));
      return;
    }

    let typingTime = 0;
    if (typingStartTime !== null) {
      typingTime = (Date.now() - typingStartTime) / 1000 / 60;
    }

    const cpm = typingTime > 0 ? Math.round(inputText.length / typingTime) : 0;

    const originalSentences = originalText.split(/[.!?]+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + '.');

    const res = checkResults(inputText);
    setResult({ ...res, originalSentences, typingTime, cpm });
    setShowResult(true);
    
    stopClickCountRef.current = 0;
    lastStopTimeRef.current = 0;
  };

  // ✅ Функция для показа/скрытия текста
  const handleShowText = () => {
    setShowOriginalTextInput(!showOriginalTextInput);
  };

  // ✅ Функция для переключения режима тренировки
  const handleToggleTrainingMode = () => {
    setIsTrainingMode(!isTrainingMode);
  };

  const formatPauseDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms} ${t('pauseDurationUnit')}`;
    } else {
      return `${(ms / 1000).toFixed(1)} сек`;
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 max-w-6xl pb-24 transition-colors duration-200 ${dk(isDark, 'bg-white text-gray-800', 'bg-gray-900 text-gray-200')}`}>
      {/* Заголовок и флаги */}
      <div className="mb-4 text-center">
        {/* ✅ Единственный кликабельный заголовок */}
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center justify-center gap-2 text-3xl font-bold hover:text-blue-600 transition-colors mb-3"
          title={t('helpTitle')}
        >
          {t('title')}
        </button>

        {/* Баннер ошибки TTS */}
        {ttsError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>⚠️ Синтез речи недоступен.</strong> Убедитесь, что ваш браузер поддерживает Web Speech API,
            или установите Android-приложение. Проверьте настройки браузера: Chrome → Настройки → Синтез речи.
          </div>
        )}

        {/* Флаги для выбора языка + Тёмная тема */}
        <div className="flex gap-1 flex-wrap justify-center items-center">
          {/* Кнопка тёмной темы */}
          <button
            onClick={() => setIsDark(!isDark)}
            className={`text-xl p-1 rounded-md transition-colors ${dk(isDark, 'hover:bg-gray-100', 'hover:bg-gray-700')}`}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {['ru-RU', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'kk-KZ'].map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setSelectedLang(lang as Language);
                setOriginalText('');
                setInputText('');
                setResult(null);
                setShowResult(false);
                stopDictation();
                setTypingStartTime(null);

                stopClickCountRef.current = 0;
                lastStopTimeRef.current = 0;
              }}
              className={`text-xl p-1 rounded-md hover:bg-gray-100 ${
                selectedLang === lang ? 'bg-gray-200' : ''
              }`}
              title={lang.split('-')[1]}
            >
              {lang === 'ru-RU' && '🇷🇺'}
              {lang === 'en-US' && '🇺🇸'}
              {lang === 'es-ES' && '🇪🇸'}
              {lang === 'fr-FR' && '🇫🇷'}
              {lang === 'de-DE' && '🇩🇪'}
              {lang === 'kk-KZ' && '🇰🇿'}
            </button>
          ))}
        </div>
      </div>

      {/* Кнопка для очистки данных и справка */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${dk(isDark, 'bg-gray-700 text-gray-200 hover:bg-gray-600', 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}
            title={t('helpButton')}
          >
            ❓ {t('helpButton')}
          </button>
          <button
            onClick={() => setShowMyTexts(true)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${dk(isDark, 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800', 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200')}`}
            title={t('myTextsButton')}
          >
            📚 {t('myTextsButton')}
          </button>
        </div>
        <button
          onClick={clearSavedData}
          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${dk(isDark, 'bg-red-900/50 text-red-300 hover:bg-red-800', 'bg-red-100 text-red-700 hover:bg-red-200')}`}
          title={t('clearDataConfirm')}
        >
          🧹 {t('clearDataButton')}
        </button>
      </div>

      {/* ✅ Кнопка "Случайный текст" */}
      <div className="mb-4">
        <button
          onClick={handleRandomText}
          className="w-full p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!dictationTextsSimple[selectedLang]}
        >
          🎲 {t('randomTextLabel')}
        </button>
      </div>

      {/* ✅ Переключатель порядка диктовки */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">{t('orderModeLabel')}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderMode('sequential')}
            className={`flex-1 p-3 rounded-lg transition-colors ${
              orderMode === 'sequential' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {t('orderSequential')}
          </button>
          <button
            onClick={() => setOrderMode('random')}
            className={`flex-1 p-3 rounded-lg transition-colors ${
              orderMode === 'random' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {t('orderRandom')}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {orderMode === 'sequential' 
            ? t('orderSequentialDesc') 
            : t('orderRandomDesc')}
        </p>
      </div>

      {/* ✅ Кнопки выбора количества повторений */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">{t('repeatLabel')}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setRepeatCount(1)}
            className={`flex-1 p-3 rounded-lg transition-colors ${
              repeatCount === 1 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {t('repeatOption1')}
          </button>
          <button
            onClick={() => setRepeatCount(2)}
            className={`flex-1 p-3 rounded-lg transition-colors ${
              repeatCount === 2 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {t('repeatOption2')}
          </button>
          <button
            onClick={() => setRepeatCount(3)}
            className={`flex-1 p-3 rounded-lg transition-colors ${
              repeatCount === 3 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {t('repeatOption3')}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {repeatCount === 1 && t('repeatCount1Desc')}
          {repeatCount === 2 && t('repeatCount2Desc')}
          {repeatCount === 3 && t('repeatCount3Desc')}
        </p>
      </div>

      {/* ✅ Поле ввода текста для диктовки */}
      {showOriginalTextInput && (
        <div className="mb-6">
          <label className="block mb-2 font-medium">{t('originalInputLabel')}</label>
          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder={t('originalInputPlaceholder')}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Прогресс-бар */}
      {isPlaying && totalSentences > 0 && (
        <div className={`mb-6 p-4 rounded-lg border ${dk(isDark, 'bg-blue-900/30 border-blue-800', 'bg-blue-50 border-blue-200')}`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${dk(isDark, 'text-blue-300', 'text-blue-700')}`}>
              📝 Предложение {currentSentenceIndex + 1} из {totalSentences}
            </span>
            <span className={`text-sm ${dk(isDark, 'text-blue-400', 'text-blue-500')}`}>
              {Math.round(((currentSentenceIndex + 1) / totalSentences) * 100)}%
            </span>
          </div>
          <div className={`w-full rounded-full h-2.5 ${dk(isDark, 'bg-blue-800', 'bg-blue-200')}`}>
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${dk(isDark, 'bg-blue-400', 'bg-blue-500')}`}
              style={{ width: `${((currentSentenceIndex + 1) / totalSentences) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Ползунок скорости */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">{t('speedLabel')} {dictationSpeed.toFixed(1)}x</label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={dictationSpeed}
          onChange={(e) => setDictationSpeed(parseFloat(e.target.value))}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${dk(isDark, 'bg-gray-700', 'bg-gray-200')}`}
        />
      </div>

      {/* Выбор голоса TTS */}
      {availableVoices.length > 0 && (
        <div className="mb-6">
          <label className="block mb-2 font-medium">🎤 {t('voiceLabel')}</label>
          <select
            value={selectedVoiceIndex}
            onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
            className={`w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dk(isDark, 'border-gray-600 bg-gray-800 text-gray-200', 'border-gray-300 bg-white text-gray-800')}`}
          >
            {availableVoices
              .filter((v) => v.lang.startsWith(selectedLang.split('-')[0]))
              .map((voice, idx) => (
                <option key={idx} value={availableVoices.indexOf(voice)}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            {availableVoices.length > 0 && (
              <>
                <option disabled>── Все голоса ──</option>
                {availableVoices.map((voice, idx) => (
                  <option key={`all-${idx}`} value={idx}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      )}

      {/* Ползунок длительности паузы между повторами */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">{t('pauseDurationLabel')} {formatPauseDuration(pauseDuration)}</label>
        <input
          type="range"
          min="100"
          max="3000"
          step="100"
          value={pauseDuration}
          onChange={(e) => setPauseDuration(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-sm text-gray-500 mt-1">
          <span>100 {t('pauseDurationUnit')}</span>
          <span>1500 {t('pauseDurationUnit')}</span>
          <span>3000 {t('pauseDurationUnit')}</span>
        </div>
      </div>

      {/* Панель управления — прилипает к правому краю */}
      <div className="fixed right-0 top-1/2 transform -translate-y-1/2 bg-white shadow-lg p-4 z-50 border-l border-gray-200 rounded-l-lg">
        <ControlPanel
          isPlaying={isPlaying}
          isPaused={isPaused}
          isTrainingMode={isTrainingMode}
          onStart={handleStart}
          onPause={handlePauseResume}
          onStop={handleStop}
          onCheck={handleCheck}
          onShowText={handleShowText}
          onToggleTrainingMode={handleToggleTrainingMode}
          onGoToPreviousSentence={goToPreviousSentence}
          onGoToNextSentence={goToNextSentence}
          t={t}
        />
      </div>

      {/* Поле ввода текста пользователя */}
      <div className="mt-6 mb-8">
        <label className="block mb-2 font-medium">{t('userTextLabel')}</label>
        <DictationInput
          ref={dictationInputRef}
          value={inputText}
          onChange={setInputText}
          placeholder={t('userTextPlaceholder')}
          rows={6}
          isTrainingMode={isTrainingMode}
          originalText={originalText}
        />
      </div>

      {/* Оверлей отсчёта */}
      <CountdownOverlay count={countdown} />

      {/* Результат проверки */}
      {showResult && result && (
        <ResultDisplay 
          result={result} 
          t={t} 
          onCorrection={result.errors > 0 ? handleCorrection : undefined}
        />
      )}

      {/* Компонент справки */}
      {showHelp && (
        <HelpPage
          onClose={() => setShowHelp(false)}
          t={t}
        />
      )}

      {/* Компонент моих текстов */}
      {showMyTexts && (
        <MyTextsModal
          onClose={() => setShowMyTexts(false)}
          onLoad={(text) => {
            setOriginalText(text);
            setTypingStartTime(null);
            setInputText('');
            setResult(null);
            setShowResult(false);
          }}
          currentText={originalText}
          currentLang={selectedLang}
        />
      )}
    </div>
  );
};

export default App;