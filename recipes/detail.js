document.addEventListener('DOMContentLoaded', () => {
    const recipeDetailContainer = document.getElementById('recipe-detail'); 
    const errorMessageElement = document.getElementById('error-message'); 
    const interactionButtons = document.getElementById('interaction-buttons');
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');

    // --- Get recipe ID from URL query parameter ---
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id'); 

    if (!recipeId) {
        console.error('Recipe ID not found in URL');
        if (errorMessageElement) errorMessageElement.textContent = '错误：未在 URL 中指定配方 ID。';
        return;
    }

    // --- Fetch recipe detail using the ID ---
    fetch(`/api/recipes/${recipeId}`) 
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(recipe => {
            displayRecipeDetail(recipe);
            loadInteractionData(recipeId);
        })
        .catch(error => {
            console.error('获取配方详情时出错:', error.message);
            if (errorMessageElement) errorMessageElement.textContent = `获取配方详情时出错: ${error.message.includes('404') ? '未找到配方' : '服务器错误或网络问题'}`;
        });

    // --- Fetch and display comments ---
    if (recipeId) {
        loadComments(recipeId);
        setupCommentForm(recipeId);
    }

    // --- Add event listener for deleting comments ---
    const commentsListContainer = document.getElementById('comments-list');
    if (commentsListContainer) {
        commentsListContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-comment-btn')) {
                const commentId = event.target.dataset.commentId;
                if (commentId && confirm('确定要删除这条评论吗？')) {
                    deleteComment(commentId, event.target); 
                }
            }
        });
    }

    // --- Setup buttons ---
    if (likeButton) {
        likeButton.addEventListener('click', () => toggleLike(recipeId));
    }
    if (favoriteButton) {
        favoriteButton.addEventListener('click', () => toggleFavorite(recipeId));
    }
    if (interactionButtons) {
        interactionButtons.style.display = 'none';
    }
});

function displayRecipeDetail(recipe) {
    const container = document.getElementById('recipe-detail');
    if (!container) return;

    // 清除加载消息和现有内容
    container.innerHTML = '';

    // 创建新的内容容器
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('recipe-content');

    // 1. 设置标题
    const title = document.createElement('h2');
    title.textContent = recipe.name;
    contentContainer.appendChild(title);
    // [新增] 显示描述 (漏掉的就是这一段！)
    if (recipe.description) {
        const descElement = document.createElement('p');
        // 设置一点样式让它好看些
        descElement.style.cssText = 'color: #b0cfff; font-style: italic; margin-bottom: 20px; text-align: center; font-size: 1.1em; max-width: 800px; margin-left: auto; margin-right: auto;';
        descElement.textContent = recipe.description;
        contentContainer.appendChild(descElement);
    }

    // ================= START 核心修改部分 =================
    // 2. 显示配方图片（含默认图逻辑）
    // 去掉了外层的 if (recipe.image)，确保默认图也能显示
    const imageContainer = document.createElement('div');
    imageContainer.style.textAlign = 'center';
    imageContainer.style.marginBottom = '20px';

    const image = document.createElement('img');
    
    // 👇 逻辑：有图用图，没图用默认 jiu.jpg
    // 请确保您的 uploads/cocktails/ 文件夹里确实放了一张 jiu.jpg
    image.src = recipe.image ? recipe.image : '/uploads/cocktails/jiu.jpg';
    
    image.alt = recipe.name;
    // 样式美化
    image.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 15px; object-fit: cover; box-shadow: 0 8px 20px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);';
    
    // 点击查看大图
    image.style.cursor = 'zoom-in';
    image.onclick = () => window.open(image.src, '_blank');

    imageContainer.appendChild(image);
    contentContainer.appendChild(imageContainer);
    // ================= END 核心修改部分 ===================

    // 3. 创建社交互动栏
    const socialBar = document.createElement('div');
    socialBar.classList.add('social-interaction-bar');
    socialBar.style.cssText = 'display: flex; gap: 20px; align-items: center; margin: 15px 0; padding: 10px; border-bottom: 1px solid #eee;';

    const likeWrapper = document.createElement('div');
    likeWrapper.classList.add('interaction-wrapper');
    likeWrapper.innerHTML = `
        <button id="like-button" class="interaction-btn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <i class="far fa-heart" style="transition: color 0.3s ease"></i>
            <span id="like-count">${recipe.likeCount !== undefined ? recipe.likeCount : 0}</span>
        </button>
    `;

    const favoriteWrapper = document.createElement('div');
    favoriteWrapper.classList.add('interaction-wrapper');
    favoriteWrapper.innerHTML = `
        <button id="favorite-button" class="interaction-btn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <i class="far fa-bookmark" style="transition: color 0.3s ease"></i>
            <span id="favorite-count">${recipe.favoriteCount !== undefined ? recipe.favoriteCount : 0}</span>
        </button>
    `;

    socialBar.appendChild(likeWrapper);
    socialBar.appendChild(favoriteWrapper);
    contentContainer.appendChild(socialBar);

    // 添加创建者信息
    const creatorInfo = document.createElement('p');
    creatorInfo.classList.add('recipe-creator-detail');
    
    // 添加头像
    const avatarImg = document.createElement('img');
    avatarImg.src = recipe.creatorAvatar || '/uploads/avatars/default-avatar.png';
    avatarImg.alt = '头像';
    avatarImg.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; vertical-align: middle; margin-right: 10px; object-fit: cover; border: 2px solid #00e5ff;';
    
    creatorInfo.appendChild(avatarImg);
    const creatorText = document.createElement('span');
    creatorText.innerHTML = `<strong>创建者:</strong> ${recipe.createdBy || '未知用户'}`;
    creatorInfo.appendChild(creatorText);
    contentContainer.appendChild(creatorInfo);

    // 添加描述信息（在创建者下方、配料上方）
    if (recipe.description) {
        const descElement = document.createElement('p');
        descElement.classList.add('recipe-description');
        descElement.style.cssText = 'color: #b0cfff; margin: 15px 0; padding: 10px; background: rgba(0, 229, 255, 0.1); border-radius: 8px; border-left: 3px solid #00e5ff;';
        descElement.innerHTML = `<strong>description:</strong> ${recipe.description}`;
        contentContainer.appendChild(descElement);
    }

    // 添加配料标题和列表
    const ingredientsTitle = document.createElement('h3');
    ingredientsTitle.textContent = '配料:';
    contentContainer.appendChild(ingredientsTitle);

    const ingredientsList = document.createElement('ul');
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach(ing => {
            const li = document.createElement('li');
            li.textContent = `${ing.name}: ${ing.volume}ml (ABV: ${ing.abv}%)`;
            ingredientsList.appendChild(li);
        });
    }
    contentContainer.appendChild(ingredientsList);

    // 添加制作方法
    const instructionsTitle = document.createElement('h3');
    instructionsTitle.textContent = '制作方法:';
    contentContainer.appendChild(instructionsTitle);

    const instructions = document.createElement('p');
    instructions.textContent = recipe.instructions;
    contentContainer.appendChild(instructions);

    // 添加预计酒精度
    const abv = document.createElement('p');
    abv.innerHTML = `<strong>预计酒精度:</strong> ${recipe.estimatedAbv}%`;
    contentContainer.appendChild(abv);    

    // 添加内容到主容器
    container.appendChild(contentContainer);

    // 重新绑定事件监听器
    setupInteractionListeners(recipe.id);

    // 启动AI口味分析
    if (window.startAITasteAnalysis) {
        startAITasteAnalysis(recipe);
    }
}

// --- Interaction Listeners ---
function setupInteractionListeners(recipeId) {
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');

    if (likeButton) {
        likeButton.addEventListener('click', async () => {
            if (!document.body.classList.contains('logged-in')) {
                alert('请登录后再点赞');
                return;
            }
            try {
                const response = await fetch(`/api/recipes/${recipeId}/like`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling like:', error);
            }
        });
    }

    if (favoriteButton) {
        favoriteButton.addEventListener('click', async () => {
            if (!document.body.classList.contains('logged-in')) {
                alert('请登录后再收藏');
                return;
            }
            try {
                const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        });
    }
}

function updateInteractionUI(data) {
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');
    const likeCountSpan = document.getElementById('like-count');
    const favoriteCountSpan = document.getElementById('favorite-count');

    if (!likeButton || !favoriteButton) return;

    if (typeof data.likeCount !== 'undefined') likeCountSpan.textContent = data.likeCount;
    if (typeof data.favoriteCount !== 'undefined') favoriteCountSpan.textContent = data.favoriteCount;

    if (typeof data.isLiked !== 'undefined') {
        const icon = likeButton.querySelector('i');
        if (data.isLiked) {
            icon.className = 'fas fa-heart';
            icon.style.color = '#ff4757';
        } else {
            icon.className = 'far fa-heart';
            icon.style.color = '#6c757d';
        }
    }

    if (typeof data.isFavorited !== 'undefined') {
        const icon = favoriteButton.querySelector('i');
        if (data.isFavorited) {
            icon.className = 'fas fa-bookmark';
            icon.style.color = '#ffa502';
        } else {
            icon.className = 'far fa-bookmark';
            icon.style.color = '#6c757d';
        }
    }
}

// --- Comments Logic ---
async function loadComments(recipeId) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = '<p>正在加载评论...</p>';

    try {
        const response = await fetch(`/api/recipes/${recipeId}/comments`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('获取评论出错:', error);
        commentsListContainer.innerHTML = '<p style="color: red;">无法加载评论。</p>';
    }
}

function renderComments(comments) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = ''; 

    if (!comments || comments.length === 0) {
        commentsListContainer.innerHTML = '<p>暂无评论。</p>';
        return;
    }

    const isAdmin = document.body.classList.contains('is-admin'); 
    comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    comments.forEach(comment => {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('comment');
        commentDiv.dataset.commentId = comment.id;

        const deleteButtonHTML = isAdmin
            ? `<button class="delete-comment-btn" data-comment-id="${comment.id}" title="删除评论">×</button>`
            : '';

        commentDiv.innerHTML = `
            <div class="comment-header">
                <p class="comment-meta">
                    <strong>${comment.username || '匿名用户'}</strong>
                    <span> - ${new Date(comment.timestamp).toLocaleString('zh-CN')}</span>
                </p>
                ${deleteButtonHTML}
            </div>
            <p class="comment-text">${escapeHTML(comment.text)}</p>
        `;
        commentsListContainer.appendChild(commentDiv);
    });
}

function setupCommentForm(recipeId) {
    const commentForm = document.getElementById('comment-form');
    const commentText = document.getElementById('comment-text');
    const commentError = document.getElementById('comment-error');
    const loginPrompt = document.getElementById('login-prompt');

    if (document.body.classList.contains('logged-out')) {
        if (commentForm) commentForm.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
        return; 
    } else {
        if (commentForm) commentForm.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
    }

    if (commentForm && commentText) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (commentError) commentError.style.display = 'none';

            const commentContent = commentText.value.trim();
            if (!commentContent) {
                if (commentError) {
                    commentError.textContent = '评论内容不能为空。';
                    commentError.style.display = 'block';
                }
                return;
            }

            try {
                const response = await fetch(`/api/recipes/${recipeId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commentText: commentContent }),
                });

                if (response.ok) {
                    const newComment = await response.json();
                    commentText.value = ''; 
                    addCommentToDOM(newComment);
                } else {
                     let errorData = { message: `提交失败` };
                     try { errorData = await response.json(); } catch(err) {}
                     if (commentError) {
                         commentError.textContent = errorData.message;
                         commentError.style.display = 'block';
                     }
                }
            } catch (error) {
                console.error('提交评论出错:', error);
            }
        });
    }
}

function addCommentToDOM(comment) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;

    const noCommentsMsg = commentsListContainer.querySelector('p');
    if (noCommentsMsg && noCommentsMsg.textContent === '暂无评论。') {
        commentsListContainer.innerHTML = '';
    }

    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    commentDiv.innerHTML = `
        <div class="comment-header">
            <p class="comment-meta">
                <strong>${comment.username || '匿名用户'}</strong>
                <span> - ${new Date(comment.timestamp).toLocaleString('zh-CN')}</span>
            </p>
        </div>
        <p class="comment-text">${escapeHTML(comment.text)}</p>
    `;
    commentsListContainer.insertBefore(commentDiv, commentsListContainer.firstChild);
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

async function deleteComment(commentId, buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = '...';

    try {
        const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        if (response.ok) {
            const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (commentElement) commentElement.remove();
            
            const commentsListContainer = document.getElementById('comments-list');
            if (commentsListContainer && !commentsListContainer.hasChildNodes()) {
                commentsListContainer.innerHTML = '<p>暂无评论。</p>';
            }
            alert('评论删除成功！');
        } else {
            alert('删除失败');
            buttonElement.disabled = false;
            buttonElement.textContent = '×';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('网络错误');
        buttonElement.disabled = false;
    }
}

async function loadInteractionData(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}/interactions`);
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        
        updateInteractionUI(data);
        document.getElementById('interaction-buttons').style.display = 'block';

        if (!document.body.classList.contains('logged-in')) {
            const likeButton = document.getElementById('like-button');
            const favoriteButton = document.getElementById('favorite-button');
            if (likeButton) likeButton.disabled = true;
            if (favoriteButton) favoriteButton.disabled = true;
        }
    } catch (error) {
        console.error('Error loading interaction data:', error);
    }
}

// --- AI口味分析相关函数 ---

// 启动AI口味分析
async function startAITasteAnalysis(recipe) {
    // 保存当前配方到全局变量供其他函数使用
    window.currentRecipe = recipe;

    const analysisSection = document.getElementById('ai-taste-analysis');
    const loadingElement = document.getElementById('ai-analysis-loading');
    const contentElement = document.getElementById('ai-analysis-content');
    const errorElement = document.getElementById('ai-analysis-error');
    const metaElement = document.getElementById('ai-analysis-meta');

    // 显示分析区域
    analysisSection.style.display = 'block';

    // 显示加载状态
    loadingElement.style.display = 'flex';
    contentElement.style.display = 'none';
    errorElement.style.display = 'none';
    metaElement.style.display = 'none';

    try {
        // 准备发送给AI分析API的数据
        const analysisData = {
            name: recipe.name,
            description: `由 ${recipe.createdBy} 创建的鸡尾酒配方`,
            ingredients: recipe.ingredients || [],
            steps: recipe.instructions ? [recipe.instructions] : []
        };

        // 调用AI分析API
        const response = await fetch('/api/custom/analyze-flavor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(analysisData)
        });

        const result = await response.json();

        // 隐藏加载状态
        loadingElement.style.display = 'none'; if (response.ok && result.success) {
            // 显示分析结果
            displayAIAnalysisResult(result.analysis, result.analyzedAt);
        } else {
            // 显示错误信息
            showAIAnalysisError(result.message || 'AI分析失败，请稍后重试');
        }

    } catch (error) {
        console.error('AI口味分析请求失败:', error);
        loadingElement.style.display = 'none';
        showAIAnalysisError('网络连接异常，AI分析暂时不可用');
    }
}

// 显示AI分析结果
function displayAIAnalysisResult(analysis, analyzedAt) {
    const contentElement = document.getElementById('ai-analysis-content');
    const metaElement = document.getElementById('ai-analysis-meta');

    // 处理分析文本，将其格式化为HTML
    const formattedAnalysis = formatAnalysisText(analysis);
    contentElement.innerHTML = formattedAnalysis;
    contentElement.style.display = 'block';

    // 显示分析时间
    if (analyzedAt) {
        const analysisTime = new Date(analyzedAt).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        metaElement.innerHTML = `<i class="fas fa-clock"></i> 分析时间: ${analysisTime}`;
        metaElement.style.display = 'block';
    }    // 尝试从AI分析中提取口味数据
    const tasteData = extractTasteDataFromAnalysis(analysis);
    if (tasteData) {
        displayTasteVisualization(tasteData);
    } else {
        // 如果无法提取，使用默认值
        const defaultTasteData = generateDefaultTasteData(window.currentRecipe || {});
        displayTasteVisualization(defaultTasteData);
    }

    // 显示结果容器
    const resultsElement = document.getElementById('ai-analysis-results');
    resultsElement.style.display = 'block';
}

// 从AI分析文本中提取口味数据
function extractTasteDataFromAnalysis(analysis) {
    try {
        // 更精确的口味数据提取正则表达式，优先匹配标准化格式
        const standardPatterns = {
            sweetness: /甜度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            sourness: /酸度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            bitterness: /苦度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            strength: /烈度[：:\s]*([0-5])(?:[\/\s]*5)?/gi,
            freshness: /清爽度[：:\s]*([0-5])(?:[\/\s]*5)?/gi
        };

        // 备用正则表达式（兼容旧格式）
        const fallbackPatterns = {
            sweetness: /甜味[：:\s]*([0-5])|偏?甜[：:\s]*([0-5])|糖分[：:\s]*([0-5])/gi,
            sourness: /酸味[：:\s]*([0-5])|偏?酸[：:\s]*([0-5])|酸爽[：:\s]*([0-5])/gi,
            bitterness: /苦味[：:\s]*([0-5])|偏?苦[：:\s]*([0-5])|苦涩[：:\s]*([0-5])/gi,
            strength: /酒精感[：:\s]*([0-5])|烈性[：:\s]*([0-5])|酒精度感受[：:\s]*([0-5])|强度[：:\s]*([0-5])/gi,
            freshness: /清新[：:\s]*([0-5])|爽口[：:\s]*([0-5])|清香[：:\s]*([0-5])/gi
        };

        // 描述性文本映射
        const descriptiveMapping = {
            sweetness: {
                '极甜': 5, '很甜': 4, '较甜': 3, '微甜': 2, '不甜': 1, '无甜味': 0,
                '甜腻': 5, '甜美': 4, '香甜': 3, '淡甜': 2
            },
            sourness: {
                '极酸': 5, '很酸': 4, '较酸': 3, '微酸': 2, '不酸': 1, '无酸味': 0,
                '酸爽': 4, '清酸': 3, '淡酸': 2
            },
            bitterness: {
                '极苦': 5, '很苦': 4, '较苦': 3, '微苦': 2, '不苦': 1, '无苦味': 0,
                '苦涩': 4, '略苦': 2
            },
            strength: {
                '极烈': 5, '很烈': 4, '较烈': 3, '微烈': 2, '不烈': 1, '温和': 1,
                '强烈': 4, '适中': 3, '轻度': 2, '柔和': 1
            },
            freshness: {
                '极清爽': 5, '很清爽': 4, '较清爽': 3, '微清爽': 2, '不清爽': 1,
                '清新': 4, '爽口': 4, '清香': 3, '淡雅': 2
            }
        };

        const tasteData = {
            sweetness: null,
            sourness: null,
            bitterness: null,
            strength: null,
            freshness: null
        };

        // 首先尝试提取标准化格式的数值
        for (const [dimension, pattern] of Object.entries(standardPatterns)) {
            let match;
            while ((match = pattern.exec(analysis)) !== null) {
                for (let i = 1; i < match.length; i++) {
                    if (match[i] !== undefined) {
                        const value = parseInt(match[i]);
                        if (!isNaN(value) && value >= 0 && value <= 5) {
                            tasteData[dimension] = value;
                            break;
                        }
                    }
                }
                if (tasteData[dimension] !== null) break;
            }
        }

        // 如果标准格式没找到，尝试备用格式
        for (const [dimension, pattern] of Object.entries(fallbackPatterns)) {
            if (tasteData[dimension] === null) {
                let match;
                while ((match = pattern.exec(analysis)) !== null) {
                    for (let i = 1; i < match.length; i++) {
                        if (match[i] !== undefined) {
                            const value = parseInt(match[i]);
                            if (!isNaN(value) && value >= 0 && value <= 5) {
                                tasteData[dimension] = value;
                                break;
                            }
                        }
                    }
                    if (tasteData[dimension] !== null) break;
                }
            }
        }

        // 最后尝试描述性文本匹配
        for (const [dimension, mapping] of Object.entries(descriptiveMapping)) {
            if (tasteData[dimension] === null) {
                for (const [desc, value] of Object.entries(mapping)) {
                    if (analysis.includes(desc)) {
                        tasteData[dimension] = value;
                        break;
                    }
                }
            }
        }

        // 如果提取到了至少一个有效值，返回数据
        const validValues = Object.values(tasteData).filter(v => v !== null);
        if (validValues.length > 0) {
            // 对于没有提取到的维度，使用默认值
            return {
                sweetness: tasteData.sweetness ?? 2,
                sourness: tasteData.sourness ?? 2,
                bitterness: tasteData.bitterness ?? 2,
                strength: tasteData.strength ?? 3,
                freshness: tasteData.freshness ?? 3
            };
        }

        return null;
    } catch (error) {
        console.warn('无法从AI分析中提取口味数据:', error);
        return null;
    }
}

// 根据配方生成默认口味数据
function generateDefaultTasteData(recipe) {
    // 初始化基础值
    let sweetness = 0, sourness = 0, bitterness = 0, strength = 0, freshness = 0;
    let totalVolume = 0;
    let alcoholContent = 0;

    // 原料口味特征数据库
    const ingredientProfiles = {
        // 烈酒类
        '伏特加': { sweetness: 0, sourness: 0, bitterness: 0, strength: 4, freshness: 2 },
        '金酒': { sweetness: 0, sourness: 0, bitterness: 1, strength: 4, freshness: 3 },
        '威士忌': { sweetness: 1, sourness: 0, bitterness: 2, strength: 5, freshness: 1 },
        '白兰地': { sweetness: 2, sourness: 0, bitterness: 1, strength: 4, freshness: 1 },
        '朗姆酒': { sweetness: 3, sourness: 0, bitterness: 0, strength: 4, freshness: 2 },
        '龙舌兰': { sweetness: 1, sourness: 0, bitterness: 1, strength: 4, freshness: 2 },

        // 利口酒类
        '君度': { sweetness: 4, sourness: 1, bitterness: 0, strength: 3, freshness: 3 },
        '橙皮酒': { sweetness: 4, sourness: 2, bitterness: 1, strength: 3, freshness: 3 },
        '咖啡利口酒': { sweetness: 4, sourness: 0, bitterness: 3, strength: 2, freshness: 0 },
        '薄荷利口酒': { sweetness: 3, sourness: 0, bitterness: 0, strength: 2, freshness: 5 },

        // 果汁类
        '柠檬汁': { sweetness: 1, sourness: 5, bitterness: 0, strength: 0, freshness: 4 },
        '青柠汁': { sweetness: 0, sourness: 5, bitterness: 1, strength: 0, freshness: 5 },
        '橙汁': { sweetness: 4, sourness: 2, bitterness: 0, strength: 0, freshness: 3 },
        '蔓越莓汁': { sweetness: 3, sourness: 3, bitterness: 1, strength: 0, freshness: 3 },
        '菠萝汁': { sweetness: 5, sourness: 1, bitterness: 0, strength: 0, freshness: 3 },
        '番茄汁': { sweetness: 2, sourness: 2, bitterness: 0, strength: 0, freshness: 2 },

        // 糖浆类
        '简单糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 0 },
        '蜂蜜糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },
        '薄荷糖浆': { sweetness: 4, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '香草糖浆': { sweetness: 5, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },

        // 汽水类
        '苏打水': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '汤力水': { sweetness: 2, sourness: 0, bitterness: 2, strength: 0, freshness: 4 },
        '姜汁汽水': { sweetness: 3, sourness: 0, bitterness: 1, strength: 0, freshness: 4 },
        '可乐': { sweetness: 4, sourness: 0, bitterness: 0, strength: 0, freshness: 2 },

        // 苦精类
        '安格斯图拉苦精': { sweetness: 0, sourness: 0, bitterness: 5, strength: 1, freshness: 0 },
        '橙子苦精': { sweetness: 1, sourness: 1, bitterness: 4, strength: 1, freshness: 2 },

        // 其他
        '柠檬皮': { sweetness: 0, sourness: 2, bitterness: 1, strength: 0, freshness: 4 },
        '橙皮': { sweetness: 1, sourness: 1, bitterness: 1, strength: 0, freshness: 3 },
        '薄荷叶': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 5 },
        '盐': { sweetness: 0, sourness: 0, bitterness: 0, strength: 0, freshness: 1 },
        '黑胡椒': { sweetness: 0, sourness: 0, bitterness: 2, strength: 0, freshness: 0 }
    };

    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach(ing => {
            const name = ing.name;
            const volume = parseFloat(ing.volume) || 0;
            const abv = parseFloat(ing.abv) || 0;

            totalVolume += volume;
            alcoholContent += volume * (abv / 100);

            // 查找精确匹配的原料配置
            let profile = ingredientProfiles[name];

            // 如果没有精确匹配，尝试模糊匹配
            if (!profile) {
                const lowerName = name.toLowerCase();
                for (const [key, value] of Object.entries(ingredientProfiles)) {
                    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
                        profile = value;
                        break;
                    }
                }
            }

            // 如果还是没有匹配，根据名称特征推断
            if (!profile) {
                profile = { sweetness: 1, sourness: 1, bitterness: 1, strength: 1, freshness: 1 };

                const lowerName = name.toLowerCase();
                if (lowerName.includes('糖') || lowerName.includes('蜜') || lowerName.includes('甜')) {
                    profile.sweetness = 4;
                }
                if (lowerName.includes('柠檬') || lowerName.includes('酸') || lowerName.includes('醋')) {
                    profile.sourness = 4;
                }
                if (lowerName.includes('苦') || lowerName.includes('咖啡') || lowerName.includes('茶')) {
                    profile.bitterness = 3;
                }
                if (abv > 20) {
                    profile.strength = Math.min(5, Math.floor(abv / 10));
                }
                if (lowerName.includes('薄荷') || lowerName.includes('苏打') || lowerName.includes('汽水')) {
                    profile.freshness = 4;
                }
            }

            // 按体积比例加权
            const weight = volume / Math.max(totalVolume, 1);
            sweetness += profile.sweetness * weight;
            sourness += profile.sourness * weight;
            bitterness += profile.bitterness * weight;
            strength += profile.strength * weight;
            freshness += profile.freshness * weight;
        });

        // 根据总酒精含量调整烈度
        if (totalVolume > 0) {
            const finalAbv = (alcoholContent / totalVolume) * 100;
            strength = Math.max(strength, finalAbv / 10);
        }

        // 如果配方有预估酒精度，以此为准调整烈度
        if (recipe.estimatedAbv && !isNaN(parseFloat(recipe.estimatedAbv))) {
            const estimatedAbv = parseFloat(recipe.estimatedAbv);
            strength = Math.max(strength, estimatedAbv / 10);
        }
    }

    return {
        sweetness: Math.min(5, Math.max(0, Math.round(sweetness * 10) / 10)),
        sourness: Math.min(5, Math.max(0, Math.round(sourness * 10) / 10)),
        bitterness: Math.min(5, Math.max(0, Math.round(bitterness * 10) / 10)),
        strength: Math.min(5, Math.max(0, Math.round(strength * 10) / 10)),
        freshness: Math.min(5, Math.max(0, Math.round(freshness * 10) / 10))
    };
}

// 显示口味可视化
function displayTasteVisualization(tasteData) {
    // 更新口味条形图
    updateTasteBars(tasteData);

    // 更新雷达图
    updateRadarChart(tasteData);
}

// 更新口味条形图
function updateTasteBars(tasteData) {
    const tasteDimensions = ['sweetness', 'sourness', 'bitterness', 'strength', 'freshness'];

    tasteDimensions.forEach((dimension, index) => {
        const value = tasteData[dimension] || 0;
        const percentage = (value / 5) * 100;

        // 更新数值显示
        const valueElement = document.getElementById(`${dimension}-value`);
        if (valueElement) {
            // 显示小数点后一位
            const displayValue = value % 1 === 0 ? value.toString() : value.toFixed(1);
            valueElement.textContent = `${displayValue}/5`;
        }

        // 更新进度条
        const fillElement = document.getElementById(`${dimension}-fill`);
        if (fillElement) {
            // 添加动画延迟，让每个条形图依次显示
            setTimeout(() => {
                fillElement.style.width = `${percentage}%`;

                // 根据数值添加动态颜色效果
                if (value >= 4) {
                    fillElement.style.boxShadow = `0 0 10px ${fillElement.style.background.split(',')[0].split('(')[1]}`;
                }
            }, 500 + (index * 100));
        }
    });
}

// 更新雷达图
function updateRadarChart(tasteData) {
    const canvas = document.getElementById('taste-radar');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 口味维度
    const dimensions = [
        { name: '甜度', value: tasteData.sweetness, angle: 0, color: '#ff6b9d' },
        { name: '酸度', value: tasteData.sourness, angle: Math.PI * 2 / 5, color: '#ffd93d' },
        { name: '苦度', value: tasteData.bitterness, angle: Math.PI * 4 / 5, color: '#6bcf7f' },
        { name: '烈度', value: tasteData.strength, angle: Math.PI * 6 / 5, color: '#ff9f43' },
        { name: '清爽度', value: tasteData.freshness, angle: Math.PI * 8 / 5, color: '#4bcffa' }
    ];

    // 绘制背景网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        const gridRadius = (radius / 5) * i;

        dimensions.forEach((dim, index) => {
            const x = centerX + gridRadius * Math.cos(dim.angle - Math.PI / 2);
            const y = centerY + gridRadius * Math.sin(dim.angle - Math.PI / 2);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.closePath();
        ctx.stroke();
    }

    // 绘制轴线
    dimensions.forEach(dim => {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        const endX = centerX + radius * Math.cos(dim.angle - Math.PI / 2);
        const endY = centerY + radius * Math.sin(dim.angle - Math.PI / 2);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    });

    // 绘制数据多边形
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.lineWidth = 2;

    dimensions.forEach((dim, index) => {
        const dataRadius = (radius / 5) * dim.value;
        const x = centerX + dataRadius * Math.cos(dim.angle - Math.PI / 2);
        const y = centerY + dataRadius * Math.sin(dim.angle - Math.PI / 2);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制数据点
    dimensions.forEach(dim => {
        const dataRadius = (radius / 5) * dim.value;
        const x = centerX + dataRadius * Math.cos(dim.angle - Math.PI / 2);
        const y = centerY + dataRadius * Math.sin(dim.angle - Math.PI / 2);

        ctx.beginPath();
        ctx.fillStyle = dim.color;
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 添加发光效果
        ctx.shadowColor = dim.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// 添加CSS动画样式
function addAnimationStyles() {
    if (document.getElementById('taste-animation-styles')) return;

    const style = document.createElement('style');
    style.id = 'taste-animation-styles';
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33% { transform: translateY(-10px) rotate(1deg); }
            66% { transform: translateY(5px) rotate(-1deg); }
        }
        
        .taste-bar div[id$="-fill"] {
            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        #taste-radar {
            transition: opacity 0.5s ease;
        }
        
        .taste-dimensions {
            animation: fadeInUp 0.6s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;

    document.head.appendChild(style);
}

// 初始化动画样式
document.addEventListener('DOMContentLoaded', () => {
    addAnimationStyles();
});

// 显示AI分析错误
function showAIAnalysisError(message) {
    const errorElement = document.getElementById('ai-analysis-error');
    errorElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    errorElement.style.display = 'block';
}

// 格式化分析文本为HTML
function formatAnalysisText(text) {
    if (!text) return '';

    // 将文本按段落分割并格式化
    return text
        .split('\n\n')
        .map(paragraph => {
            if (paragraph.trim() === '') return '';

            // 检查是否为标题（以**开头和结尾的文本）
            if (paragraph.includes('**')) {
                paragraph = paragraph.replace(/\*\*(.*?)\*\*/g, '<h4 style="color: #00e5ff; margin: 20px 0 10px 0;">$1</h4>');
            }

            // 处理列表项（以-开头的行）
            if (paragraph.includes('- ')) {
                const lines = paragraph.split('\n');
                let formattedLines = [];
                let inList = false;

                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('- ')) {
                        if (!inList) {
                            formattedLines.push('<ul style="margin: 10px 0; padding-left: 20px;">');
                            inList = true;
                        }
                        formattedLines.push(`<li style="margin: 5px 0; color: rgba(255, 255, 255, 0.85);">${line.substring(2)}</li>`);
                    } else {
                        if (inList) {
                            formattedLines.push('</ul>');
                            inList = false;
                        }
                        if (line) {
                            formattedLines.push(`<p style="margin: 10px 0; line-height: 1.6;">${line}</p>`);
                        }
                    }
                }
                if (inList) {
                    formattedLines.push('</ul>');
                }
                return formattedLines.join('');
            }

            // 普通段落
            return `<p style="margin: 15px 0; line-height: 1.6;">${paragraph.trim()}</p>`;
        })
        .filter(p => p !== '')
        .join('');
}

