try {
  const theme = localStorage.getItem('ce-theme');
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme);
  }
} catch (_) {
  // Storage indisponível: mantém o tema padrão sem interromper a página.
}
