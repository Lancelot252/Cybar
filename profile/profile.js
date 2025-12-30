document.addEventListener('DOMContentLoaded', () => {
    // [新增] 获取头像相关元素
    const avatarImg = document.getElementById('user-avatar');
    const avatarInput = document.getElementById('avatar-input');

    // 获取用户信息
    fetch('/api/user/current')
        .then(response => response.json())
        .then(user => {
            document.getElementById('username').textContent = user.username;
            // [新增] 如果用户有头像，显示头像；否则显示默认图
            if (user.avatar) {
                avatarImg.src = user.avatar;
            } else {
                avatarImg.src = '/uploads/avatars/test.jpg'; 
            }
            // [新增] 显示签名
            if (user.signature) {
                document.getElementById('signature-input').value = user.signature;
            } else {
                document.getElementById('signature-input').value = '还没有签名哦';
            }
        })
        .catch(error => {
            console.error('Error fetching user info:', error);
            window.location.href = '/auth/login/'; // 如果未登录跳转
        });

    // [新增] 点击图片触发文件选择
    if(avatarImg) {
        avatarImg.addEventListener('click', () => {
            avatarInput.click();
        });
    }

    // [新增] 监听文件选择变化，自动上传
    if(avatarInput) {
        avatarInput.addEventListener('change', () => {
            const file = avatarInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('avatar', file); // 这里的名字 'avatar' 必须和后端 upload.single('avatar') 一致

            // 显示上传中的状态
            avatarImg.style.opacity = '0.5';

            fetch('/api/user/avatar', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                avatarImg.style.opacity = '1';
                if (data.avatarUrl) {
                    // 更新图片 src，加个时间戳防止浏览器缓存旧图片
                    avatarImg.src = data.avatarUrl + '?t=' + new Date().getTime();
                } else {
                    alert('上传失败: ' + (data.message || '未知错误'));
                }
            })
            .catch(error => {
                avatarImg.style.opacity = '1';
                console.error('Error uploading avatar:', error);
                alert('上传出错，请检查网络');
            });
        });
    }

    // 加载用户的点赞和收藏数据
    loadUserInteractions();

    // 标签切换功能
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有标签的active类
            tabs.forEach(t => t.classList.remove('active'));
            // 添加当前标签的active类
            tab.classList.add('active');

            // 隐藏所有内容
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            // 显示当前标签对应的内容
            const contentId = `${tab.dataset.tab}-content`;
            document.getElementById(contentId).classList.add('active');
        });
    });
    
    // [新增] 签名保存功能
    const saveSigBtn = document.getElementById('save-signature-btn');
    const sigInput = document.getElementById('signature-input');
    const sigStatus = document.getElementById('signature-status');

    saveSigBtn.addEventListener('click', () => {
        const newSignature = sigInput.value.trim();
        
        // 简单的前端验证
        if (newSignature.length > 50) {
            sigStatus.textContent = '字数超过限制！';
            sigStatus.style.color = '#ff4444';
            return;
        }

        // 发送给后端
        fetch('/api/user/signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ signature: newSignature })
        })
        .then(response => response.json())
        .then(data => {
            sigStatus.textContent = '保存成功！';
            sigStatus.style.color = '#00f2fe';
            // 2秒后清除提示
            setTimeout(() => { sigStatus.textContent = ''; }, 2000);
        })
        .catch(error => {
            console.error('Error:', error);
            sigStatus.textContent = '保存失败，请重试';
            sigStatus.style.color = '#ff4444';
        });
    });
});

async function loadUserInteractions() {
    try {
        // 加载点赞历史
        const likesResponse = await fetch('/api/user/likes');
        const likesData = await likesResponse.json();
        displayRecipes(likesData, 'likes-list');

        // 加载收藏历史
        const favoritesResponse = await fetch('/api/user/favorites');
        const favoritesData = await favoritesResponse.json();
        displayRecipes(favoritesData, 'favorites-list');

        // 加载创建的配方历史
        const createdRecipesResponse = await fetch('/api/user/created-recipes');
        const createdRecipesData = await createdRecipesResponse.json();
        displayRecipes(createdRecipesData, 'created-recipes-list');

    } catch (error) {
        console.error('Error loading user interactions:', error);
        showError('加载数据时出错，请稍后重试');
    }
}

function displayRecipes(recipes, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 

    if (!Array.isArray(recipes) || recipes.length === 0) {
        container.innerHTML = '<p class="no-data">暂无数据</p>';
        return;
    }

    // 判断是否是“我的创建”列表，如果是，就显示编辑按钮
    const isMyCreations = containerId === 'created-recipes-list';

    recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        
        // [新增] 如果是我的创建，添加编辑和删除按钮
        let actionButtonsHtml = '';
        if (isMyCreations) {
            actionButtonsHtml = `
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <a href="/custom/?id=${recipe.id}" class="edit-btn" 
                       style="flex:1; display:inline-block; padding:6px 12px; background:#444; color:#00f2fe; text-decoration:none; border-radius:4px; font-size:0.85em; text-align:center;">
                       <i class="fas fa-edit"></i> 修改
                    </a>
                    <button class="delete-recipe-btn" data-recipe-id="${recipe.id}" data-recipe-name="${recipe.name}"
                       style="flex:1; padding:6px 12px; background:#dc3545; color:#fff; border:none; border-radius:4px; font-size:0.85em; cursor:pointer;">
                       <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <h4>${recipe.name}</h4>
            <p>创建者: ${recipe.createdBy || '未知用户'}</p>
            <p>预计酒精度: ${recipe.estimatedAbv}%</p>
            <a href="/recipes/detail.html?id=${recipe.id}" class="view-recipe">查看详情</a>
            ${actionButtonsHtml}
        `;
        container.appendChild(card);
    });
    
    // [新增] 为删除按钮添加事件监听
    if (isMyCreations) {
        container.querySelectorAll('.delete-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                const recipeName = e.currentTarget.dataset.recipeName;
                
                if (!confirm(`确定要删除配方"${recipeName}"吗？此操作不可恢复！`)) {
                    return;
                }
                
                try {
                    // 使用 POST 方式删除（适配鸿蒙前端）
                    const response = await fetch(`/api/custom/cocktails/${recipeId}/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert('删除成功！');
                        // 重新加载"我的创建"列表
                        loadUserInteractions();
                    } else {
                        alert('删除失败: ' + (result.message || '未知错误'));
                    }
                } catch (error) {
                    console.error('删除配方时出错:', error);
                    alert('删除失败，请检查网络连接');
                }
            });
        });
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.getElementById('profile-content').prepend(errorDiv);
    
    // 3秒后自动移除错误消息
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}