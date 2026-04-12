// src/components/HelpPage.tsx

import React from 'react';

type TranslationKey =
  | 'helpTitle' | 'helpIntro' | 'helpSection1' | 'helpSection1Desc'
  | 'helpSection2' | 'helpSection2Desc' | 'helpSection3' | 'helpSection3Desc'
  | 'helpSection4' | 'helpSection4Desc' | 'helpSection5' | 'helpSection5Desc'
  | 'helpSection6' | 'helpSection6Desc' | 'helpSection7' | 'helpSection7Desc'
  | 'helpTip' | 'helpTipDesc' | 'helpCloseButton';

interface HelpPageProps {
  onClose: () => void;
  t: (key: TranslationKey) => string;
}

const HelpPage: React.FC<HelpPageProps> = ({ onClose, t }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-800">ℹ️ {t('helpTitle') || 'Справка по приложению'}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 text-gray-700">
            <p>
              <strong>{t('helpIntro') || 'Добро пожаловать в приложение-диктант!'}</strong>
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection1') || '1. Выбор языка'}</h3>
            <p>
              {t('helpSection1Desc') || 'Нажмите на флаг нужного языка в верхнем левом углу.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection2') || '2. Случайный текст'}</h3>
            <p>
              {t('helpSection2Desc') || 'Нажмите кнопку "Случайный текст", чтобы вставить случайный текст для диктовки.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection3') || '3. Диктовка'}</h3>
            <p>
              {t('helpSection3Desc') || 'Нажмите "Старт", чтобы начать диктовку. Используйте "Пауза", "Продолжить", "Назад", "Вперед", "Стоп" для управления.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection4') || '4. Проверка'}</h3>
            <p>
              {t('helpSection4Desc') || 'Нажмите "Проверить", чтобы увидеть результаты проверки текста.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection5') || '5. Режим тренировки'}</h3>
            <p>
              {t('helpSection5Desc') || 'Включите "Режим тренировки", чтобы видеть ошибки в реальном времени.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection6') || '6. Повторения'}</h3>
            <p>
              {t('helpSection6Desc') || 'Выберите количество повторений (1, 2 или 3) для каждого предложения.'}
            </p>

            <h3 className="font-bold text-lg mt-4">{t('helpSection7') || '7. Порядок диктовки'}</h3>
            <p>
              {t('helpSection7Desc') || 'Выберите "Стандартный порядок" или "Случайный порядок" для диктовки предложений.'}
            </p>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="italic">
                <strong>{t('helpTip') || 'Совет:'}</strong> {t('helpTipDesc') || 'При необходимости вы можете очистить все сохраненные данные, нажав на соответствующую кнопку в правом верхнем углу.'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            >
              {t('helpCloseButton') || 'Закрыть'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;