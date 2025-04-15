document.addEventListener('DOMContentLoaded', () => {
    const _theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    const themeSelector = document.getElementById('theme_selector');

    const setThemeVars = (theme) => {
        const root = document.documentElement;

        if (theme === 'light') {
            root.style.setProperty('--bg', '#f9f9f9');
            root.style.setProperty('--fg', '#111');
            root.style.setProperty('--border', '#ccc');
        } else if (theme === 'dark') {
            root.style.setProperty('--bg', '#1e1e1e');
            root.style.setProperty('--fg', '#ddd');
            root.style.setProperty('--border', '#333');
        } else return setThemeVars(_theme);

        localStorage.setItem('theme', theme);
    }

    themeSelector.options[0].text = `System Default (${_theme.charAt(0).toUpperCase() + _theme.slice(1)})`;

    const savedTheme = localStorage.getItem('theme') || 'system';
    themeSelector.value = savedTheme;
    setThemeVars(savedTheme);

    themeSelector.addEventListener('change', () => setThemeVars(themeSelector.value));
});