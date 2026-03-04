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
const selectedRecipeIds = new Set();
const selectedUserIds = new Set();
let latestVisitsStats = null;

function setMessageState(element, text, state = '') {
    if (!element) return;
    element.textContent = text;
    element.classList.remove('message-error', 'message-success', 'message-warning');
    if (state) {
        element.classList.add(`message-${state}`);
    }
    if (element.hasAttribute('hidden')) {
        element.hidden = !text;
    }
}

function readThemeVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

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

    if (modal) modal.hidden = true;
    if (overlay) overlay.hidden = true;

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
        recipeListContainer.addEventListener('change', (event) => {
            if (!event.target.classList.contains('recipe-select-row')) return;
            const recipeId = event.target.dataset.id;
            if (!recipeId) return;
            if (event.target.checked) {
                selectedRecipeIds.add(recipeId);
            } else {
                selectedRecipeIds.delete(recipeId);
            }
            updateRecipeSelectionUI();
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
        userListContainer.addEventListener('change', (event) => {
            if (!event.target.classList.contains('user-select-row')) return;
            const userId = event.target.dataset.id;
            if (!userId) return;
            if (event.target.checked) {
                selectedUserIds.add(userId);
            } else {
                selectedUserIds.delete(userId);
            }
            updateUserSelectionUI();
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
    setupBatchActionControls();


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
            if(recipeTbody) recipeTbody.innerHTML = '<tr><td colspan="6">正在刷新...</td></tr>';
            if(userMsg) userMsg.textContent = '正在刷新用户...';
            if(userTbody) userTbody.innerHTML = '<tr><td colspan="5">正在刷新...</td></tr>'; // Adjust colspan
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

    document.addEventListener('cybarThemeChanged', () => {
        if (latestVisitsStats) {
            renderVisitsChart(latestVisitsStats);
        }
    });

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
            const username = modal?.dataset.username || '未知用户';
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
    const detailContainer = document.getElementById('modal-user-details');

    // Populate modal
    modalUserIdInput.value = userId;
    modalUsernameTitle.textContent = `管理用户: ${username}`;
    modalRoleSelect.value = currentRole;
    if (modal) modal.dataset.username = username;
    if (modalMessage) setMessageState(modalMessage, '');
    if (detailContainer) detailContainer.textContent = '正在加载账号详情...';

    // Show modal and overlay
    if (modal) modal.hidden = false;
    if (overlay) overlay.hidden = false;
    loadUserDetailForModal(userId);
}

// --- Function to close the modal ---
function closeUserModal() {
    const modal = document.getElementById('user-action-modal');
    const overlay = document.getElementById('modal-overlay');
    const detailContainer = document.getElementById('modal-user-details');
    if (modal) modal.hidden = true;
    if (modal) delete modal.dataset.username;
    if (overlay) overlay.hidden = true;
    // Reset button states
    const saveBtn = document.getElementById('modal-save-role-btn');
    const deleteBtn = document.getElementById('modal-delete-user-btn');
    if(saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存角色'; }
    if(deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = '删除此用户'; }
    if (detailContainer) detailContainer.textContent = '正在加载账号详情...';
    const modalMessage = document.getElementById('modal-message');
    if (modalMessage) setMessageState(modalMessage, '');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadUserDetailForModal(userId) {
    const detailContainer = document.getElementById('modal-user-details');
    const modalMessage = document.getElementById('modal-message');
    if (!detailContainer) return;

    try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`);
        if (!response.ok) {
            if (handleAuthError(response, modalMessage)) return;
            let errMsg = `加载失败 (${response.status})`;
            try {
                const errData = await response.json();
                errMsg = errData.message || errMsg;
            } catch (e) { /* Ignore parsing error */ }
            throw new Error(errMsg);
        }
        const payload = await response.json();
        const user = payload.user || {};
        detailContainer.innerHTML = `
            <dl class="user-detail-grid">
                <dt>用户ID</dt><dd>${escapeHtml(user.id || 'N/A')}</dd>
                <dt>用户名</dt><dd>${escapeHtml(user.username || 'N/A')}</dd>
                <dt>密码</dt><dd>${escapeHtml(user.password || 'N/A')}</dd>
                <dt>角色</dt><dd>${escapeHtml(user.role || 'user')}</dd>
                <dt>头像路径</dt><dd>${escapeHtml(user.avatar || 'N/A')}</dd>
                <dt>个性签名</dt><dd>${escapeHtml(user.signature || '')}</dd>
            </dl>
        `;
    } catch (error) {
        detailContainer.innerHTML = `<span class="admin-error-inline">账号详情加载失败：${escapeHtml(error.message)}</span>`;
    }
}

function setupBatchActionControls() {
    const recipeSelectAll = document.getElementById('recipe-select-all-page');
    const userSelectAll = document.getElementById('user-select-all-page');
    const recipeBatchDeleteBtn = document.getElementById('recipe-batch-delete-btn');
    const userBatchDeleteBtn = document.getElementById('user-batch-delete-btn');
    const recipeClearSelectionBtn = document.getElementById('recipe-clear-selection-btn');
    const userClearSelectionBtn = document.getElementById('user-clear-selection-btn');

    if (recipeSelectAll) {
        recipeSelectAll.addEventListener('change', (event) => {
            document.querySelectorAll('#admin-recipe-list .recipe-select-row').forEach(checkbox => {
                checkbox.checked = event.target.checked;
                const recipeId = checkbox.dataset.id;
                if (recipeId) {
                    if (event.target.checked) selectedRecipeIds.add(recipeId);
                    else selectedRecipeIds.delete(recipeId);
                }
            });
            updateRecipeSelectionUI();
        });
    }

    if (userSelectAll) {
        userSelectAll.addEventListener('change', (event) => {
            document.querySelectorAll('#admin-user-list .user-select-row').forEach(checkbox => {
                checkbox.checked = event.target.checked;
                const userId = checkbox.dataset.id;
                if (userId) {
                    if (event.target.checked) selectedUserIds.add(userId);
                    else selectedUserIds.delete(userId);
                }
            });
            updateUserSelectionUI();
        });
    }

    if (recipeBatchDeleteBtn) {
        recipeBatchDeleteBtn.addEventListener('click', () => {
            batchDeleteRecipes();
        });
    }
    if (userBatchDeleteBtn) {
        userBatchDeleteBtn.addEventListener('click', () => {
            batchDeleteUsers();
        });
    }
    if (recipeClearSelectionBtn) {
        recipeClearSelectionBtn.addEventListener('click', () => {
            selectedRecipeIds.clear();
            syncPageSelection('recipe');
            updateRecipeSelectionUI();
        });
    }
    if (userClearSelectionBtn) {
        userClearSelectionBtn.addEventListener('click', () => {
            selectedUserIds.clear();
            syncPageSelection('user');
            updateUserSelectionUI();
        });
    }
}

function syncPageSelection(type) {
    if (type === 'recipe') {
        document.querySelectorAll('#admin-recipe-list .recipe-select-row').forEach(checkbox => {
            checkbox.checked = selectedRecipeIds.has(checkbox.dataset.id);
        });
    } else if (type === 'user') {
        document.querySelectorAll('#admin-user-list .user-select-row').forEach(checkbox => {
            checkbox.checked = selectedUserIds.has(checkbox.dataset.id);
        });
    }
}

function updateRecipeSelectionUI() {
    const countEl = document.getElementById('recipe-selected-count');
    const batchDeleteBtn = document.getElementById('recipe-batch-delete-btn');
    const clearBtn = document.getElementById('recipe-clear-selection-btn');
    const selectAll = document.getElementById('recipe-select-all-page');
    const pageCheckboxes = document.querySelectorAll('#admin-recipe-list .recipe-select-row');

    if (countEl) countEl.textContent = `已选 ${selectedRecipeIds.size} 项`;
    if (batchDeleteBtn) batchDeleteBtn.disabled = selectedRecipeIds.size === 0;
    if (clearBtn) clearBtn.disabled = selectedRecipeIds.size === 0;
    if (selectAll) {
        const checkedCount = Array.from(pageCheckboxes).filter(el => el.checked).length;
        selectAll.checked = pageCheckboxes.length > 0 && checkedCount === pageCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < pageCheckboxes.length;
    }
}

function updateUserSelectionUI() {
    const countEl = document.getElementById('user-selected-count');
    const batchDeleteBtn = document.getElementById('user-batch-delete-btn');
    const clearBtn = document.getElementById('user-clear-selection-btn');
    const selectAll = document.getElementById('user-select-all-page');
    const pageCheckboxes = document.querySelectorAll('#admin-user-list .user-select-row');

    if (countEl) countEl.textContent = `已选 ${selectedUserIds.size} 项`;
    if (batchDeleteBtn) batchDeleteBtn.disabled = selectedUserIds.size === 0;
    if (clearBtn) clearBtn.disabled = selectedUserIds.size === 0;
    if (selectAll) {
        const checkedCount = Array.from(pageCheckboxes).filter(el => el.checked).length;
        selectAll.checked = pageCheckboxes.length > 0 && checkedCount === pageCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < pageCheckboxes.length;
    }
}

// --- Function to load users for admin (MODIFIED FOR PAGINATION) ---
async function loadUsersForAdmin(page = 1) { // Accept page number
    const container = document.getElementById('admin-user-list');
    const messageElement = document.getElementById('admin-user-message');
    const paginationContainer = document.getElementById('admin-user-pagination'); // Get pagination container
    if (!container || !paginationContainer) return;

    if (messageElement) {
        setMessageState(messageElement, `正在加载第 ${page} 页用户...`);
    }
    container.innerHTML = `<tr><td colspan="5">正在加载...</td></tr>`; // Show loading in table
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
            container.innerHTML = `<tr><td colspan="5">第 ${page} 页没有用户可显示。</td></tr>`;
            if (messageElement) messageElement.textContent = '';
            renderUserPagination(responseData.totalPages, responseData.currentPage);
            updateUserSelectionUI();
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
            avatarImg.className = 'admin-inline-avatar';
            
            // 创建用户名单元格（包含头像）
            const usernameCell = document.createElement('td');
            usernameCell.className = 'admin-inline-user';
            usernameCell.appendChild(avatarImg);
            usernameCell.appendChild(document.createTextNode(user.username));

            const selectCell = document.createElement('td');
            selectCell.className = 'select-col';
            const selectInput = document.createElement('input');
            selectInput.type = 'checkbox';
            selectInput.className = 'row-select-checkbox user-select-row';
            selectInput.dataset.id = user.id;
            selectInput.checked = selectedUserIds.has(String(user.id));
            selectCell.appendChild(selectInput);
            
            row.innerHTML = `
                <td>${user.id || 'N/A'}</td>
                <td>${user.role || 'user'}</td>
                <td><button class="manage-user-btn" data-user-id="${user.id}" title="管理用户 ${user.username}">管理/详情</button></td>
            `;
            row.insertBefore(selectCell, row.children[0]);
            // 将用户名单元格插入到第二列
            row.insertBefore(usernameCell, row.children[2]);
            container.appendChild(row);
        });

        if (messageElement) setMessageState(messageElement, ''); // Clear loading message
        renderUserPagination(responseData.totalPages, responseData.currentPage); // Render pagination controls
        updateUserSelectionUI();

    } catch (error) {
        console.error('Error loading users for admin:', error);
        const colspan = 5;
        if (container) container.innerHTML = `<tr><td colspan="${colspan}">加载用户列表失败。</td></tr>`;
        if (messageElement) {
            setMessageState(messageElement, `加载用户列表失败: ${error.message}`, 'error');
        }
        paginationContainer.innerHTML = ''; // Clear pagination on error
        updateUserSelectionUI();
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
    pageInfo.className = 'pagination-page-info';
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
    if (modalMessage) setMessageState(modalMessage, `正在删除用户 ${userId}...`);

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            alert('用户删除成功！');
            selectedUserIds.delete(String(userId));
            updateUserSelectionUI();
            closeUserModal(); // Close modal on success
            // --- MODIFICATION: Reload the CURRENT user page after deletion ---
            loadUsersForAdmin(currentUserPage);
            loadStats();
            // --- END MODIFICATION ---
        } else {
            // Pass the modal message element
            if (handleAuthError(response, modalMessage)) { buttonElement.disabled = false; buttonElement.textContent = '删除此用户'; return; }
            let errorResult = { message: `删除失败 (${response.status})` };
            try { errorResult = await response.json(); } catch (e) {}
            console.error('Error deleting user:', response.status, errorResult);
            if (modalMessage) {
                setMessageState(modalMessage, `删除用户失败: ${errorResult.message}`, 'error');
            } else { // Fallback if modal message element not found
                alert(`删除用户失败: ${errorResult.message}`);
            }
            buttonElement.disabled = false;
            buttonElement.textContent = '删除此用户';
        }
    } catch (error) {
        console.error('Network error deleting user:', error);
        if (modalMessage) {
            setMessageState(modalMessage, '删除用户时发生网络错误。', 'error');
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
    if (modalMessage) setMessageState(modalMessage, `正在修改用户 ${userId} 角色为 ${newRole}...`);

    if (!['user', 'admin'].includes(newRole)) {
        alert('无效的角色: ' + newRole);
        buttonElement.disabled = false;
        buttonElement.textContent = '保存角色';
        if (modalMessage) setMessageState(modalMessage, '');
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
                setMessageState(modalMessage, `修改角色失败: ${errorResult.message}`, 'error');
            } else {
                alert(`修改角色失败: ${errorResult.message}`);
            }
            buttonElement.disabled = false;
            buttonElement.textContent = '保存角色';
        }
    } catch (error) {
        console.error('Network error updating role:', error);
        if (modalMessage) {
            setMessageState(modalMessage, '修改角色时发生网络错误。', 'error');
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
        setMessageState(messageElement, `正在加载第 ${page} 页配方...`);
    }
    container.innerHTML = `<tr><td colspan="6">正在加载...</td></tr>`; // Show loading in table
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
            container.innerHTML = `<tr><td colspan="6">第 ${page} 页没有配方可管理。</td></tr>`;
            if (messageElement) setMessageState(messageElement, '');
            // Still render pagination if there are other pages
            renderRecipePagination(responseData.totalPages, responseData.currentPage);
            updateRecipeSelectionUI();
            return;
        }

        recipes.forEach(recipe => {
            const row = document.createElement('tr');
            
            // 创建图片单元格
            const imgCell = document.createElement('td');
            imgCell.className = 'admin-thumb-wrap';
            const img = document.createElement('img');
            img.src = recipe.image || '/uploads/cocktails/jiu.jpg';
            img.alt = '酒品图片';
            img.className = 'admin-recipe-thumb';
            imgCell.appendChild(img);
            
            // 创建创建者单元格（包含头像）
            const creatorCell = document.createElement('td');
            creatorCell.className = 'admin-inline-creator';
            const creatorAvatar = document.createElement('img');
            creatorAvatar.src = recipe.creatorAvatar || '/uploads/avatars/default-avatar.png';
            creatorAvatar.alt = '头像';
            creatorAvatar.className = 'admin-inline-avatar';
            creatorCell.appendChild(creatorAvatar);
            creatorCell.appendChild(document.createTextNode(recipe.createdBy || '未知'));

            const selectCell = document.createElement('td');
            selectCell.className = 'select-col';
            const selectInput = document.createElement('input');
            selectInput.type = 'checkbox';
            selectInput.className = 'row-select-checkbox recipe-select-row';
            selectInput.dataset.id = recipe.id;
            selectInput.checked = selectedRecipeIds.has(String(recipe.id));
            selectCell.appendChild(selectInput);
            
            row.innerHTML = `
                <td>${recipe.id || 'N/A'}</td>
                <td>${recipe.name}</td>
                <td>
                    <button class="delete-recipe-btn" data-id="${recipe.id}">删除</button>
                </td>
            `;
            row.insertBefore(selectCell, row.children[0]);
            // 将图片单元格和创建者单元格插入
            row.insertBefore(creatorCell, row.children[3]);
            row.insertBefore(imgCell, row.children[2]);
            container.appendChild(row);
        });

        if (messageElement) setMessageState(messageElement, ''); // Clear loading message
        renderRecipePagination(responseData.totalPages, responseData.currentPage); // Render pagination controls
        updateRecipeSelectionUI();

    } catch (error) {
        console.error('Error loading recipes for admin:', error);
        if (container) container.innerHTML = `<tr><td colspan="6">加载配方列表失败。</td></tr>`;
        if (messageElement) {
            setMessageState(messageElement, `加载配方列表失败: ${error.message}`, 'error');
        }
        paginationContainer.innerHTML = ''; // Clear pagination on error
        updateRecipeSelectionUI();
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
    pageInfo.className = 'pagination-page-info';
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
        setMessageState(messageElement, `正在删除配方 ${recipeId}...`);
    }

    try {
        const response = await fetch(`/api/recipes/${recipeId}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            alert('配方删除成功！');
            if (messageElement) messageElement.textContent = '配方删除成功！';
            selectedRecipeIds.delete(String(recipeId));
            updateRecipeSelectionUI();
            // --- MODIFICATION: Reload the CURRENT page after deletion ---
            loadRecipesForAdmin(currentRecipePage);
            loadStats();
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
                 setMessageState(messageElement, finalMessage, 'error');
             }
             buttonElement.disabled = false; // Re-enable button on error
             buttonElement.textContent = '删除';
        }
    } catch (error) {
        console.error('Network or script error during deletion:', error);
        const finalMessage = '删除配方时发生网络错误。';
        alert(finalMessage);
        if (messageElement) {
            setMessageState(messageElement, finalMessage, 'error');
        }
        buttonElement.disabled = false; // Re-enable button on error
        buttonElement.textContent = '删除';
    }
}

async function batchDeleteRecipes() {
    const ids = Array.from(selectedRecipeIds);
    if (!ids.length) return;
    if (!confirm(`确定要批量删除这 ${ids.length} 个配方吗？此操作不可撤销。`)) return;

    const messageElement = document.getElementById('admin-message');
    const batchDeleteBtn = document.getElementById('recipe-batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.disabled = true;
        batchDeleteBtn.textContent = '批量删除中...';
    }
    if (messageElement) {
        setMessageState(messageElement, `正在批量删除 ${ids.length} 个配方...`);
    }

    try {
        const response = await fetch('/api/admin/recipes/batch-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (response.ok) {
            const result = await response.json();
            ids.forEach(id => selectedRecipeIds.delete(String(id)));
            const deletedCount = Number(result.deletedCount || 0);
            alert(result.message || `已批量删除 ${deletedCount} 个配方`);
            loadRecipesForAdmin(currentRecipePage);
            loadStats();
        } else {
            if (handleAuthError(response, messageElement)) return;
            let errMsg = `批量删除失败 (${response.status})`;
            try {
                const errData = await response.json();
                errMsg = errData.message || errMsg;
            } catch (e) { /* Ignore parsing error */ }
            throw new Error(errMsg);
        }
    } catch (error) {
        const finalMsg = `批量删除配方失败: ${error.message}`;
        if (messageElement) {
            setMessageState(messageElement, finalMsg, 'error');
        }
        alert(finalMsg);
    } finally {
        if (batchDeleteBtn) {
            batchDeleteBtn.textContent = '批量删除配方';
        }
        updateRecipeSelectionUI();
    }
}

async function batchDeleteUsers() {
    const ids = Array.from(selectedUserIds);
    if (!ids.length) return;
    if (!confirm(`确定要批量删除这 ${ids.length} 个账号吗？此操作不可撤销。`)) return;

    const messageElement = document.getElementById('admin-user-message');
    const batchDeleteBtn = document.getElementById('user-batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.disabled = true;
        batchDeleteBtn.textContent = '批量删除中...';
    }
    if (messageElement) {
        setMessageState(messageElement, `正在批量删除 ${ids.length} 个账号...`);
    }

    try {
        const response = await fetch('/api/admin/users/batch/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (response.ok) {
            const result = await response.json();
            ids.forEach(id => selectedUserIds.delete(String(id)));
            const deletedCount = Number(result.deletedCount || 0);
            alert(result.message || `已批量删除 ${deletedCount} 个账号`);
            closeUserModal();
            loadUsersForAdmin(currentUserPage);
            loadStats();
        } else {
            if (handleAuthError(response, messageElement)) return;
            let errMsg = `批量删除失败 (${response.status})`;
            try {
                const errData = await response.json();
                errMsg = errData.message || errMsg;
            } catch (e) { /* Ignore parsing error */ }
            throw new Error(errMsg);
        }
    } catch (error) {
        const finalMsg = `批量删除账号失败: ${error.message}`;
        if (messageElement) {
            setMessageState(messageElement, finalMsg, 'error');
        }
        alert(finalMsg);
    } finally {
        if (batchDeleteBtn) {
            batchDeleteBtn.textContent = '批量删除账号';
        }
        updateUserSelectionUI();
    }
}

// --- Function to load comments for admin (MODIFIED FOR PAGINATION) ---
async function loadCommentsForAdmin(page = 1) { // Accept page number
    const container = document.getElementById('admin-comment-list');
    const messageElement = document.getElementById('admin-comment-message');
    const paginationContainer = document.getElementById('admin-comment-pagination'); // Get pagination container
    if (!container || !paginationContainer) return;

    if (messageElement) {
        setMessageState(messageElement, `正在加载第 ${page} 页评论...`);
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
            if (messageElement) setMessageState(messageElement, '');
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

        if (messageElement) setMessageState(messageElement, ''); // Clear loading message
        renderCommentPagination(responseData.totalPages, responseData.currentPage); // Render pagination controls

    } catch (error) {
        console.error('Error loading comments for admin:', error);
        const colspan = 6;
        if (container) container.innerHTML = `<tr><td colspan="${colspan}">加载评论列表失败。</td></tr>`;
        if (messageElement) {
            setMessageState(messageElement, `加载评论列表失败: ${error.message}`, 'error');
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
    pageInfo.className = 'pagination-page-info';
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
            setMessageState(messageElement, `当前筛选: 配方ID = ${value}`);
        } else if (mode === 'user') {
            setMessageState(messageElement, `当前筛选: 用户 = ${value}`);
        } else {
            setMessageState(messageElement, '');
        }
    }
}

// --- Function to delete a comment (Admin) ---
async function deleteComment(commentId, buttonElement) {
    const messageElement = document.getElementById('admin-comment-message'); // Target comment message element
    buttonElement.disabled = true;
    buttonElement.textContent = '删除中...';
    if (messageElement) {
        setMessageState(messageElement, `正在删除评论 ${commentId}...`);
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
                setMessageState(messageElement, finalMessage, 'error');
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
            setMessageState(messageElement, finalMessage, 'error');
        }
        buttonElement.disabled = false;
        buttonElement.textContent = '删除';
    }
}


let pageVisitsChartInstance = null; // Variable to hold the chart instance

function renderVisitsChart(visitsData) {
    const chartCanvas = document.getElementById('pageVisitsChart');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    const pageLabels = Object.keys(visitsData || {});
    const visitCounts = Object.values(visitsData || {});
    const chartColors = [
        readThemeVar('--chart-1', 'rgba(0, 200, 255, 1)'),
        readThemeVar('--chart-2', 'rgba(77, 139, 255, 1)'),
        readThemeVar('--chart-3', 'rgba(24, 243, 214, 1)'),
        readThemeVar('--chart-4', 'rgba(123, 141, 255, 1)'),
        readThemeVar('--chart-5', 'rgba(72, 183, 255, 1)')
    ];

    const barBackgrounds = visitCounts.map((_, idx) => `${chartColors[idx % chartColors.length]}99`);
    const barBorders = visitCounts.map((_, idx) => chartColors[idx % chartColors.length]);

    const chartData = {
        labels: pageLabels,
        datasets: [{
            label: '页面访问次数',
            data: visitCounts,
            backgroundColor: barBackgrounds,
            borderColor: barBorders,
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: readThemeVar('--chart-axis', 'rgba(220, 232, 255, 1)') },
                grid: { color: readThemeVar('--chart-grid', 'rgba(255,255,255,0.1)') }
            },
            x: {
                ticks: { color: readThemeVar('--chart-axis', 'rgba(220, 232, 255, 1)') },
                grid: { color: readThemeVar('--chart-grid', 'rgba(255,255,255,0.1)') }
            }
        },
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: '页面访问统计',
                color: readThemeVar('--chart-title', 'rgba(255, 255, 255, 1)'),
                font: { size: 16 }
            }
        }
    };

    if (pageVisitsChartInstance) {
        pageVisitsChartInstance.destroy();
    }

    pageVisitsChartInstance = new Chart(ctx, { type: 'bar', data: chartData, options: chartOptions });
}

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
    statsContainer.classList.remove('admin-error-inline');

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

        latestVisitsStats = stats.visits || {};
        renderVisitsChart(latestVisitsStats);

        statsContainer.textContent = ''; // Clear loading message

    } catch (error) {
        console.error('Error loading stats:', error);
        const errorMsg = `加载统计数据失败: ${error.message || '未知错误'}`;
        statsContainer.textContent = errorMsg;
        statsContainer.classList.add('admin-error-inline');
        totalRecipesEl.textContent = '错误';
        totalUsersEl.textContent = '错误';
        if (pageVisitsChartInstance) {
            pageVisitsChartInstance.destroy();
            pageVisitsChartInstance = null;
        }
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        // Use the auth message element for general errors too if statsContainer is showing the error
        if (messageElementForAuth && messageElementForAuth !== statsContainer) {
            setMessageState(messageElementForAuth, errorMsg, 'error');
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
             setMessageState(messageElement, fullMsg, 'error');
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
