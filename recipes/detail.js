document.addEventListener('DOMContentLoaded', () => {
    const recipeDetailContainer = document.getElementById('recipe-detail'); // Your container ID for details
    const errorMessageElement = document.getElementById('error-message'); // Element to show errors
    const interactionButtons = document.getElementById('interaction-buttons');
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');
    const likeCountSpan = document.getElementById('like-count');
    const favoriteCountSpan = document.getElementById('favorite-count');

    // --- Get recipe ID from URL query parameter ---
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id'); // Get the 'id' parameter

    if (!recipeId) {
        console.error('Recipe ID not found in URL');
        if (errorMessageElement) errorMessageElement.textContent = '错误：未在 URL 中指定配方 ID。';
        return;
    }

    // --- Fetch recipe detail using the ID ---
    fetch(`/api/recipes/${recipeId}`) // Use the recipeId in the fetch URL
        .then(response => {
            if (!response.ok) {
                // Throw an error with the status text to be caught below
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(recipe => {
            displayRecipeDetail(recipe);
            // Load interaction data if user is logged in
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

    // --- Add event listener for deleting comments (using delegation) ---
    const commentsListContainer = document.getElementById('comments-list');
    if (commentsListContainer) {
        commentsListContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-comment-btn')) {
                const commentId = event.target.dataset.commentId;
                if (commentId && confirm('确定要删除这条评论吗？')) {
                    deleteComment(commentId, event.target); // Pass button for feedback
                }
            }
        });
    }

    // --- Setup like button click handler ---
    if (likeButton) {
        likeButton.addEventListener('click', () => {
            toggleLike(recipeId);
        });
    }

    // --- Setup favorite button click handler ---
    if (favoriteButton) {
        favoriteButton.addEventListener('click', () => {
            toggleFavorite(recipeId);
        });
    }

    // --- Show interaction buttons container if exists ---
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

    // 设置标题
    const title = document.createElement('h2');
    title.textContent = recipe.name;
    contentContainer.appendChild(title);

    // 创建社交互动栏（包含点赞、收藏）
    const socialBar = document.createElement('div');
    socialBar.classList.add('social-interaction-bar');
    socialBar.style.cssText = 'display: flex; gap: 20px; align-items: center; margin: 15px 0; padding: 10px; border-bottom: 1px solid #eee;';

    // 重组点赞按钮
    const likeWrapper = document.createElement('div');
    likeWrapper.classList.add('interaction-wrapper');
    likeWrapper.innerHTML = `
        <button id="like-button" class="interaction-btn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <i class="far fa-heart" style="transition: color 0.3s ease"></i>
            <span id="like-count">${recipe.likeCount !== undefined ? recipe.likeCount : 0}</span>
        </button>
    `;

    // 重组收藏按钮
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
    creatorInfo.innerHTML = `<strong>创建者:</strong> ${recipe.createdBy || '未知用户'}`;
    contentContainer.appendChild(creatorInfo);

    // 添加配料标题和列表
    const ingredientsTitle = document.createElement('h3');
    ingredientsTitle.textContent = '配料:';
    contentContainer.appendChild(ingredientsTitle);

    const ingredientsList = document.createElement('ul');
    recipe.ingredients.forEach(ing => {
        const li = document.createElement('li');
        li.textContent = `${ing.name}: ${ing.volume}ml (ABV: ${ing.abv}%)`;
        ingredientsList.appendChild(li);
    });
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

    // 添加新的内容到容器
    container.appendChild(contentContainer);

    // 重新绑定事件监听器
    setupInteractionListeners(recipe.id);
}

// --- Function to setup interaction listeners ---
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
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to toggle like');
                }

                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling like:', error);
                alert('操作失败，请重试');
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
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to toggle favorite');
                }

                const data = await response.json();
                updateInteractionUI(data);
            } catch (error) {
                console.error('Error toggling favorite:', error);
                alert('操作失败，请重试');
            }
        });
    }
}

// --- Function to update interaction UI ---
function updateInteractionUI(data) {
    const likeButton = document.getElementById('like-button');
    const favoriteButton = document.getElementById('favorite-button');
    const likeCountSpan = document.getElementById('like-count');
    const favoriteCountSpan = document.getElementById('favorite-count');

    if (!likeButton || !favoriteButton || !likeCountSpan || !favoriteCountSpan) return;

    // 只更新传入数据中存在的计数
    if (typeof data.likeCount !== 'undefined') {
        likeCountSpan.textContent = data.likeCount;
    }
    if (typeof data.favoriteCount !== 'undefined') {
        favoriteCountSpan.textContent = data.favoriteCount;
    }

    // 更新点赞状态（仅当传入数据包含isLiked时）
    if (typeof data.isLiked !== 'undefined') {
        const likeIcon = likeButton.querySelector('i');
        if (data.isLiked) {
            likeIcon.classList.remove('far');
            likeIcon.classList.add('fas');
            likeIcon.style.color = '#ff4757';
            likeButton.classList.add('active');
        } else {
            likeIcon.classList.remove('fas');
            likeIcon.classList.add('far');
            likeIcon.style.color = '#6c757d';
            likeButton.classList.remove('active');
        }
    }

    // 更新收藏状态（仅当传入数据包含isFavorited时）
    if (typeof data.isFavorited !== 'undefined') {
        const favoriteIcon = favoriteButton.querySelector('i');
        if (data.isFavorited) {
            favoriteIcon.classList.remove('far');
            favoriteIcon.classList.add('fas');
            favoriteIcon.style.color = '#ffa502';
            favoriteButton.classList.add('active');
        } else {
            favoriteIcon.classList.remove('fas');
            favoriteIcon.classList.add('far');
            favoriteIcon.style.color = '#6c757d';
            favoriteButton.classList.remove('active');
        }
    }

    // 为未登录用户禁用按钮
    if (!document.body.classList.contains('logged-in')) {
        likeButton.disabled = true;
        favoriteButton.disabled = true;
        likeButton.title = '请登录后点赞';
        favoriteButton.title = '请登录后收藏';
    } else {
        likeButton.disabled = false;
        favoriteButton.disabled = false;
        likeButton.title = data.isLiked ? '取消点赞' : '点赞';
        favoriteButton.title = data.isFavorited ? '取消收藏' : '收藏';
    }
}

// --- Function to load and display comments ---
async function loadComments(recipeId) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = '<p>正在加载评论...</p>';

    try {
        const response = await fetch(`/api/recipes/${recipeId}/comments`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('获取评论时出错:', error);
        commentsListContainer.innerHTML = '<p style="color: red;">无法加载评论。</p>';
    }
}

// --- Function to render comments ---
function renderComments(comments) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = ''; // Clear loading message

    if (!comments || comments.length === 0) {
        commentsListContainer.innerHTML = '<p>暂无评论。</p>';
        return;
    }

    const isAdmin = document.body.classList.contains('is-admin'); // Check if user is admin

    comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort newest first

    comments.forEach(comment => {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('comment');
        commentDiv.dataset.commentId = comment.id; // Add comment ID to the div for easier removal

        // Add delete button HTML only if user is admin
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

// --- Function to set up the comment form ---
function setupCommentForm(recipeId) {
    const commentForm = document.getElementById('comment-form');
    const commentText = document.getElementById('comment-text');
    const commentError = document.getElementById('comment-error');
    const loginPrompt = document.getElementById('login-prompt');

    // Check login status to show/hide form (relies on body class from global.js)
    if (document.body.classList.contains('logged-out')) {
        if (commentForm) commentForm.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
        return; // Don't add submit listener if not logged in
    } else {
         if (commentForm) commentForm.style.display = 'block';
         if (loginPrompt) loginPrompt.style.display = 'none';
    }


    if (commentForm && commentText) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (commentError) commentError.style.display = 'none'; // Hide previous errors

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
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ commentText: commentContent }),
                });

                if (response.ok) {
                    const newComment = await response.json();
                    commentText.value = ''; // Clear textarea
                    // Optionally, add the new comment directly to the list or reload all comments
                    addCommentToDOM(newComment); // Add directly for instant feedback
                    // loadComments(recipeId); // Or reload all
                } else {
                    // Handle errors (like 401 Unauthorized if session expired mid-way)
                    let errorData = { message: `提交失败 (${response.status})` };
                     try { errorData = await response.json(); } catch(err) {}

                     if (response.status === 401 || response.status === 403) {
                         // Handle auth error specifically if needed (e.g., redirect)
                         if (commentError) commentError.textContent = '请重新登录后提交评论。';
                         // Optionally redirect after delay
                         // setTimeout(() => { window.location.href = '/auth/login/'; }, 1500);
                     } else {
                         if (commentError) commentError.textContent = errorData.message;
                     }
                     if (commentError) commentError.style.display = 'block';
                }
            } catch (error) {
                console.error('提交评论时出错:', error);
                 if (commentError) {
                    commentError.textContent = '提交评论时发生网络错误。';
                    commentError.style.display = 'block';
                }
            }
        });
    }
}

// --- Helper function to add a single comment to the top of the list ---
function addCommentToDOM(comment) {
    const commentsListContainer = document.getElementById('comments-list');
    if (!commentsListContainer) return;

    // Remove "暂无评论" message if present
    const noCommentsMsg = commentsListContainer.querySelector('p');
    if (noCommentsMsg && noCommentsMsg.textContent === '暂无评论。') {
        commentsListContainer.innerHTML = '';
    }

    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    commentDiv.innerHTML = `
        <p class="comment-meta">
            <strong>${comment.username || '匿名用户'}</strong>
            <span> - ${new Date(comment.timestamp).toLocaleString('zh-CN')}</span>
        </p>
        <p class="comment-text">${escapeHTML(comment.text)}</p>
    `;
    // Prepend to show newest first
    commentsListContainer.insertBefore(commentDiv, commentsListContainer.firstChild);
}

// --- Helper function to escape HTML ---
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Function to delete a comment ---
async function deleteComment(commentId, buttonElement) {
    buttonElement.disabled = true; // Disable button during request
    buttonElement.textContent = '...'; // Indicate processing

    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            // Remove the comment element from the DOM
            const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (commentElement) {
                commentElement.remove();
            }
            // Check if comments list is now empty
            const commentsListContainer = document.getElementById('comments-list');
            if (commentsListContainer && !commentsListContainer.hasChildNodes()) {
                 commentsListContainer.innerHTML = '<p>暂无评论。</p>';
            }
            alert('评论删除成功！'); // Optional success message
        } else {
            let errorData = { message: `删除失败 (${response.status})` };
            try { errorData = await response.json(); } catch(err) {}
            console.error('Error deleting comment:', errorData);
            alert(`删除评论失败: ${errorData.message}`);
            // Re-enable button on failure
            buttonElement.disabled = false;
            buttonElement.textContent = '×';
        }
    } catch (error) {
        console.error('Network error deleting comment:', error);
        alert('删除评论时发生网络错误。');
        // Re-enable button on failure
        buttonElement.disabled = false;
        buttonElement.textContent = '×';
    }
}

// --- Function to load interaction data ---
async function loadInteractionData(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}/interactions`);
        if (!response.ok) {
            throw new Error('Failed to load interaction data');
        }
        const data = await response.json();
        
        // Update UI with interaction data
        updateInteractionUI(data);

        // Show interaction buttons for all users
        const interactionButtons = document.getElementById('interaction-buttons');
        interactionButtons.style.display = 'block';

        // If user is not logged in, disable the buttons
        if (!document.body.classList.contains('logged-in')) {
            const likeButton = document.getElementById('like-button');
            const favoriteButton = document.getElementById('favorite-button');
            
            if (likeButton) {
                likeButton.disabled = true;
                likeButton.title = '请登录后点赞';
            }
            if (favoriteButton) {
                favoriteButton.disabled = true;
                favoriteButton.title = '请登录后收藏';
            }
        }
    } catch (error) {
        console.error('Error loading interaction data:', error);
        // Hide interaction buttons if there's an error
        document.getElementById('interaction-buttons').style.display = 'none';
    }
}

// --- Function to toggle like ---
async function toggleLike(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to toggle like');
        }

        const data = await response.json();
        // 只更新点赞相关的状态
        updateInteractionUI({
            likeCount: data.likeCount,
            isLiked: data.isLiked
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('操作失败，请重试');
    }
}

// --- Function to toggle favorite ---
async function toggleFavorite(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to toggle favorite');
        }

        const data = await response.json();
        // 只更新收藏相关的状态
        updateInteractionUI({
            favoriteCount: data.favoriteCount,
            isFavorited: data.isFavorited
        });
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('操作失败，请重试');
    }
}

// --- 新增：处理评论提交的 API 路由 ---
app.post('/api/recipes/:id/comments', async (req, res) => {
    const recipeId = req.params.id;
    const { commentText } = req.body;
    const userId = req.session.userId;
    const username = req.session.username;

    if (!userId) {
        return res.status(401).json({ message: '请先登录' });
    }

    if (!commentText || commentText.trim() === '') {
        return res.status(400).json({ message: '评论内容不能为空' });
    }

    try {
        // 插入评论
        await dbPool.query(
            `INSERT INTO comment (thread_id, user_id, username, text, timestamp) VALUES (?, ?, ?, ?, NOW())`,
            [recipeId, userId, username, commentText.trim()]
        );
        // 查询刚插入的评论
        const [rows] = await dbPool.query(
            `SELECT id, user_id, username, text, timestamp FROM comment WHERE thread_id = ? ORDER BY id DESC LIMIT 1`, [recipeId]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error inserting comment:', error);
        res.status(500).json({ message: '提交评论时发生错误' });
    }
});
