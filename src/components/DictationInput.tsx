import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface DictationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  originalText: string;
  isTrainingMode: boolean;
  rows?: number;
}

const DictationInput = forwardRef<{ focus: () => void }, DictationInputProps>(({
  value,
  onChange,
  placeholder,
  originalText,
  isTrainingMode,
  rows = 6
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const lastCursorPositionRef = useRef<number | null>(null);
  const isUpdatingDisplayRef = useRef(false);

  // Экспортируем метод focus
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (containerRef.current) {
        containerRef.current.focus();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }), []);

  useEffect(() => {
    if (isTrainingMode && containerRef.current && !isUpdatingDisplayRef.current) {
      updateDisplay();
    }
  }, [value, originalText, isTrainingMode]);

  const updateDisplay = () => {
    if (!isTrainingMode || !containerRef.current) return;
    
    isUpdatingDisplayRef.current = true; // ✅ Устанавливаем флаг обновления
    
    try {
      const currentValue = value;
      const original = originalText;

      let html = '';
      
      // Разбиваем на строки для сравнения
      const currentLines = currentValue.split('\n');
      const originalLines = original.split('\n');
      const maxLines = Math.max(currentLines.length, originalLines.length);

      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        const currentLine = currentLines[lineIdx] || '';
        const originalLine = originalLines[lineIdx] || '';
        const minLineLength = Math.min(currentLine.length, originalLine.length);

        // Сравниваем символы в строке
        for (let i = 0; i < minLineLength; i++) {
          const char = currentLine[i];
          const origChar = originalLine[i];

          if (char !== origChar) {
            html += `<span style="color: red; font-weight: bold;">${escapeHtml(char)}</span>`;
          } else {
            html += escapeHtml(char);
          }
        }

        // Добавляем оставшиеся символы в текущей строке
        if (currentLine.length > originalLine.length) {
          html += `<span style="color: red; font-weight: bold;">${escapeHtml(currentLine.substring(originalLine.length))}</span>`;
        }

        // Добавляем перенос строки (кроме последней строки)
        if (lineIdx < maxLines - 1) {
          html += '<br>';
        }
      }

      // Сохраняем текущий фокус и позицию курсора
      const isFocused = document.activeElement === containerRef.current;
      const savedPosition = isFocused ? getCaretPosition(containerRef.current) : null;
      
      // Устанавливаем новое содержимое
      containerRef.current.innerHTML = html;
      
      // Восстанавливаем позицию курсора если элемент в фокусе
      if (isFocused && savedPosition !== null && containerRef.current) {
        // Небольшая задержка для гарантии, что DOM обновился
        setTimeout(() => {
          if (containerRef.current) {
            setCaretPosition(containerRef.current, savedPosition);
          }
        }, 0);
      }
    } finally {
      // ✅ Сбрасываем флаг обновления через небольшую задержку
      setTimeout(() => {
        isUpdatingDisplayRef.current = false;
      }, 10);
    }
  };

  // Функция для экранирования HTML
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handleInput = () => {
    if (!containerRef.current || isComposingRef.current) return;
    
    // Получаем текст из contentEditable, сохраняя переносы строк
    const newValue = getTextFromContentEditable(containerRef.current);
    
    // Сохраняем позицию курсора перед обновлением
    if (containerRef.current === document.activeElement) {
      lastCursorPositionRef.current = getCaretPosition(containerRef.current);
    }
    
    onChange(newValue);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Обрабатываем Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (containerRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // Проверяем, находится ли курсор в конце текстового узла
          const { node, offset } = getNodeAndOffsetAtCursor();
          
          // Вставляем перенос строки
          const br = document.createElement('br');
          
          // Если курсор в текстовом узле, разбиваем его
          if (node && node.nodeType === Node.TEXT_NODE && offset > 0) {
            const textNode = node as Text;
            const beforeText = textNode.textContent?.substring(0, offset) || '';
            const afterText = textNode.textContent?.substring(offset) || '';
            
            // Создаем новые текстовые узлы
            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);
            
            // Заменяем старый узел на новые узлы с br между ними
            if (textNode.parentNode) {
              textNode.parentNode.insertBefore(beforeNode, textNode);
              textNode.parentNode.insertBefore(br, textNode);
              textNode.parentNode.insertBefore(afterNode, textNode);
              textNode.parentNode.removeChild(textNode);
            }
            
            // Устанавливаем курсор после br (в начале afterNode)
            range.setStart(afterNode, 0);
          } else {
            // Просто вставляем br
            range.deleteContents();
            range.insertNode(br);
            
            // Устанавливаем курсор после br
            range.setStartAfter(br);
          }
          
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Обновляем значение
          const newValue = getTextFromContentEditable(containerRef.current);
          onChange(newValue);
        }
      }
      return;
    }
  };

  const getNodeAndOffsetAtCursor = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { node: null, offset: 0 };
    }
    
    const range = selection.getRangeAt(0);
    return {
      node: range.startContainer,
      offset: range.startOffset
    };
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    if (!containerRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const pastedText = e.clipboardData.getData('text/plain');
    
    // Вставляем текст как обычные текстовые узлы
    const textNode = document.createTextNode(pastedText);
    range.deleteContents();
    range.insertNode(textNode);
    
    // Устанавливаем курсор после вставленного текста
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Обновляем значение
    const newValue = getTextFromContentEditable(containerRef.current);
    onChange(newValue);
  };

  // Функция для получения текста из contentEditable с сохранением переносов
  const getTextFromContentEditable = (element: HTMLElement): string => {
    let text = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeName === 'BR') {
        text += '\n';
      }
    }
    
    return text;
  };

  // Функции для работы с позицией курсора
  const getCaretPosition = (element: HTMLElement): number | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    
    // Считаем позицию с учетом br как \n
    let position = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      if (node === range.startContainer) {
        if (node.nodeType === Node.TEXT_NODE) {
          position += Math.min(range.startOffset, node.textContent?.length || 0);
        } else if (node.nodeName === 'BR') {
          // Для br, offset 0 = перед br, 1 = после br
          position += range.startOffset;
        }
        break;
      }
      
      if (node.nodeType === Node.TEXT_NODE) {
        position += node.textContent?.length || 0;
      } else if (node.nodeName === 'BR') {
        position += 1;
      }
    }
    
    return position;
  };

  const setCaretPosition = (element: HTMLElement, position: number) => {
    const selection = window.getSelection();
    if (!selection) return;
    
    const range = document.createRange();
    
    let currentPos = 0;
    let foundNode: Node | null = null;
    let foundOffset = 0;
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      let nodeLength = 0;
      
      if (node.nodeType === Node.TEXT_NODE) {
        nodeLength = node.textContent?.length || 0;
      } else if (node.nodeName === 'BR') {
        nodeLength = 1;
      }
      
      if (currentPos + nodeLength >= position) {
        foundNode = node;
        if (node.nodeType === Node.TEXT_NODE) {
          foundOffset = Math.min(position - currentPos, node.textContent?.length || 0);
        } else if (node.nodeName === 'BR') {
          // Для br: position - currentPos = 0 = перед br, 1 = после br
          foundOffset = Math.min(Math.max(position - currentPos, 0), 1);
        }
        break;
      }
      currentPos += nodeLength;
    }
    
    if (foundNode) {
      if (foundNode.nodeType === Node.TEXT_NODE) {
        range.setStart(foundNode, foundOffset);
      } else if (foundNode.nodeName === 'BR') {
        if (foundOffset === 0) {
          range.setStartBefore(foundNode);
        } else {
          range.setStartAfter(foundNode);
        }
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Фокусируем элемент
      if (element !== document.activeElement) {
        element.focus();
      }
    } else {
      // Если позиция в конце, ставим курсор в конец последнего узла
      const lastChild = element.lastChild;
      if (lastChild) {
        if (lastChild.nodeType === Node.TEXT_NODE) {
          range.setStart(lastChild, lastChild.textContent?.length || 0);
        } else if (lastChild.nodeName === 'BR') {
          range.setStartAfter(lastChild);
        } else {
          range.setStartAfter(lastChild);
        }
      } else {
        range.setStart(element, 0);
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return (
    <div className="relative">
      {isTrainingMode ? (
        <div
          ref={containerRef}
          contentEditable={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px] overflow-auto"
          style={{ 
            whiteSpace: 'pre-wrap',
            direction: 'ltr',
            unicodeBidi: 'plaintext',
            lineHeight: '1.5'
          }}
          dir="ltr"
          suppressContentEditableWarning={true}
          data-placeholder={value === '' ? placeholder : ''}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          dir="ltr"
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
    </div>
  );
});

export default DictationInput;