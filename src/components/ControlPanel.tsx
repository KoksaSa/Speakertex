import React from 'react';

type TranslationKey =
  | 'title' | 'originalInputLabel' | 'originalInputPlaceholder' | 'languageLabel'
  | 'randomTextLabel' | 'speedLabel' | 'pauseDurationLabel' | 'pauseDurationUnit'
  | 'repeatLabel' | 'repeatOption1' | 'repeatOption2' | 'repeatOption3'
  | 'startButton' | 'pauseButton' | 'resumeButton' | 'stopButton' | 'checkButton'
  | 'showTextButton' | 'trainingModeButton' | 'userTextLabel' | 'userTextPlaceholder'
  | 'resultTitle' | 'correctnessLabel' | 'errorsLabel' | 'errorWordsLabel'
  | 'typingSpeedLabel' | 'cpmLabel' | 'prevSentenceButton' | 'nextSentenceButton'
  | 'correctionButton' | 'dictationBlockTitle' | 'learningBlockTitle'
  | 'clearDataButton' | 'clearDataConfirm' | 'dataCleared'
  | 'helpTitle' | 'helpIntro' | 'helpSection1' | 'helpSection1Desc'
  | 'helpSection2' | 'helpSection2Desc' | 'helpSection3' | 'helpSection3Desc'
  | 'helpSection4' | 'helpSection4Desc' | 'helpSection5' | 'helpSection5Desc'
  | 'helpSection6' | 'helpSection6Desc' | 'helpSection7' | 'helpSection7Desc'
  | 'helpTip' | 'helpTipDesc' | 'helpCloseButton'
  | 'orderModeLabel' | 'orderSequential' | 'orderRandom'
  | 'orderSequentialDesc' | 'orderRandomDesc'
  | 'repeatCount1Desc' | 'repeatCount2Desc' | 'repeatCount3Desc'
  | 'noTextsAvailable' | 'helpButton' | 'myTextsButton' | 'voiceLabel';

interface ControlPanelProps {
  isPlaying: boolean;
  isPaused: boolean;
  isTrainingMode: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onCheck: () => void;
  onShowText: () => void;
  onToggleTrainingMode: () => void;
  onGoToPreviousSentence: () => void;
  onGoToNextSentence: () => void;
  t: (key: TranslationKey) => string;
}

const BASE_BTN = 'rounded-full flex items-center justify-center font-medium transition-all duration-200 shadow-md active:scale-95 w-12 h-12 text-lg sm:w-14 sm:h-14 sm:text-xl';

/**
 * Панель управления — горизонтальный док внизу экрана.
 *
 * Два режима:
 *  • ВОСПРОИЗВЕДЕНИЕ (isPlaying && !isPaused) — «мини»: остаются только
 *    ⏸️ пауза, ⏮️/⏭️ навигация и ⏹️ стоп. Старт (неактивен) и учебные
 *    кнопки (проверка/показать текст/тренировка) скрыты, чтобы не мешать.
 *  • ПРОСТОЙ / ПАУЗА — полный набор: добавляются 🎙️ старт и учебные кнопки.
 */
const ControlPanel: React.FC<ControlPanelProps> = ({
  isPlaying,
  isPaused,
  isTrainingMode,
  onStart,
  onPause,
  onStop,
  onCheck,
  onShowText,
  onToggleTrainingMode,
  onGoToPreviousSentence,
  onGoToNextSentence,
  t
}) => {
  const playing = isPlaying && !isPaused;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      {/* Старт — скрыт во время воспроизведения (там он всё равно неактивен) */}
      {!playing && (
        <button
          onClick={onStart}
          disabled={isPlaying}
          className={`${BASE_BTN} ${isPlaying ? 'bg-green-300 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          title={t('startButton')}
        >
          🎙️
        </button>
      )}

      {/* Пауза / продолжить — доступна всегда */}
      <button
        onClick={onPause}
        disabled={!isPlaying}
        className={`${BASE_BTN} ${isPaused ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed'}`}
        title={isPaused ? t('resumeButton') : t('pauseButton')}
      >
        {isPaused ? '▶️' : '⏸️'}
      </button>

      <button
        onClick={onGoToPreviousSentence}
        className={`${BASE_BTN} bg-gray-500 hover:bg-gray-600 text-white`}
        title={t('prevSentenceButton')}
      >
        ⏮️
      </button>
      <button
        onClick={onGoToNextSentence}
        className={`${BASE_BTN} bg-gray-500 hover:bg-gray-600 text-white`}
        title={t('nextSentenceButton')}
      >
        ⏭️
      </button>
      <button
        onClick={onStop}
        className={`${BASE_BTN} bg-red-500 hover:bg-red-600 text-white`}
        title={t('stopButton')}
      >
        ⏹️
      </button>

      {/* Учебные кнопки — скрыты во время воспроизведения */}
      {!playing && (
        <>
          {/* Разделитель между блоками «диктовка» и «обучение» */}
          <div className="w-px h-9 bg-gray-400/50 mx-1" aria-hidden="true"></div>

          <button
            onClick={onCheck}
            className={`${BASE_BTN} bg-purple-500 hover:bg-purple-600 text-white`}
            title={t('checkButton')}
          >
            ✅
          </button>
          <button
            onClick={onShowText}
            className={`${BASE_BTN} bg-yellow-500 hover:bg-yellow-600 text-white`}
            title={t('showTextButton')}
          >
            📝
          </button>
          <button
            onClick={onToggleTrainingMode}
            className={`${BASE_BTN} ${isTrainingMode ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
            title={t('trainingModeButton')}
          >
            🎯
          </button>
        </>
      )}
    </div>
  );
};

export default ControlPanel;
