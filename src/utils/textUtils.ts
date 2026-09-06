// src/utils/textUtils.ts
// Общие утилиты работы с текстом для диктовки и проверки.
// Используются и в useDictation, и в App — чтобы разбиение на предложения
// было гарантированно одинаковым при озвучке и при проверке.

/**
 * Разбивает текст на предложения, СОХРАНЯЯ исходную пунктуацию (. ! ?).
 *
 * Границей предложения считается последовательность [.!?]+, за которой
 * следует пробел, конец строки ИЛИ закрывающая кавычка/скобка (перед
 * пробелом или концом строки). Поэтому десятичные числа вроде «3.5»
 * и сокращения без пробела после точки не разрываются, а прямая речь
 * вида: Команда: «Всем спать!» Лагерь затихает. — разбивается корректно.
 *
 * Примеры:
 *   "Мир? Привет. 3.5 раза"  ->  ["Мир?", "Привет.", "3.5 раза"]
 *   "Первая строка\nВторая."  ->  ["Первая строка", "Вторая."]
 *   "Команда: «Всем спать!» Всё."  ->  ["Команда: «Всем спать!»", "Всё."]
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const sentences: string[] = [];

  for (const line of lines) {
    // split с захватывающей скобкой возвращает: [текст, знак, текст, знак, ..., последний текст]
    // в знак включаем и идущие следом закрывающие кавычки/скобки (»"')]),
    // а lookahead требует после них пробел или конец строки
    const tokens = line.split(/([.!?]+[»"')\]]*)(?=[»"')\]]*(?:\s|$))/);

    for (let k = 0; k < tokens.length; k += 2) {
      const body = (tokens[k] || '').trim();
      const punct = (tokens[k + 1] || '').trim();
      const sentence = `${body}${punct}`.trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
    }
  }

  return sentences;
}

export interface WordError {
  original: string;
  user: string;
  hasError: boolean;
}

export interface TextCheckResult {
  correct: string;
  errors: number;
  total: number;
  errorWords: WordError[];
  errorSentenceIndices: number[];
}

/**
 * Сравнивает пользовательский ввод с эталонными предложениями.
 *
 * Ключевые свойства:
 *  - LCS-выравнивание слов вместо позиционного сравнения: пропущенное или
 *    лишнее слово больше не «сдвигает» всю дальнейшую статистику;
 *  - работает при случайном порядке диктовки (совпавшие слова находятся
 *    независимо от их позиции);
 *  - strictPunctuation = false — знаки препинания и апострофы игнорируются
 *    (прежнее поведение по умолчанию);
 *  - strictPunctuation = true — пунктуация является частью слова и влияет
 *    на результат (для тренировки орфографии).
 *
 * Возвращает также errorSentenceIndices — индексы эталонных предложений,
 * содержащих ошибки (для режима «Работа над ошибками»).
 */
export function compareTexts(
  sentences: string[],
  userInput: string,
  strictPunctuation: boolean = false
): TextCheckResult {
  const removePunctuation = (str: string) => str.replace(/[.,!?;:—–\-"'`«»]/g, '');
  const tokenize = (str: string): string[] => {
    const cleaned = strictPunctuation ? str : removePunctuation(str);
    return cleaned.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0);
  };

  // Токены эталона строим ПО ПРЕДЛОЖЕНИЯМ, чтобы маппить индексы слов на предложения
  const perSentenceTokens: string[][] = sentences.map(s => tokenize(s));
  const originalWords: string[] = perSentenceTokens.flat();
  const userWords = tokenize(userInput);

  // Динамическое программирование: длины LCS для всех суффиксов
  const n = originalWords.length;
  const m = userWords.length;
  const dp: Uint32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = originalWords[i] === userWords[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Восстановление выравнивания: match / удаление (пропуск) / вставка (лишнее)
  interface Op { ai: number; bi: number; match: boolean; }
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (originalWords[i] === userWords[j]) {
      ops.push({ ai: i, bi: j, match: true });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ ai: i, bi: -1, match: false }); // слово пропущено
      i++;
    } else {
      ops.push({ ai: -1, bi: j, match: false }); // лишнее слово
      j++;
    }
  }
  while (i < n) { ops.push({ ai: i, bi: -1, match: false }); i++; }
  while (j < m) { ops.push({ ai: -1, bi: j, match: false }); j++; }

  // Группируем подряд идущие пропуски/вставки в пары «замена» для отображения
  const errorWords: WordError[] = [];
  const errorTokenIndices: number[] = [];
  let pendingDel: number[] = [];
  let pendingIns: number[] = [];
  const flushPending = () => {
    const pairs = Math.max(pendingDel.length, pendingIns.length);
    for (let k = 0; k < pairs; k++) {
      const ai = pendingDel[k] ?? -1;
      const bi = pendingIns[k] ?? -1;
      errorWords.push({
        original: ai >= 0 ? originalWords[ai] : '',
        user: bi >= 0 ? userWords[bi] : '',
        hasError: true,
      });
      if (ai >= 0) errorTokenIndices.push(ai);
    }
    pendingDel = [];
    pendingIns = [];
  };
  for (const op of ops) {
    if (op.match) {
      flushPending();
      errorWords.push({ original: originalWords[op.ai], user: userWords[op.bi], hasError: false });
    } else if (op.ai >= 0) {
      pendingDel.push(op.ai);
    } else {
      pendingIns.push(op.bi);
    }
  }
  flushPending();

  // Маппинг индексов токенов эталона на индексы предложений
  const errorSentenceIndices: number[] = [];
  let tokenCursor = 0;
  const boundaries: Array<[number, number]> = perSentenceTokens.map(toks => {
    const start = tokenCursor;
    tokenCursor += toks.length;
    return [start, tokenCursor];
  });
  for (const idx of errorTokenIndices) {
    for (let s = 0; s < boundaries.length; s++) {
      const [start, end] = boundaries[s];
      if (idx >= start && idx < end) {
        if (!errorSentenceIndices.includes(s)) errorSentenceIndices.push(s);
        break;
      }
    }
  }

  const errors = errorWords.filter(w => w.hasError).length;
  const total = n;
  const percentCorrect = total > 0 ? Math.max(0, ((total - errors) / total) * 100) : 100;
  return {
    correct: `${Math.round(percentCorrect)}%`,
    errors,
    total,
    errorWords,
    errorSentenceIndices,
  };
}
