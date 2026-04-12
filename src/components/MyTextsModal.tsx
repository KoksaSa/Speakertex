import React, { useState } from 'react';

export interface SavedText {
  id: string;
  title: string;
  text: string;
  lang: string;
  createdAt: number;
}

interface MyTextsModalProps {
  onClose: () => void;
  onLoad: (text: string) => void;
  currentText?: string;
  currentLang?: string;
}

const STORAGE_KEY = 'dictation_my_texts';

const loadTexts = (): SavedText[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveTexts = (texts: SavedText[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
  } catch (e) {
    console.error('Failed to save texts', e);
  }
};

const MyTextsModal: React.FC<MyTextsModalProps> = ({
  onClose,
  onLoad,
  currentText = '',
  currentLang,
}) => {
  const [texts, setTexts] = useState<SavedText[]>(loadTexts);
  const [titleInput, setTitleInput] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (!currentText.trim()) return;
    const title = titleInput.trim() || `Текст ${texts.length + 1}`;
    const newText: SavedText = {
      id: Date.now().toString(),
      title,
      text: currentText,
      lang: currentLang || 'ru-RU',
      createdAt: Date.now(),
    };
    const updated = [...texts, newText];
    setTexts(updated);
    saveTexts(updated);
    setTitleInput('');
    setShowForm(false);
  };

  const handleLoad = (item: SavedText) => {
    onLoad(item.text);
    onClose();
  };

  const handleDelete = (id: string) => {
    const updated = texts.filter(t => t.id !== id);
    setTexts(updated);
    saveTexts(updated);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">📚 Мои тексты</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 text-2xl">✕</button>
          </div>

          {/* Кнопка сохранения текущего текста */}
          {currentText && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                >
                  💾 Сохранить текущий текст
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="Название (необязательно)"
                    className="flex-1 p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200"
                  />
                  <button onClick={handleSave} className="px-3 py-2 bg-green-500 text-white rounded text-sm">OK</button>
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 bg-gray-300 dark:bg-gray-600 rounded text-sm">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Список сохранённых текстов */}
          {texts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Нет сохранённых текстов</p>
          ) : (
            <div className="space-y-2">
              {texts.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                  <div className="flex-1 cursor-pointer" onClick={() => handleLoad(item)}>
                    <h3 className="font-medium text-gray-800 dark:text-gray-100">{item.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.lang} • {new Date(item.createdAt).toLocaleDateString()} • {item.text.length} символов
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleLoad(item)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                    >
                      Загрузить
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTextsModal;
