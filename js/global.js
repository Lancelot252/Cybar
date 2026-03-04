document.addEventListener('DOMContentLoaded', () => {
    const userStatusDiv = document.getElementById('user-status');
    const loginPrompt = document.getElementById('login-prompt');

    function isAuthPage() {
        return window.location.pathname.startsWith('/auth/');
    }

    function setElementVisible(element, visible) {
        if (!element) return;
        element.hidden = !visible;
        element.classList.toggle('hidden', !visible);
    }

    function createMenuIcon(name) {
        const icons = {
            menu: '<path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
            home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
            recipes: '<path d="M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h8M8 17h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
            calculator: '<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 8.5h7M9 12h2M13 12h2M9 15.5h2M13 15.5h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
            custom: '<path d="M6 19 18 7M15 7h3v3M9 19H6v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
            profile: '<circle cx="12" cy="9" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
            admin: '<path d="M12 4 5 7v5c0 4.2 2.4 6.9 7 8 4.6-1.1 7-3.8 7-8V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12.5 11 14l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
        };

        return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
    }

    function setupGlobalHoverMenu() {
        if (isAuthPage()) {
            return null;
        }

        const header = document.querySelector('header');
        if (!header) {
            return null;
        }

        const shell = document.createElement('div');
        shell.className = 'global-menu-shell';
        shell.innerHTML = `
            <button id="global-menu-trigger" class="global-menu-trigger" type="button" aria-label="展开导航菜单" aria-controls="global-hover-menu" aria-expanded="false">
                <span class="trigger-icon" aria-hidden="true">${createMenuIcon('menu')}</span>
            </button>
            <nav id="global-hover-menu" class="global-hover-menu" aria-label="全站导航">
                <div class="global-menu-items">
                    <a href="/" class="global-menu-link">${createMenuIcon('home')}<span>推荐首页</span></a>
                    <a href="/recipes/" class="global-menu-link">${createMenuIcon('recipes')}<span>查看配方</span></a>
                    <a href="/calculator/" class="global-menu-link">${createMenuIcon('calculator')}<span>计算酒精度</span></a>
                    <a href="/custom/" class="global-menu-link menu-link-custom" hidden>${createMenuIcon('custom')}<span>新配方</span></a>
                    <a href="/profile/" class="global-menu-link menu-link-profile" hidden>${createMenuIcon('profile')}<span>用户界面</span></a>
                    <a href="/admin/" class="global-menu-link menu-link-admin" hidden>${createMenuIcon('admin')}<span>后台管理</span></a>
                </div>
            </nav>
        `;

        header.insertAdjacentElement('afterend', shell);
        document.body.classList.add('has-global-menu');

        const trigger = shell.querySelector('#global-menu-trigger');
        const panel = shell.querySelector('#global-hover-menu');
        const customLink = shell.querySelector('.menu-link-custom');
        const profileLink = shell.querySelector('.menu-link-profile');
        const adminLink = shell.querySelector('.menu-link-admin');

        const hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
        let closeTimer = null;

        function syncHeaderHeight() {
            const h = Math.ceil(header.getBoundingClientRect().height);
            document.documentElement.style.setProperty('--global-header-height', `${h}px`);
        }

        function openMenu() {
            shell.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            trigger.setAttribute('aria-label', '收起导航菜单');
            panel.setAttribute('aria-hidden', 'false');
        }

        function closeMenu() {
            shell.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-label', '展开导航菜单');
            panel.setAttribute('aria-hidden', 'true');
        }

        function delayedClose() {
            if (closeTimer) {
                clearTimeout(closeTimer);
            }
            closeTimer = setTimeout(() => {
                closeMenu();
            }, 160);
        }

        trigger.addEventListener('click', () => {
            if (shell.classList.contains('is-open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                trigger.click();
            }
        });

        shell.addEventListener('pointerenter', () => {
            if (!hoverMedia.matches) return;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            openMenu();
        });

        shell.addEventListener('pointerleave', () => {
            if (!hoverMedia.matches) return;
            delayedClose();
        });

        document.addEventListener('click', (event) => {
            if (!shell.classList.contains('is-open')) return;
            if (shell.contains(event.target)) return;
            closeMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && shell.classList.contains('is-open')) {
                closeMenu();
            }
        });

        panel.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });

        syncHeaderHeight();
        window.addEventListener('resize', syncHeaderHeight);

        return { customLink, profileLink, adminLink };
    }

    const menuRefs = setupGlobalHoverMenu();
    const profileLink = menuRefs ? menuRefs.profileLink : document.querySelector('.profile-link');
    const customLink = menuRefs ? menuRefs.customLink : document.querySelector('.custom-link');
    const adminLink = menuRefs ? menuRefs.adminLink : document.querySelector('.admin-link');

    setElementVisible(loginPrompt, false);
    setElementVisible(customLink, false);
    setElementVisible(profileLink, false);
    setElementVisible(adminLink, false);

    fetch('/api/auth/status')
        .then(response => response.json())
        .then(data => {
            if (data.loggedIn) {
                document.body.classList.add('logged-in');
                document.body.classList.remove('logged-out');

                setElementVisible(profileLink, true);
                setElementVisible(customLink, true);
                setElementVisible(loginPrompt, false);

                const userRole = data.role;
                if (userRole === 'admin') {
                    document.body.classList.add('is-admin');
                    setElementVisible(adminLink, true);
                } else {
                    document.body.classList.remove('is-admin');
                    setElementVisible(adminLink, false);
                }
                document.body.classList.remove('is-god');

                if (userStatusDiv) {
                    let roleDisplay = '';
                    if (userRole === 'admin') roleDisplay = '(管理员)';

                    userStatusDiv.innerHTML = `
                        <span>欢迎, ${data.username} ${roleDisplay}</span> |
                        <a href="#" id="logout-link">注销</a>
                    `;

                    const logoutLink = document.getElementById('logout-link');
                    if (logoutLink) {
                        logoutLink.addEventListener('click', async (e) => {
                            e.preventDefault();
                            try {
                                const response = await fetch('/api/logout', { method: 'POST' });
                                if (response.ok) {
                                    window.location.href = '/auth/login/';
                                } else {
                                    alert('注销失败，请稍后重试。');
                                }
                            } catch (error) {
                                console.error('Error during logout:', error);
                                alert('注销时发生错误。');
                            }
                        });
                    }
                }
            } else {
                document.body.classList.add('logged-out');
                document.body.classList.remove('logged-in', 'is-admin', 'is-god');

                setElementVisible(profileLink, false);
                setElementVisible(customLink, false);
                setElementVisible(adminLink, false);
                setElementVisible(loginPrompt, true);

                if (userStatusDiv) {
                    userStatusDiv.innerHTML = `
                        <a href="/auth/login/">登录</a> |
                        <a href="/auth/register/">注册</a>
                    `;
                }
            }

            document.dispatchEvent(new CustomEvent('authStatusKnown', { detail: data }));
        })
        .catch(error => {
            console.error('Error fetching auth status:', error);

            document.body.classList.add('logged-out');
            document.body.classList.remove('logged-in', 'is-admin', 'is-god');

            setElementVisible(profileLink, false);
            setElementVisible(customLink, false);
            setElementVisible(adminLink, false);
            setElementVisible(loginPrompt, true);

            if (userStatusDiv) {
                userStatusDiv.innerHTML = '<a href="/auth/login/">登录</a> | <a href="/auth/register/">注册</a>';
            }

            document.dispatchEvent(new CustomEvent('authStatusKnown', { detail: { loggedIn: false } }));
        });
});
