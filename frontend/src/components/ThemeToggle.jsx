import { Sun, Moon, Monitor } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

const ThemeToggle = ({ variant = 'cycle' }) => {
  const { themePreference, resolvedTheme, toggleTheme, updateTheme } = usePreferences();

  if (variant === 'simple') {
    return (
      <button
        className="theme-toggle-btn"
        onClick={toggleTheme}
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  const options = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <div className="theme-toggle-group" role="radiogroup" aria-label="Theme preference">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          className={`theme-toggle-option ${themePreference === value ? 'theme-toggle-option-active' : ''}`}
          onClick={() => updateTheme(value)}
          title={`${label} theme`}
          role="radio"
          aria-checked={themePreference === value}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;