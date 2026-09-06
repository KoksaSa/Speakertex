// PiperVoiceSettings.tsx — блок выбора голосового движка (системный / Piper офлайн)
import React, { useEffect } from 'react';
import { usePiperTTS } from '../hooks/usePiperTTS';
import { piperEngine, getVoicesForLang } from '../utils/piperEngine';

interface PiperVoiceSettingsProps {
  isDark: boolean;
  lang: string; // язык диктовки — определяет список Piper-голосов
  testText: string;
  // t из App: ключи типизированы словарём ru-RU; здесь ослабляем до never-совместимого вызова
  t: (key: never) => string;
}

const PiperVoiceSettings: React.FC<PiperVoiceSettingsProps> = ({ isDark, lang, testText, t }) => {
  const piper = usePiperTTS();
  const voices = getVoicesForLang(lang);

  // Смена языка диктовки → выбираем голос этого языка, если текущий не подходит
  useEffect(() => {
    if (voices.length > 0 && !voices.some((v) => v.id === piper.voiceId)) {
      piperEngine.setVoice(voices[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const selectClass = `w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-gray-300 bg-white text-gray-800'
  }`;

  const toggleBtn = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
      active
        ? 'bg-blue-500 text-white'
        : isDark
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`;

  const tr = (key: string) => (t as unknown as (k: string) => string)(key);

  return (
    <div className="mb-6">
      <label className="block mb-2 font-medium">🔊 {tr('voiceEngineLabel')}</label>

      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => piperEngine.setEnabled(false)} className={toggleBtn(!piper.enabled)}>
          {tr('voiceSystem')}
        </button>
        <button
          onClick={() => piperEngine.setEnabled(true)}
          className={toggleBtn(piper.enabled)}
          disabled={piper.status === 'unsupported'}
        >
          {tr('voicePiper')}
        </button>
      </div>

      {piper.status === 'unsupported' && (
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {tr('piperUnsupported')}
        </p>
      )}

      {piper.enabled && piper.status !== 'unsupported' && (
        <div className="flex flex-col gap-2">
          <select
            value={piper.voiceId}
            onChange={(e) => piperEngine.setVoice(e.target.value)}
            className={selectClass}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          {piper.status === 'idle' && (
            <button
              onClick={() => void piperEngine.prepare()}
              className="px-3 py-2 rounded-lg text-sm bg-purple-500 hover:bg-purple-600 text-white transition-all"
            >
              ⬇️ {tr('piperDownload')}
            </button>
          )}

          {(piper.status === 'downloading' || piper.status === 'warming') && (
            <div>
              <div className={`w-full h-2 rounded-lg overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${Math.max(piper.progress, 3)}%` }}
                />
              </div>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {piper.status === 'warming'
                  ? tr('piperWarming')
                  : `${tr('piperDownloading')} ${piper.progress}%`}
              </p>
            </div>
          )}

          {piper.status === 'ready' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-green-600">✓ {tr('piperReady')}</span>
              <button
                onClick={() => {
                  piperEngine.stop();
                  piperEngine.speak(testText, 1);
                }}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔊 {tr('piperTest')}
              </button>
            </div>
          )}

          {piper.status === 'error' && (
            <div>
              <p className="text-sm text-red-500">{tr('piperError')}: {piper.error}</p>
              <button
                onClick={() => void piperEngine.prepare()}
                className="mt-1 px-3 py-2 rounded-lg text-sm bg-purple-500 hover:bg-purple-600 text-white transition-all"
              >
                {tr('piperDownload')}
              </button>
            </div>
          )}

          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {tr('piperNote')}
          </p>
        </div>
      )}
    </div>
  );
};

export default PiperVoiceSettings;
