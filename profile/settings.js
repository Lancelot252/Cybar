document.addEventListener('DOMContentLoaded', initSettingsPage);

function initSettingsPage() {
    const optionButtons = Array.from(document.querySelectorAll('[data-theme-option]'));
    const currentThemeEl = document.getElementById('theme-current');
    const feedbackEl = document.getElementById('theme-feedback');

    if (!optionButtons.length || !currentThemeEl || !feedbackEl) {
        return;
    }

    if (!window.CybarTheme || typeof window.CybarTheme.getTheme !== 'function' || typeof window.CybarTheme.setTheme !== 'function') {
        optionButtons.forEach((button) => {
            button.disabled = true;
        });
        feedbackEl.textContent = '主题模块加载失败，当前已使用默认主题。';
        feedbackEl.className = 'theme-feedback is-error';
        currentThemeEl.textContent = '当前主题：霓虹主题（默认）';
        return;
    }

    function themeLabel(theme) {
        return '霓虹主题';
    }

    function renderActive(theme) {
        optionButtons.forEach((button) => {
            const selected = button.dataset.themeOption === theme;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
        currentThemeEl.textContent = `当前主题：${themeLabel(theme)}`;
    }

    renderActive(window.CybarTheme.getTheme());

    optionButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const theme = button.dataset.themeOption;
            const result = window.CybarTheme.setTheme(theme);
            renderActive(result.theme);
        });
    });

    document.addEventListener('cybarThemeChanged', (event) => {
        const detail = event.detail || {};
        const theme = detail.theme || window.CybarTheme.getTheme();
        renderActive(theme);

        if (detail.persisted === false) {
            feedbackEl.textContent = '主题已应用，但本地存储不可用，仅本次会话有效。';
            feedbackEl.className = 'theme-feedback is-warning';
            return;
        }

        feedbackEl.textContent = `已切换为${themeLabel(theme)}`;
        feedbackEl.className = 'theme-feedback';
    });
}
