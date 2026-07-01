import { useMemo } from 'react';

const STRENGTH_CONFIG = {
  0: { label: 'Empty', class: 'strength-empty', percent: 0 },
  1: { label: 'Very weak', class: 'strength-very-weak', percent: 20 },
  2: { label: 'Weak', class: 'strength-weak', percent: 40 },
  3: { label: 'Fair', class: 'strength-fair', percent: 60 },
  4: { label: 'Good', class: 'strength-good', percent: 80 },
  5: { label: 'Strong', class: 'strength-strong', percent: 100 },
};

const COMMON_WEAK_PATTERNS = [
  'password', '123456', 'qwerty', 'admin', 'letmein',
  'welcome', 'iloveyou', 'monkey', 'dragon', 'master',
];

const scorePassword = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const lower = password.toLowerCase();
  if (COMMON_WEAK_PATTERNS.some((p) => lower.includes(p))) {
    score = Math.max(0, score - 2);
  }
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
  }
  return Math.min(score, 5);
};

const PasswordStrengthMeter = ({ password }) => {
  const score = useMemo(() => scorePassword(password), [password]);
  const config = STRENGTH_CONFIG[score];

  return (
    <div className="password-strength-meter" aria-live="polite">
      <div className="password-strength-bar">
        <div
          className={`password-strength-fill ${config.class}`}
          style={{ width: `${config.percent}%` }}
        />
      </div>
      <span className="password-strength-label">{config.label}</span>
    </div>
  );
};

export default PasswordStrengthMeter;