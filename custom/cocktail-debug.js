/**
 * 调酒模拟器调试工具
 * 用于检测和修复模拟器问题
 */

// 初始化调试工具
window.cocktailDebug = {
    enabled: true,

    // 显示错误消息
    showError: function (message) {
        console.error('[调酒模拟器]: ' + message);

        // 创建错误提示UI
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background-color: rgba(220, 53, 69, 0.9);
            color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 10000;
            font-family: sans-serif;
            max-width: 90%;
        `;

        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <strong>调酒模拟器错误</strong>
                <button id="fix-simulator-btn" style="background: #0275d8; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">修复</button>
            </div>
            <div>${message}</div>
        `;

        document.body.appendChild(errorDiv);

        // 添加修复按钮点击事件
        document.getElementById('fix-simulator-btn').addEventListener('click', function () {
            this.cocktailDebug.fixSimulator();
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }.bind(window));

        // 5秒后自动移除错误提示
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 10000);
    },

    // 检查样式表是否加载
    checkStylesheet: function () {
        let styleFound = false;

        // 检查是否有相关样式表
        for (let i = 0; i < document.styleSheets.length; i++) {
            try {
                const styleSheet = document.styleSheets[i];
                // 尝试访问规则，如果跨域会抛出错误
                if (styleSheet.cssRules) {
                    for (let j = 0; j < styleSheet.cssRules.length; j++) {
                        const rule = styleSheet.cssRules[j];
                        // 检查是否包含调酒模拟器相关的CSS选择器
                        if (rule.selectorText && (
                            rule.selectorText.includes('.cocktail-simulation-container') ||
                            rule.selectorText.includes('.pixel-cocktail-glass')
                        )) {
                            styleFound = true;
                            break;
                        }
                    }
                }
                if (styleFound) break;
            } catch (e) {
                // 跨域错误，忽略
                continue;
            }
        }

        return styleFound;
    },

    // 加载样式表
    loadStyleSheet: function () {
        return new Promise((resolve, reject) => {
            // 检查样式表是否已存在
            if (document.querySelector('link[href*="cocktail-simulation.css"]')) {
                console.log('[调酒模拟器]: 样式表已加载');
                resolve(true);
                return;
            }

            // 创建link元素
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/custom/cocktail-simulation.css';
            link.onload = () => {
                console.log('[调酒模拟器]: 样式表加载成功');
                resolve(true);
            };
            link.onerror = () => {
                console.error('[调酒模拟器]: 样式表加载失败');
                reject(new Error('样式表加载失败'));
            };

            document.head.appendChild(link);
        });
    },

    // 检查DOM结构
    checkDOMStructure: function () {
        const container = document.querySelector('.cocktail-simulation-container');
        if (!container) {
            return { valid: false, message: '未找到模拟器容器' };
        }

        // 检查必要元素
        const requiredElements = [
            '.simulation-workspace',
            '.pixel-cocktail-glass',
            '.pixel-ice-cube',
            '.pixel-bottle',
            '.pixel-liquid',
            '.pixel-stir-rod',
            '.simulation-controls',
            '#add-ice-btn'
        ];

        const missingElements = [];

        for (const selector of requiredElements) {
            if (!container.querySelector(selector)) {
                missingElements.push(selector);
            }
        }

        if (missingElements.length > 0) {
            return {
                valid: false,
                message: `DOM结构不完整，缺少元素: ${missingElements.join(', ')}`
            };
        }

        return { valid: true };
    },

    // 修复模拟器问题
    fixSimulator: function () {
        console.log('[调酒模拟器]: 开始修复模拟器...');

        // 步骤1: 检查样式表
        const hasStyle = this.checkStylesheet();
        if (!hasStyle) {
            console.log('[调酒模拟器]: 未找到样式表，正在加载...');
            this.loadStyleSheet()
                .then(() => this.continueFixing())
                .catch(error => {
                    this.showError('无法加载样式表: ' + error.message);
                });
        } else {
            this.continueFixing();
        }
    },

    // 继续修复流程
    continueFixing: function () {
        // 步骤2: 检查DOM结构
        const domStatus = this.checkDOMStructure();
        if (!domStatus.valid) {
            console.log(`[调酒模拟器]: DOM问题: ${domStatus.message}，正在重建模拟器...`);
            this.rebuildSimulator();
        } else {
            console.log('[调酒模拟器]: DOM结构正常，正在重新绑定事件...');
            // 尝试重新绑定事件
            if (typeof bindSimulationEvents === 'function') {
                try {
                    bindSimulationEvents();
                    console.log('[调酒模拟器]: 事件重新绑定成功');
                } catch (error) {
                    console.error('[调酒模拟器]: 事件绑定失败', error);
                    this.showError('事件绑定失败: ' + error.message);
                }
            } else {
                console.error('[调酒模拟器]: 找不到事件绑定函数');
                this.showError('找不到事件绑定函数，请刷新页面重试');
            }
        }
    },

    // 重建模拟器
    rebuildSimulator: function () {
        try {
            // 如果注入函数可用，直接调用
            if (typeof injectCocktailSimulation === 'function') {
                injectCocktailSimulation();
                setTimeout(() => {
                    if (typeof bindSimulationEvents === 'function') {
                        bindSimulationEvents();
                        console.log('[调酒模拟器]: 模拟器重建成功');
                    }
                }, 500);
            } else {
                // 注入函数不可用，显示重载页面的建议
                this.showError('无法重建模拟器，请刷新页面重试');
            }
        } catch (error) {
            console.error('[调酒模拟器]: 重建失败', error);
            this.showError('重建模拟器失败: ' + error.message);
        }
    }
};

// 页面加载后自动检查调酒模拟器状态
document.addEventListener('DOMContentLoaded', function () {
    // 等待页面完全加载，确保其他脚本已执行
    setTimeout(() => {
        // 检查模拟器是否存在
        const container = document.querySelector('.cocktail-simulation-container');
        if (!container) {
            console.log('[调酒调试工具]: 未检测到模拟器，将尝试加载');
            window.cocktailDebug.showError('未检测到调酒模拟器，点击"修复"按钮尝试恢复');
        } else {
            // 检查DOM结构是否完整
            const domStatus = window.cocktailDebug.checkDOMStructure();
            if (!domStatus.valid) {
                console.log(`[调酒调试工具]: 模拟器DOM结构不完整: ${domStatus.message}`);
                window.cocktailDebug.showError(`模拟器结构不完整: ${domStatus.message}`);
            }

            // 检查样式是否加载
            const hasStyle = window.cocktailDebug.checkStylesheet();
            if (!hasStyle) {
                console.log('[调酒调试工具]: 未检测到模拟器样式');
                window.cocktailDebug.loadStyleSheet()
                    .catch(() => {
                        window.cocktailDebug.showError('模拟器样式加载失败，界面可能不正常显示');
                    });
            }
        }
    }, 2000);
}); 