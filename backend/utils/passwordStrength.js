const COMMON_WEAK_PATTERNS = [
  'password',
  '123456',
  'qwerty',
  'admin',
  'letmein',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
];

const scorePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { score: 0, label: 'empty', suggestions: ['Password is required'] };
  }

  const suggestions = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Mix uppercase and lowercase letters');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add at least one number');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add at least one symbol');
  }

  const lower = password.toLowerCase();
  if (COMMON_WEAK_PATTERNS.some((p) => lower.includes(p))) {
    score = Math.max(0, score - 2);
    suggestions.push('Avoid common words like "password", "123456", "qwerty"');
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid repeated characters (e.g. aaa, 111)');
  }

  const labels = ['very-weak', 'weak', 'fair', 'good', 'strong', 'very-strong'];
  const label = labels[Math.min(score, 5)];

  return { score, label, suggestions };
};

export { scorePassword };