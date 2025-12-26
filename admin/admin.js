// --- Add Global Variables for Recipe Pagination ---
let currentRecipePage = 1;
const adminRecipeLimit = 10; // Number of recipes per page in admin view

// --- Add Global Variables for User Pagination ---
let currentUserPage = 1;
const adminUserLimit = 10; // Number of users per page

// --- Add Global Variables for Comment Pagination ---
let currentCommentPage = 1;
const adminCommentLimit = 15; // Number of comments per page
// --- Comment Filter State ---
let commentFilterMode = 'all'; // all | recipe | user
let commentFilterValue = '';

// --- Updated DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Start of initialization logic ---
    const recipeListContainer = document.getElementById('admin-recipe-list');
    const userListContainer = document.getElementById('admin-user-list');
    const commentListContainer = document.getElementById('admin-comment-list'); // Get comment list container
    const statsContainer = document.getElementById('admin-stats');
    const refreshButton = document.getElementById('refresh-admin-data-btn');

    // --- Modal Elements ---
    const modal = document.getElementById('user-action-modal');
    const overlay = document.getElementById('modal-overlay');
    const closeModalBtn = modal?.querySelector('.close-modal-btn'); // Add null check
    const modalUserIdInput = document.getElementById('modal-user-id');
    const modalUsernameTitle = document.getElementById('modal-username');
    const modalRoleSelect = document.getElementById('modal-role-select');
    const modalSaveRoleBtn = document.getElementById('modal-save-role-btn');
    const modalDeleteUserBtn = document.getElementById('modal-delete-user-btn');
    const modalMessage = document.getElementById('modal-message');

    // --- Load Initial Data ---
    if (statsContainer) {
        loadStats();
    } else {
        console.error("Stats container 'admin-stats' not found.");
    }

    if (recipeListContainer) {
        loadRecipesForAdmin(1); // Load first page initially
        // Add event listener for deleting recipes (using event delegation)
        recipeListContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-recipe-btn')) {
                const recipeId = event.target.dataset.id;
                if (recipeId && confirm(`确定要删除 ID 为 ${recipeId} 的配方吗？`)) {
                    deleteRecipe(recipeId, event.target); // Pass button for feedback
                }
            }
        });
    } else {
         console.error("Recipe list container 'admin-recipe-list' not found.");
         const msgElement = document.getElementById('admin-message');
         if(msgElement) msgElement.textContent = "无法加载配方列表容器。";
    }

    if (userListContainer) {
        loadUsersForAdmin(1); // Load first page initially
        // ... (keep existing event listener for modal)
        // --- Event Listener for Opening Modal (via Manage button) ---
        userListContainer.addEventListener('click', (event) => {
            // Check if the click is on the manage button
            if (event.target.classList.contains('manage-user-btn')) {
                const row = event.target.closest('tr'); // Find the parent row
                if (row) {
                    const userId = row.dataset.userId;
                    const username = row.dataset.username;
                    const currentRole = row.dataset.currentRole || 'user';

                    if (userId && username) {
                        openUserModal(userId, username, currentRole);
                    }
                }
            }
        });
    } else {
        console.error("User list container 'admin-user-list' not found.");
        const userMsgElement = document.getElementById('admin-user-message');
        if(userMsgElement) userMsgElement.textContent = "无法加载用户列表容器。";
    }

    // --- Load Comments ---
    if (commentListContainer) {
        loadCommentsForAdmin(1); // Load first page initially
        // Add event listener for deleting comments (using event delegation)
        commentListContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-comment-btn')) {
                const commentId = event.target.dataset.commentId;
                if (commentId && confirm(`确定要删除 ID 为 ${commentId} 的评论吗？`)) {
                    deleteComment(commentId, event.target); // Pass button for feedback
                }
            } else if (event.target.classList.contains('comment-filter-by-recipe')) {
                const rid = event.target.dataset.recipeId;
                if (rid) {
                    setCommentFilter('recipe', rid);
                    loadCommentsForAdmin(1);
                }
            } else if (event.target.classList.contains('comment-filter-by-user')) {
                const uname = event.target.dataset.username;
                if (uname) {
                    setCommentFilter('user', uname);
                    loadCommentsForAdmin(1);
                }
            }
        });
    } else {
        console.error("Comment list container 'admin-comment-list' not found.");
        const commentMsgElement = document.getElementById('admin-comment-message');
        if(commentMsgElement) commentMsgElement.textContent = "无法加载评论列表容器。";
    }

    // --- Comment Filter Controls ---
    setupCommentFilterControls();


    // --- Add Event Listener for Refresh Button ---
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            console.log("Refresh button clicked.");
            // Show loading indicators while refreshing
            const statsMsg = document.getElementById('admin-stats');
            const recipeMsg = document.getElementById('admin-message');
            const recipeTbody = document.getElementById('admin-recipe-list');
            const userMsg = document.getElementById('admin-user-message');
            const userTbody = document.getElementById('admin-user-list');
            const commentMsg = document.getElementById('admin-comment-message'); // Get comment message element
            const commentTbody = document.getElementById('admin-comment-list'); // Get comment table body

            if(statsMsg) statsMsg.textContent = '正在刷新统计...';
            if(recipeMsg) recipeMsg.textContent = '正在刷新配方...';
            if(recipeTbody) recipeTbody.innerHTML = '<tr><td colspan="3">正在刷新...</td></tr>';
            if(userMsg) userMsg.textContent = '正在刷新用户...';
            if(userTbody) userTbody.innerHTML = '<tr><td colspan="4">正在刷新...</td></tr>'; // Adjust colspan
            if(commentMsg) commentMsg.textContent = '正在刷新评论...'; // Update comment message
            if(commentTbody) commentTbody.innerHTML = '<tr><td colspan="6">正在刷新...</td></tr>'; // Clear comment table body, adjust colspan

            // Call functions to reload data - load first page for all paginated lists
            loadStats();
            loadRecipesForAdmin(1);
            loadUsersForAdmin(1); // Load page 1 on refresh
            loadCommentsForAdmin(1); // Load page 1 on refresh
        });
    } else {
        console.error("Refresh button 'refresh-admin-data-btn' not found.");
    }

    // --- Modal Control Event Listeners ---
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeUserModal);
    } else if (modal) { // Fallback if button not found but modal exists
        console.warn("Modal close button not found.");
    }
    if (overlay) {
        overlay.addEventListener('click', closeUserModal); // Close modal if overlay is clicked
    }
    if (modalSaveRoleBtn) {
        modalSaveRoleBtn.addEventListener('click', () => {
            const userId = modalUserIdInput.value;
            const newRole = modalRoleSelect.value;
            if (userId && newRole && ['user', 'admin'].includes(newRole)) {
                 updateUserRole(userId, newRole, modalSaveRoleBtn);
            } else if (newRole && !['user', 'admin'].includes(newRole)) {
                 alert('无效的角色选择。');
            }
        });
    }
    if (modalDeleteUserBtn) {
        modalDeleteUserBtn.addEventListener('click', () => {
            const userId = modalUserIdInput.value;
            const username = modalUsernameTitle.textContent.replace('管理用户: ', '');
            if (userId && confirm(`确定要删除用户 "${username}" (ID: ${userId}) 吗？此操作无法撤销。`)) {
                deleteUser(userId, modalDeleteUserBtn);
            }
        });
    }
    // --- End of initialization logic ---
});

// --- Function to open and populate the modal ---
function openUserModal(userId, username, currentRole) {
    const modal = document.getElementById('user-action-modal');
    const overlay = document.getElementById('modal-overlay');
    const modalUserIdInput = document.getElementById('modal-user-id');
    const modalUsernameTitle = document.getElementById('modal-username');
    const modalRoleSelect = document.getElementById('modal-role-select');
    const modalMessage = document.getElementById('modal-message');

    // Populate modal
    modalUserIdInput.value = userId;
    modalUsernameTitle.textContent = `管理用户: ${username}`;
    modalRoleSelect.value = currentRole;
    if(modalMessage) modalMessage.style.display = 'none'; // Hide previous messages

    // Show modal and overlay
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
}

// --- Function to close the modal ---
function closeUserModal() {
    const modal = document.getElementById('user-action-modal');
    const overlay = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    // Reset button states
    const saveBtn = document.getElementById('modal-save-role-btn');
    const deleteBtn = document.getElementById('modal-delete-user-btn');
    if(saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存角色'; }
    if(deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = '删除此用户'; }
}

// --- Function to load users for admin (MODIFIED FOR PAGINATION) ---
async function loadUsersForAdmin(page = 1) { // Accept page number
    const container = document.getElementById('admin-user-list');
    const messageElement = document.getElementById('admin-user-message');
    const paginationContainer = document.getElementById('admin-user-pagination'); // Get pagination container
    if (!container || !paginationContainer) return;

    if (messageElement) {
        messageElement.textContent = `正在加载第 ${page} 页用户...`;
        messageElement.style.color = 'inherit';
    }
    container.innerHTML = `<tr><td colspan="4">正在加载...</td></tr>`; // Show loading in table
    paginationContainer.innerHTML = ''; // Clear old pagination

    try {
        // Fetch paginated users
        const response = await fetch(`/api/admin/users?page=${page}&limit=${adminUserLimit}`);
        if (!response.ok) {
             if (handleAuthError(response, messageElement)) return;
             let errorMsg = `HTTP error! status: ${response.status}`;
             try {
                 const errData = await response.json();
                 errorMsg = errData.message || errorMsg;
             } catch (e) { /* Ignore parsing error */ }
             throw new Error(errorMsg);
        }

        const responseData = await response.json();
        const users = responseData.users; // Expecting { users: [], ... }
        currentUserPage = responseData.currentPage; // Update global current page

        container.innerHTML = ''; // Clear loading row
        if (!users || users.length === 0) {
            container.innerHTML = `<tr><td colspan="4">第 ${page} 页没有用户可显示。</td></tr>`;
            if (messageElement) messageElement.textContent = '';
            renderUserPagination(responseData.totalPages, responseData.currentPage);
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.id;
            row.dataset.username = user.username;
            row.dataset.currentRole = user.role || 'user';
            
            // 创建头像 img 元素
            const avatarImg = document.createElement('img');
            avatarImg.src = user.avatar || '/uploads/avatars/default-avatar.png';
            avatarImg.alt = '头像';
            avatarImg.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 8px;';
            
            // 创建用户名单元格（包含头像）
            const usernameCell = document.createElement('td');
            usernameCell.style.display = 'flex';
            usernameCell.style.alignItems = 'center';
            usernameCell.appendChild(avatarImg);
            usernameCell.appendChild(document.createTextNode(user.username));
            
            row.innerHTML = `
                <td>${user.id || 'N/A'}</td>
                <td>${user.role || 'user'}</td>
                <td><button class="manage-user-btn" data-user-id="${user.id}" title="管理用户 ${user.username}">管理</button></td>
            `;
            // 将用户名单元格插入到第二列
            row.insertBefore(usernameCell, row.children[1]);
            container.appendChild(row);
        });

        if (messageElement) messageElement.textContent = ''; // Clear loading message
        renderUserPagination(responseData.totalPages, responseData.currentPage); // Render pagination controls

    } catch (error) {
        console.error('Error loading users for admin:', error);
        const colspan = 4;
        if (container) container.innerHTML = `<tr><td colspan="${colspan}">加载用户列表失败。</td></tr>`;
        if (messageElement) {
            messageElement.textContent = '加载用户列表失败: ' + error.message;
            messageElement.style.color = 'red';
        }
        paginationContainer.innerHTML = ''; // Clear pagination on error
    }
}

// --- Function to Render User Pagination Controls ---
function renderUserPagination(totalPages, currentPage) {
    const paginationContainer = document.getElementById('admin-user-pagination');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = ''; // Clear existing controls

    if (totalPages <= 1) return; // No controls needed

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            loadUsersForAdmin(currentPage - 1);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Page Info Span
    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` 第 ${currentPage} / ${totalPages} 页 `;
    pageInfo.style.margin = '0 10px';
    paginationContainer.appendChild(pageInfo);

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadUsersForAdmin(currentPage + 1);
        }
    });
    paginationContainer.appendChild(nextButton);
}

// --- Function to delete a user (Admin) ---
async function deleteUser(userId, buttonElement) {
    const modalMessage = document.getElementById('modal-message'); // Target modal message element
    buttonElement.disabled = true;
    buttonElement.textContent = '删除中...';
    if (modalMessage) { modalMessage.textContent = `正在删除用户 ${userId}...`; modalMessage.style.display = 'block'; modalMessage.style.color = 'inherit';}

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            alert('用户删除成功！');
            closeUserModal(); // Close modal on success
            // --- MODIFICATION: Reload the CURRENT user page after deletion ---
            loadUsersForAdmin(currentUserPage);
            // --- END MODIFICATION ---
        } else {
            // Pass the modal message element
            if (handleAuthError(response, modalMessage)) { buttonElement.disabled = false; buttonElement.textContent = '删除此用户'; return; }
            let errorResult = { message: `删除失败 (${response.status})` };
            try { errorResult = await response.json(); } catch (e) {}
            console.error('Error deleting user:', response.status, errorResult);
            if (modalMessage) {
                modalMessage.textContent = `删除用户失败: ${errorResult.message}`;
                modalMessage.style.color = 'red';
                modalMessage.style.display = 'block';
            } else { // Fallback if modal message element not found
                alert(`删除用户失败: ${errorResult.message}`);
            }
            buttonElement.disabled = false;
            buttonElement.textContent = '删除此用户';
        }
    } catch (error) {
        console.error('Network error deleting user:', error);
        if (modalMessage) {
            modalMessage.textContent = '删除用户时发生网络错误。';
            modalMessage.style.color = 'red';
            modalMessage.style.display = 'block';
        } else {
             alert('删除用户时发生网络错误。');
        }
        buttonElement.disabled = false;
        buttonElement.textContent = '删除此用户';
    }
}

// --- Function to update user role (Admin) ---
async function updateUserRole(userId, newRole, buttonElement) {
    const modalMessage = document.getElementById('modal-message'); // Target modal message element
    buttonElement.disabled = true;
    buttonElement.textContent = '保存中...';
    if (modalMessage) { modalMessage.textContent = `正在修改用户 ${userId} 角色为 ${newRole}...`; modalMessage.style.display = 'block'; modalMessage.style.color = 'inherit';}

    if (!['user', 'admin'].includes(newRole)) {
        alert('无效的角色: ' + newRole);
        buttonElement.disabled = false;
        buttonElement.textContent = '保存角色';
        if (modalMessage) modalMessage.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newRole: newRole }),
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message || '角色修改成功！');
            closeUserModal(); // Close modal on success
            // --- MODIFICATION: Reload the CURRENT user page after update ---
            loadUsersForAdmin(currentUserPage);
            // --- END MODIFICATION ---
        } else {
            // Pass the modal message element
            if (handleAuthError(response, modalMessage)) { buttonElement.disabled = false; buttonElement.textContent = '保存角色'; return; }
            let errorResult = { message: `修改失败 (${response.status})` };
            try { errorResult = await response.json(); } catch (e) {}
            console.error('Error updating role:', response.status, errorResult);
            if (modalMessage) {
                modalMessage.textContent = `修改角色失败: ${errorResult.message}`;
                modalMessage.style.color = 'red';
                modalMessage.style.display = 'block';
            } else {
                alert(`修改角色失败: ${errorResult.message}`);
            }
            buttonElement.disabled = false;
            buttonElement.textContent = '保存角色';
        }
    } catch (error) {
        console.error('Network error updating role:', error);
        if (modalMessage) {
            modalMessage.textContent = '修改角色时发生网络错误。';
            modalMessage.style.color = 'red';
            modalMessage.style.display = 'block';
        } else {
            alert('修改角色时发生网络错误。');
        }
        buttonElement.disabled = false;
        buttonElement.textContent = '保存角色';
    }
}

// --- Function to load recipes for admin (MODIFIED FOR PAGINATION) ---
async function loadRecipesForAdmin(page = 1) { // Accept page number
    const container = document.getElementById('admin-recipe-list');
    const messageElement = document.getElementById('admin-message');
    const paginationContainer = document.getElementById('admin-recipe-pagination'); // Get pagination container
    if (!container || !paginationContainer) return;

    if (messageElement) {
        messageElement.textContent = `正在加载第 ${page} 页配方...`;
        messageElement.style.color = 'inherit';
    }
    container.innerHTML = `<tr><td colspan="3">正在加载...</td></tr>`; // Show loading in table
    paginationContainer.innerHTML = ''; // Clear old pagination

    try {
        // Fetch paginated recipes
        const response = await fetch(`/api/recipes?page=${page}&limit=${adminRecipeLimit}`);
        if (!response.ok) {
             if (handleAuthError(response, messageElement)) return;
             let errorMsg = `HTTP error! status: ${response.status}`;
             try {
                 const errData = await response.json();
                 errorMsg = errData.message || errorMsg;
             } catch (e) { /* Ignore parsing error */ }
             throw new Error(errorMsg);
        }

        const responseData = await response.json();
        const recipes = responseData.recipes;
        currentRecipePage = responseData.currentPage; // Update global current page

        container.innerHTML = ''; // Clear loading row
        if (!recipes || recipes.length === 0) {
            container.innerHTML = `<tr><td colspan="3">第 ${page} 页没有配方可管理。</td></tr>`;
            if (messageElement) messageElement.textContent = '';
            // Still render pagination if there are other pages
            renderRecipePagination(responseData.totalPages, responseData.currentPage);
            return;
        }

        recipes.forEach(recipe => {
            const row = document.createElement('tr');
            
            // 创建图片单元格
            const imgCell = document.createElement('td');
            imgCell.style.textAlign = 'center';
            const img = document.createElement('img');
            img.src = recipe.image || '/uploads/cocktails/jiu.jpg';
            img.alt = '酒品图片';
            img.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; object-fit: cover;';
            imgCell.appendChild(img);
            
            // 创建创建者单元格（包含头像）
            const creatorCell = document.createElement('td');
            creatorCell.style.display = 'flex';
            creatorCell.style.alignItems = 'center';
            const creatorAvatar = document.createElement('img');
            creatorAvatar.src = recipe.creatorAvatar || '/uploads/avatars/default-avatar.png';
            creatorAvatar.alt = '头像';
            creatorAvatar.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; margin-right: 8px; object-fit: cover;';
            creatorCell.appendChild(creatorAvatar);
            creatorCell.appendChild(document.createTextNode(recipe.createdBy || '未知'));
            
            row.innerHTML = `
                <td>${recipe.id || 'N/A'}</td>
                <td>${recipe.name}</td>
                <td>
                    <button class="delete-recipe-btn" data-id="${recipe.id}">删除</button>
                </td>
            `;
            // 将图片单元格和创建者单元格插入
            row.insertBefore(creatorCell, row.children[1]);
            row.insertBefore(imgCell, row.children[1]);
            container.appendChild(row);
        });

        if (messageElement) messageElement.textContent = ''; // Clear loading message
        renderRecipePagination(responseData.totalPages, responseData.currentPage); // Render pagination controls

    } catch (error) {
        console.error('Error loading recipes for admin:', error);
        if (container) container.innerHTML = `<tr><td colspan="3">加载配方列表失败。</td></tr>`;
        if (messageElement) {
            messageElement.textContent = '加载配方列表失败: ' + error.message;
            messageElement.style.color = 'red';
        }
        paginationContainer.innerHTML = ''; // Clear pagination on error
    }
}

// --- Function to Render Recipe Pagination Controls ---
function renderRecipePagination(totalPages, currentPage) {
    const paginationContainer = document.getElementById('admin-recipe-pagination');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = ''; // Clear existing controls

    if (totalPages <= 1) return; // No controls needed for 1 or 0 pages

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            loadRecipesForAdmin(currentPage - 1);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Page Info Span
    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` 第 ${currentPage} / ${totalPages} 页 `;
    pageInfo.style.margin = '0 10px'; // Add some spacing
    paginationContainer.appendChild(pageInfo);

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadRecipesForAdmin(currentPage + 1);
        }
    });
    paginationContainer.appendChild(nextButton);
}

// --- Function to delete a recipe (Admin) ---
async function deleteRecipe(recipeId, buttonElement) {
    const messageElement = document.getElementById('admin-message'); // Target recipe message element
    buttonElement.disabled = true; // Disable button during operation
    buttonElement.textContent = '删除中...';
    if (messageElement) {
        messageElement.textContent = `正在删除配方 ${recipeId}...`;
        messageElement.style.color = 'inherit';
    }

    try {
        const response = await fetch(`/api/recipes/${recipeId}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            alert('配方删除成功！');
            if (messageElement) messageElement.textContent = '配方删除成功！';
            // --- MODIFICATION: Reload the CURRENT page after deletion ---
            loadRecipesForAdmin(currentRecipePage);
            // --- END MODIFICATION ---
        } else {
             // Pass the specific message element
             if (handleAuthError(response, messageElement)) { buttonElement.disabled = false; buttonElement.textContent = '删除'; return; }

             let errorResult = { message: `删除失败 (${response.status})` };
             try {
                 // Try to parse JSON, otherwise use status text
                 errorResult = await response.json();
             } catch (e) {
                 errorResult.message = response.statusText || errorResult.message;
             }

             console.error('Error deleting recipe:', response.status, errorResult);
             const finalMessage = `删除失败: ${errorResult.message}`;
             alert(finalMessage);
             if (messageElement) {
                 messageElement.textContent = finalMessage;
                 messageElement.style.color = 'red';
             }
             buttonElement.disabled = false; // Re-enable button on error
             buttonElement.textContent = '删除';
        }
    } catch (error) {
        console.error('Network or script error during deletion:', error);
        const finalMessage = '删除配方时发生网络错误。';
        alert(finalMessage);
        if (messageElement) {
            messageElement.textContent = finalMessage;
            messageElement.style.color = 'red';
        }
        buttonElement.disabled = false; // Re-enable button on error
        buttonElement.textContent = '删除';
    }
}

// --- Function to load comments for admin (MODIFIED FOR PAGINATION) ---
async function loadCommentsForAdmin(page = 1) { // Accept page number
    const container = document.getElementById('admin-comment-list');
    const messageElement = document.getElementById('admin-comment-message');
    const paginationContainer = document.getElementById('admin-comment-pagination'); // Get pagination container
    if (!container || !paginationContainer) return;

    if (messageElement) {
        messageElement.textContent = `正在加载第 ${page} 页评论...`;
        messageElement.style.color = 'inherit';
    }
    container.innerHTML = `<tr><td colspan="6">正在加载...</td></tr>`; // Show loading in table
    paginationContainer.innerHTML = ''; // Clear old pagination

    try {
        // Build query params with filters
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', adminCommentLimit);
        if (commentFilterMode === 'recipe' && commentFilterValue.trim()) {
            params.set('recipeId', commentFilterValue.trim());
        } else if (commentFilterMode === 'user' && commentFilterValue.trim()) {
            params.set('userQuery', commentFilterValue.trim());
        }

        // Fetch paginated comments with optional filters
        const response = await fetch(`/api/admin/comments?${params.toString()}`);
        if (!response.ok) {
             if (handleAuthError(response, messageElement)) return;
             let errorMsg = `HTTP error! status: ${response.status}`;
             try {
                 const errData = await response.json();
                 errorMsg = errData.message || errorMsg;
             } catch (e) { /* Ignore parsing error */ }
             throw new Error(errorMsg);
        }

        const responseData = await response.json();
    const comments = responseData.comments; // Expecting { comments: [], ... }
        currentCommentPage = responseData.currentPage; // Update global current page

        container.innerHTML = ''; // Clear loading row
        if (!comments || comments.length === 0) {
            container.innerHTML = `<tr><td colspan="6">第 ${page} 页没有评论可显示。</td></tr>`;
            if (messageElement) messageElement.textContent = '';
            renderCommentPagination(responseData.totalPages, responseData.currentPage);
            return;
        }

        comments.forEach(comment => {
            const row = document.createElement('tr');
            const commentTextShort = comment.text.length > 50 ? comment.text.substring(0, 50) + '...' : comment.text;
            const timestampFormatted = comment.timestamp ? new Date(comment.timestamp).toLocaleString('zh-CN') : 'N/A';

            row.innerHTML = `
                <td><button class="link-like comment-filter-by-user" data-username="${comment.username || ''}" title="按此用户筛选">${comment.username || 'N/A'}</button></td>
                <td><button class="link-like comment-filter-by-recipe" data-recipe-id="${comment.recipeId || ''}" title="按此配方筛选">${comment.recipeName || 'N/A'}</button></td>
                <td title="${comment.text}">${commentTextShort}</td>
                <td>${timestampFormatted}</td>
                <td>
                    <button class="delete-comment-btn" data-comment-id="${comment.id}">删除</button>
                </td>
            `;
            container.appendChild(row);
        });

        if (messageElement) messageElement.textContent = ''; // Clear loading message
        renderCommentPagination(responseData.totalPages, responseData.currentPage); // Render pagination controls

    } catch (error) {
        console.error('Error loading comments for admin:', error);
        const colspan = 6;
        if (container) container.innerHTML = `<tr><td colspan="${colspan}">加载评论列表失败。</td></tr>`;
        if (messageElement) {
            messageElement.textContent = '加载评论列表失败: ' + error.message;
            messageElement.style.color = 'red';
        }
        paginationContainer.innerHTML = ''; // Clear pagination on error
    }
}

// --- Function to Render Comment Pagination Controls ---
function renderCommentPagination(totalPages, currentPage) {
    const paginationContainer = document.getElementById('admin-comment-pagination');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = ''; // Clear existing controls

    if (totalPages <= 1) return; // No controls needed

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            loadCommentsForAdmin(currentPage - 1);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Page Info Span
    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` 第 ${currentPage} / ${totalPages} 页 `;
    pageInfo.style.margin = '0 10px';
    paginationContainer.appendChild(pageInfo);

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadCommentsForAdmin(currentPage + 1);
        }
    });
    paginationContainer.appendChild(nextButton);
}

// --- Comment Filter Helpers ---
function setupCommentFilterControls() {
    const modeSelect = document.getElementById('comment-filter-mode');
    const valueInput = document.getElementById('comment-filter-value');
    const applyBtn = document.getElementById('comment-filter-apply');
    const resetBtn = document.getElementById('comment-filter-reset');
    if (!modeSelect || !valueInput || !applyBtn || !resetBtn) return; // Missing elements

    modeSelect.addEventListener('change', () => {
        commentFilterMode = modeSelect.value;
        if (commentFilterMode === 'all') {
            valueInput.value = '';
            valueInput.disabled = true;
            applyBtn.disabled = true;
            resetBtn.disabled = !commentFilterValue; // only enabled if previously filtered
            valueInput.placeholder = '(无)';
        } else if (commentFilterMode === 'recipe') {
            valueInput.disabled = false;
            valueInput.placeholder = '输入配方ID';
            applyBtn.disabled = !valueInput.value.trim();
            resetBtn.disabled = !commentFilterValue;            
        } else if (commentFilterMode === 'user') {
            valueInput.disabled = false;
            valueInput.placeholder = '输入用户ID或用户名';
            applyBtn.disabled = !valueInput.value.trim();
            resetBtn.disabled = !commentFilterValue;
        }
    });

    valueInput.addEventListener('input', () => {
        if (commentFilterMode === 'all') {
            applyBtn.disabled = true;
        } else {
            applyBtn.disabled = !valueInput.value.trim();
        }
    });

    applyBtn.addEventListener('click', () => {
        if (commentFilterMode === 'all') return; // nothing to apply
        const val = valueInput.value.trim();
        if (!val) return;
        commentFilterValue = val;
        resetBtn.disabled = false;
        loadCommentsForAdmin(1);
    });

    resetBtn.addEventListener('click', () => {
        commentFilterMode = 'all';
        commentFilterValue = '';
        modeSelect.value = 'all';
        valueInput.value = '';
        valueInput.disabled = true;
        valueInput.placeholder = '(无)';
        applyBtn.disabled = true;
        resetBtn.disabled = true;
        loadCommentsForAdmin(1);
    });
}

function setCommentFilter(mode, value) {
    const modeSelect = document.getElementById('comment-filter-mode');
    const valueInput = document.getElementById('comment-filter-value');
    const applyBtn = document.getElementById('comment-filter-apply');
    const resetBtn = document.getElementById('comment-filter-reset');
    commentFilterMode = mode;
    commentFilterValue = value;
    if (modeSelect) modeSelect.value = mode;
    if (valueInput) {
        valueInput.disabled = (mode === 'all');
        valueInput.value = (mode === 'all') ? '' : value;
        valueInput.placeholder = mode === 'recipe' ? '输入配方ID' : (mode === 'user' ? '输入用户ID或用户名' : '(无)');
    }
    if (applyBtn) applyBtn.disabled = true; // 已直接应用
    if (resetBtn) resetBtn.disabled = false;
    // 更新提示信息
    const messageElement = document.getElementById('admin-comment-message');
    if (messageElement) {
        if (mode === 'recipe') {
            messageElement.textContent = `当前筛选: 配方ID = ${value}`;
        } else if (mode === 'user') {
            messageElement.textContent = `当前筛选: 用户 = ${value}`;
        } else {
            messageElement.textContent = '';
        }
    }
}

// --- Function to delete a comment (Admin) ---
async function deleteComment(commentId, buttonElement) {
    const messageElement = document.getElementById('admin-comment-message'); // Target comment message element
    buttonElement.disabled = true;
    buttonElement.textContent = '删除中...';
    if (messageElement) {
        messageElement.textContent = `正在删除评论 ${commentId}...`;
        messageElement.style.color = 'inherit';
    }

    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            alert('评论删除成功！');
            if (messageElement) messageElement.textContent = '评论删除成功！';
            // --- MODIFICATION: Reload the CURRENT comment page after deletion ---
            loadCommentsForAdmin(currentCommentPage);
            // --- END MODIFICATION ---
        } else {
            // Pass the specific message element
            if (handleAuthError(response, messageElement)) { buttonElement.disabled = false; buttonElement.textContent = '删除'; return; }
            let errorResult = { message: `删除失败 (${response.status})` };
            try { errorResult = await response.json(); } catch (e) {}
            console.error('Error deleting comment:', response.status, errorResult);
            const finalMessage = `删除评论失败: ${errorResult.message}`;
            alert(finalMessage);
            if (messageElement) {
                messageElement.textContent = finalMessage;
                messageElement.style.color = 'red';
            }
            buttonElement.disabled = false;
            buttonElement.textContent = '删除';
        }
    } catch (error) {
        console.error('Network error deleting comment:', error);
        // Updated error message to suggest checking the server
        const finalMessage = '删除评论时发生网络错误。请检查服务器是否正在运行以及网络连接是否正常。';
        alert(finalMessage);
        if (messageElement) {
            messageElement.textContent = finalMessage;
            messageElement.style.color = 'red';
        }
        buttonElement.disabled = false;
        buttonElement.textContent = '删除';
    }
}


let pageVisitsChartInstance = null; // Variable to hold the chart instance

async function loadStats() {
    const statsContainer = document.getElementById('admin-stats');
    // Use the general admin message for auth errors if statsContainer itself is used for loading text
    const messageElementForAuth = document.getElementById('admin-message') || statsContainer;
    const totalRecipesEl = document.getElementById('stat-total-recipes');
    const totalUsersEl = document.getElementById('stat-total-users');
    const chartCanvas = document.getElementById('pageVisitsChart');

    if (!chartCanvas) {
        console.error("Chart canvas element 'pageVisitsChart' not found.");
        if(statsContainer) statsContainer.textContent = '无法加载图表容器。';
        return;
    }
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
         console.error("Failed to get 2D context for chart canvas.");
         if(statsContainer) statsContainer.textContent = '无法初始化图表。';
         return;
    }

    if (!statsContainer || !totalRecipesEl || !totalUsersEl) {
        console.error("One or more stats text elements not found.");
        return;
    }
    statsContainer.textContent = '正在加载统计数据...';
    statsContainer.style.color = 'inherit'; // Reset color

    try {
        const response = await fetch('/api/admin/stats');

        if (!response.ok) {
            // Pass the specific message element for auth errors
            if (handleAuthError(response, messageElementForAuth)) return;
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stats = await response.json();

        // Update text stats
        totalRecipesEl.textContent = stats.totalRecipes ?? 'N/A';
        totalUsersEl.textContent = stats.totalUsers ?? 'N/A';

        // --- Prepare data for Chart.js ---
        const visitsData = stats.visits || {};
        const pageLabels = Object.keys(visitsData);
        const visitCounts = Object.values(visitsData);

        // --- Create/Update Chart.js Chart ---
        const chartData = {
            labels: pageLabels,
            datasets: [{
                label: '页面访问次数',
                data: visitCounts,
                backgroundColor: [
                    'rgba(0, 229, 255, 0.6)', 'rgba(255, 64, 129, 0.6)', 'rgba(255, 152, 0, 0.6)',
                    'rgba(76, 175, 80, 0.6)', 'rgba(156, 39, 176, 0.6)', 'rgba(255, 235, 59, 0.6)',
                    'rgba(120, 144, 156, 0.6)' // Add more colors if more pages are tracked
                ],
                borderColor: [
                    'rgba(0, 229, 255, 1)', 'rgba(255, 64, 129, 1)', 'rgba(255, 152, 0, 1)',
                    'rgba(76, 175, 80, 1)', 'rgba(156, 39, 176, 1)', 'rgba(255, 235, 59, 1)',
                    'rgba(120, 144, 156, 1)'
                ],
                borderWidth: 1
            }]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: '页面访问统计', color: '#ffffff', font: { size: 16 } }
            }
        };

        if (pageVisitsChartInstance) {
            pageVisitsChartInstance.destroy();
        }

        pageVisitsChartInstance = new Chart(ctx, { type: 'bar', data: chartData, options: chartOptions });

        statsContainer.textContent = ''; // Clear loading message

    } catch (error) {
        console.error('Error loading stats:', error);
        const errorMsg = `加载统计数据失败: ${error.message || '未知错误'}`;
        statsContainer.textContent = errorMsg;
        statsContainer.style.color = 'red';
        totalRecipesEl.textContent = '错误';
        totalUsersEl.textContent = '错误';
        if (pageVisitsChartInstance) {
            pageVisitsChartInstance.destroy();
            pageVisitsChartInstance = null;
        }
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        // Use the auth message element for general errors too if statsContainer is showing the error
        if (messageElementForAuth && messageElementForAuth !== statsContainer) {
            messageElementForAuth.textContent = errorMsg;
            messageElementForAuth.style.color = 'red';
        }
    }
}

// Helper function to check for authentication errors and redirect
function handleAuthError(responseOrError, messageElement) {
    const status = responseOrError?.status;
    if (status === 401 || status === 403) {
         const msg = status === 401 ? '会话无效或未登录。' : '无权访问此资源。';
         const fullMsg = `${msg} 请重新登录。正在跳转...`;
         if (messageElement) {
             messageElement.textContent = fullMsg;
             messageElement.style.color = 'red'; // Ensure error color
             messageElement.style.display = 'block'; // Ensure it's visible
         } else {
             alert(fullMsg); // Fallback alert
         }
         setTimeout(() => {
             window.location.href = '/auth/login/';
         }, 2000); // Slightly longer delay
         return true;
    }
    return false;
}
