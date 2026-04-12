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
  return (
    <div className="flex flex-col gap-2">
      {/* Блок 1: Диктовка */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onStart}
          disabled={isPlaying}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium transition-all duration-200 ${
            isPlaying ? 'bg-green-300 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
          title={t('startButton')}
        >
          ▶️
        </button>
        <button
          onClick={onPause}
          disabled={!isPlaying}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium transition-all duration-200 ${
            isPaused ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title={isPaused ? t('resumeButton') : t('pauseButton')}
        >
          {isPaused ? '▶️' : '⏸️'}
        </button>
        <button
          onClick={onGoToPreviousSentence}
          className="w-16 h-16 rounded-full bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center text-xl font-medium transition-all duration-200"
          title={t('prevSentenceButton')}
        >
          ◀️
        </button>
        <button
          onClick={onGoToNextSentence}
          className="w-16 h-16 rounded-full bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center text-xl font-medium transition-all duration-200"
          title={t('nextSentenceButton')}
        >
          ▶️
        </button>
        <button
          onClick={onStop}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-xl font-medium transition-all duration-200"
          title={t('stopButton')}
        >
          ⏹️
        </button>
      </div>

      {/* Разделитель */}
      <div className="border-t border-gray-300 my-2"></div>

      {/* Блок 2: Обучение */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onCheck}
          className="w-16 h-16 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center text-xl font-medium transition-all duration-200"
          title={t('checkButton')}
        >
          ✅
        </button>
        <button
          onClick={onShowText}
          className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center text-xl font-medium transition-all duration-200"
          title={t('showTextButton')}
        >
          📝
        </button>
        <button
          onClick={onToggleTrainingMode}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium transition-all duration-200 ${
            isTrainingMode
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-500 hover:bg-gray-600 text-white'
          }`}
          title={t('trainingModeButton')}
        >
          🎯
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;