(function () {
    const STORAGE_KEY = 'cybar_theme';
    const THEMES = ['neon'];
    const DEFAULT_THEME = 'neon';
    const root = document.documentElement;

    function normalizeTheme(theme) {
        return THEMES.includes(theme) ? theme : DEFAULT_THEME;
    }

    function safeReadThemeRaw() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function safeWriteTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
            return true;
        } catch (error) {
            return false;
        }
    }

    function applyTheme(theme) {
        const normalized = normalizeTheme(theme);
        root.dataset.theme = normalized;
        return normalized;
    }

    function setTheme(theme) {
        const normalized = applyTheme(theme);
        const persisted = safeWriteTheme(normalized);

        document.dispatchEvent(new CustomEvent('cybarThemeChanged', {
            detail: {
                theme: normalized,
                persisted
            }
        }));

        return {
            theme: normalized,
            persisted
        };
    }

    function getTheme() {
        const normalized = normalizeTheme(root.dataset.theme || safeReadThemeRaw());
        if (root.dataset.theme !== normalized) {
            root.dataset.theme = normalized;
        }
        return normalized;
    }

    const initialRaw = safeReadThemeRaw();
    const initialTheme = normalizeTheme(initialRaw);
    applyTheme(initialTheme);
    if (initialRaw !== initialTheme) {
        safeWriteTheme(initialTheme);
    }

    window.CybarTheme = {
        getTheme,
        setTheme,
        listThemes: function listThemes() {
            return THEMES.slice();
        }
    };
})();
