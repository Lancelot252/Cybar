document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessageDiv = document.getElementById('login-message'); // Assumed ID for login messages
    const registerMessageDiv = document.getElementById('register-message'); // Assumed ID for register messages

    function setFormMessage(element, text, state = 'error') {
        if (!element) return;
        element.textContent = text;
        element.classList.remove('message-error', 'message-success');
        element.classList.add(state === 'success' ? 'message-success' : 'message-error');
        element.hidden = !text;
        element.classList.toggle('hidden', !text);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginMessageDiv) {
                setFormMessage(loginMessageDiv, '');
            }
            const username = loginForm.username.value;
            const password = loginForm.password.value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    setFormMessage(loginMessageDiv, result.message || '登录失败');
                }
            } catch (error) {
                console.error('Login error:', error);
                setFormMessage(loginMessageDiv, '发生错误，请稍后重试');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (registerMessageDiv) {
                setFormMessage(registerMessageDiv, '');
            }
            const username = registerForm.username.value;
            const password = registerForm.password.value;

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const result = await response.json();

                if (response.ok) {
                    setFormMessage(registerMessageDiv, '注册成功！正在跳转到登录页面...', 'success');
                    setTimeout(() => {
                        window.location.href = '/auth/login/';
                    }, 2000);
                } else {
                    setFormMessage(registerMessageDiv, result.message || '注册失败');
                }
            } catch (error) {
                console.error('Registration error:', error);
                setFormMessage(registerMessageDiv, '发生错误，请稍后重试');
            }
        });
    }
});
