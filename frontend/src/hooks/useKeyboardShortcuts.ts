import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutMap {
  [key: string]: KeyHandler;
}

const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;
      
      let keyCombo = '';
      if (isCtrl) keyCombo += 'ctrl+';
      if (isShift) keyCombo += 'shift+';
      keyCombo += event.key.toLowerCase();

      if (shortcuts[keyCombo]) {
        event.preventDefault();
        shortcuts[keyCombo](event);
      } else if (shortcuts[event.key.toLowerCase()] && !isCtrl && !isShift) {
        // Handle single key shortcuts if not typing in an input
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (!isInput) {
          shortcuts[event.key.toLowerCase()](event);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

export default useKeyboardShortcuts;
