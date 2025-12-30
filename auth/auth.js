document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessageDiv = document.getElementById('login-message'); // Assumed ID for login messages
    const registerMessageDiv = document.getElementById('register-message'); // Assumed ID for register messages

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginMessageDiv) {
                loginMessageDiv.textContent = ''; // Clear previous messages
                loginMessageDiv.style.display = 'none';
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
                    if (loginMessageDiv) {
                        loginMessageDiv.textContent = result.message || '登录失败';
                        loginMessageDiv.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                if (loginMessageDiv) {
                    loginMessageDiv.textContent = '发生错误，请稍后重试';
                    loginMessageDiv.style.display = 'block';
                }
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (registerMessageDiv) {
                registerMessageDiv.textContent = ''; // Clear previous messages
                registerMessageDiv.style.display = 'none';
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
                    if (registerMessageDiv) {
                        registerMessageDiv.textContent = '注册成功！正在跳转到登录页面...';
                        registerMessageDiv.style.color = 'green';
                        registerMessageDiv.style.display = 'block';
                    }
                    setTimeout(() => {
                        window.location.href = '/auth/login/';
                    }, 2000);
                } else {
                    if (registerMessageDiv) {
                        registerMessageDiv.textContent = result.message || '注册失败';
                        registerMessageDiv.style.color = 'red';
                        registerMessageDiv.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                if (registerMessageDiv) {
                    registerMessageDiv.textContent = '发生错误，请稍后重试';
                    registerMessageDiv.style.color = 'red';
                    registerMessageDiv.style.display = 'block';
                }
            }
        });
    }
});
