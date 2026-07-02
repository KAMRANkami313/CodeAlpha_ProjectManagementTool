import { useState, useEffect, useCallback, useRef } from 'react';

const MENTION_TRIGGER = '@';

const normalize = (s) => (s || '').toLowerCase();

const useMentions = ({ members, currentUser }) => {
  const [activeQuery, setActiveQuery] = useState(null);
  const [activeStart, setActiveStart] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const membersRef = useRef(members);
  membersRef.current = members;

  const detectMention = useCallback((value, cursorPos) => {
    if (!value) {
      setActiveQuery(null);
      setActiveStart(null);
      return;
    }
    const before = value.slice(0, cursorPos);
    const atIdx = before.lastIndexOf(MENTION_TRIGGER);
    if (atIdx === -1) {
      setActiveQuery(null);
      setActiveStart(null);
      return;
    }
    const between = before.slice(atIdx + 1);
    if (/\s{2,}/.test(between) || between.length > 50) {
      setActiveQuery(null);
      setActiveStart(null);
      return;
    }
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) {
      setActiveQuery(null);
      setActiveStart(null);
      return;
    }
    setActiveQuery(between);
    setActiveStart(atIdx);
  }, []);

  const clearMention = useCallback(() => {
    setActiveQuery(null);
    setActiveStart(null);
    setSelectedIndex(0);
  }, []);

  const suggestions = (() => {
    if (activeQuery === null) return [];
    const q = normalize(activeQuery);
    return membersRef.current
      .filter((m) => String(m._id) !== String(currentUser?._id))
      .filter((m) => {
        const n = normalize(m.name);
        const e = normalize(m.email);
        return q === '' || n.includes(q) || e.includes(q);
      })
      .slice(0, 5);
  })();

  const applyMention = useCallback((inputRef, member) => {
    if (!inputRef?.current || activeStart === null) return '';
    const input = inputRef.current;
    const value = input.value;
    const before = value.slice(0, activeStart);
    const after = value.slice(input.selectionStart);
    const newValue = `${before}@${member.name} ${after}`;
    input.value = newValue;
    const newCursor = before.length + member.name.length + 2;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newCursor, newCursor);
    });
    clearMention();
    return newValue;
  }, [activeStart, clearMention]);

  const moveSelection = useCallback((direction) => {
    setSelectedIndex((prev) => {
      const max = suggestions.length - 1;
      if (max < 0) return 0;
      if (direction === 'down') return Math.min(max, prev + 1);
      return Math.max(0, prev - 1);
    });
  }, [suggestions.length]);

  return {
    activeQuery,
    isMentioning: activeQuery !== null,
    suggestions,
    selectedIndex,
    detectMention,
    clearMention,
    applyMention,
    moveSelection,
  };
};

export { MENTION_TRIGGER };
export default useMentions;