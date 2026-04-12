// src/components/ResultDisplay.tsx

import React from 'react';

type TranslationKey =
  | 'resultTitle' | 'correctnessLabel' | 'errorsLabel' | 'errorWordsLabel'
  | 'typingSpeedLabel' | 'cpmLabel' | 'correctionButton';

interface ResultDisplayProps {
  result: {
    correct: string;
    errors: number;
    total: number;
    errorWords: Array<{ original: string; user: string; hasError: boolean }>;
    typingTime?: number;
    cpm?: number;
  };
  t: (key: TranslationKey) => string;
  onCorrection?: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, t, onCorrection }) => {
  // Фильтруем только слова с ошибками
  const errorWordsOnly = result.errorWords.filter(word => word.hasError);

  return (
    <div className="sticky top-0 z-50 bg-white p-4 shadow-md mb-8">
      <h3 className="text-xl font-bold text-green-600 mb-4">{t('resultTitle')}</h3>
      
      <p><strong>{t('correctnessLabel')}:</strong> {result.correct}</p>
      <p><strong>{t('errorsLabel')}:</strong> {result.errors}</p>
      {result.cpm && (
        <p><strong>{t('typingSpeedLabel')}:</strong> {result.cpm} {t('cpmLabel')}</p>
      )}

      {/* Показываем только слова с ошибками */}
      {errorWordsOnly.length > 0 && (
        <>
          <p><strong>{t('errorWordsLabel')}:</strong></p>
          <ul className="list-disc pl-6">
            {errorWordsOnly.map((word, index) => (
              <li key={index}>
                <span className="text-red-600">
                  {word.original} → {word.user}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Кнопка "Работа над ошибками" — только если есть ошибки */}
      {onCorrection && result.errors > 0 && (
        <button
          onClick={onCorrection}
          className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
        >
          {t('correctionButton')}
        </button>
      )}
    </div>
  );
};

export default ResultDisplay;