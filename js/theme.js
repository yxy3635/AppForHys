const THEME_KEY = 'app-theme';

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// Initialize theme on script load
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Default to light theme if not set
    applyTheme('light');
  }
});