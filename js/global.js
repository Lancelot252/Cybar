document.addEventListener('DOMContentLoaded', () => {
    const userStatusDiv = document.getElementById('user-status');
    const loginPrompt = document.getElementById('login-prompt'); // Get the login prompt element
    const profileLink = document.querySelector('.profile-link'); // 恢复用户界面入口的引用
    const customLink = document.querySelector('.custom-link'); // 获取自定义鸡尾酒链接

    // Initially hide the prompt
    if (loginPrompt) {
        loginPrompt.style.display = 'none';
    }
    // Profile link is hidden by default via HTML style attribute
    // 默认隐藏自定义鸡尾酒链接
    if (customLink) {
        customLink.style.display = 'none';
    }

    fetch('/api/auth/status')
        .then(response => response.json())
        .then(data => {
            console.log('Auth Status Received:', data);
            if (data.loggedIn) {
                document.body.classList.add('logged-in');
                document.body.classList.remove('logged-out');

                // 恢复登录后显示用户界面入口
                if (profileLink) {
                    profileLink.style.display = 'block'; // 或 'flex' 如果布局需要
                }
                
                // 登录后显示自定义鸡尾酒链接
                if (customLink) {
                    customLink.style.display = 'block';
                }

                // Hide login prompt when logged in
                if (loginPrompt) {
                    loginPrompt.style.display = 'none';
                }

                const userRole = data.role;
                console.log('User Role:', userRole);

                // Only check for 'is-admin' now
                if (userRole === 'admin') {
                    document.body.classList.add('is-admin');
                    console.log('Added class: is-admin');
                } else {
                    document.body.classList.remove('is-admin');
                }
                // Remove 'is-god' check
                document.body.classList.remove('is-god');

                // Update welcome message
                 if (userStatusDiv) {
                    let roleDisplay = '';
                    if (userRole === 'admin') roleDisplay = '(管理员)'; // Only show admin
                    // Remove god display
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
                                    window.location.href = '/auth/login/'; // Redirect after logout
                                } else {
                                    console.error('Logout failed');
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
                document.body.classList.remove('logged-in');
                document.body.classList.remove('is-admin');
                document.body.classList.remove('is-god'); // Ensure removed

                // 恢复未登录时隐藏用户界面入口
                if (profileLink) {
                    profileLink.style.display = 'none';
                }
                
                // 确保未登录时隐藏自定义鸡尾酒链接
                if (customLink) {
                    customLink.style.display = 'none';
                }

                // Show login prompt when logged out
                if (loginPrompt) {
                    loginPrompt.style.display = 'block';
                }

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
            document.body.classList.remove('logged-in');
            document.body.classList.remove('is-admin');
            document.body.classList.remove('is-god'); // Ensure removed

            // 恢复出错时隐藏用户界面入口
            if (profileLink) {
                profileLink.style.display = 'none';
            }
            
            // 确保出错时隐藏自定义鸡尾酒链接
            if (customLink) {
                customLink.style.display = 'none';
            }

            // Show login prompt in case of error (likely logged out)
            if (loginPrompt) {
                loginPrompt.style.display = 'block';
            }

            if (userStatusDiv) {
                userStatusDiv.innerHTML = '<a href="/auth/login/">登录</a> | <a href="/auth/register/">注册</a>'; // Fallback
            }
             document.dispatchEvent(new CustomEvent('authStatusKnown', { detail: { loggedIn: false } }));
        });
});
