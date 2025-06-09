// 调酒模拟UI的JavaScript逻辑
document.addEventListener('DOMContentLoaded', function () {
    console.log('调酒模拟器JS加载完成');

    // 首先执行注入函数，确保DOM中有所有需要的元素
    try {
        injectCocktailSimulation();

        // 确保调试工具已加载并可用
        if (window.cocktailDebug) {
            console.log('调试工具已加载，可用于修复问题');
        }

        // 延迟更长一段时间再初始化事件监听，确保DOM已完全就绪
        setTimeout(function () {
            try {
                initializeSimulation();
                // 确保事件被正确绑定
                bindSimulationEvents();
            } catch (err) {
                console.error('初始化调酒模拟器时出错:', err);
                if (window.cocktailDebug && typeof window.cocktailDebug.showError === 'function') {
                    window.cocktailDebug.showError('初始化错误: ' + err.message);
                } else {
                    // 如果调试工具不可用，显示简单的错误信息
                    showSimpleError('调酒模拟器初始化失败: ' + err.message);
                }
            }
        }, 1500);
    } catch (err) {
        console.error('注入调酒模拟器时出错:', err);
        showSimpleError('调酒模拟器加载失败: ' + err.message);
    }
});

// 简单的错误显示
function showSimpleError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background-color: rgba(220, 53, 69, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 9999;
        font-family: sans-serif;
        font-size: 14px;
        max-width: 80%;
    `;
    errorDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">调酒模拟器错误</div>
        <div>${message}</div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        if (document.body.contains(errorDiv)) {
            document.body.removeChild(errorDiv);
        }
    }, 5000);
}

// 初始化模拟器功能
function initializeSimulation() {
    console.log('初始化调酒模拟器事件监听');

    try {
        // 获取DOM元素
        const simulationContainer = document.querySelector('.cocktail-simulation-container');
        if (!simulationContainer) {
            console.error('未找到模拟器容器元素');
            return;
        }

        const iceCubes = document.querySelectorAll('.pixel-ice-cube');
        const bottle = document.querySelector('.pixel-bottle');
        const liquid = document.querySelector('.pixel-liquid');
        const stirRod = document.querySelector('.pixel-stir-rod');
        const glassNotch = document.querySelector('.pixel-glass-notch');

        // 确保bottle元素存在
        if (!bottle) {
            console.error('未找到酒瓶元素');
            return;
        }

        // 检查所有必要的元素是否存在，提供详细日志
        const elements = {
            bottle: bottle,
            liquid: liquid,
            stirRod: stirRod,
            glassNotch: glassNotch
        };

        const missingElements = Object.entries(elements)
            .filter(([_, element]) => !element)
            .map(([name, _]) => name);

        if (missingElements.length > 0) {
            console.error('缺少必要的动画元素:', missingElements.join(', '));
            return;
        }

        // 按钮元素
        // 先尝试使用ID查找
        let addIceBtn = document.getElementById('add-ice-btn');
        let pourLiquidBtn = document.getElementById('pour-liquid-btn');
        let stirBtn = document.getElementById('stir-btn');

        // 如果找不到按ID，尝试使用类选择器（兼容性）
        if (!addIceBtn) addIceBtn = simulationContainer.querySelector('.simulation-btn:nth-child(1)');
        if (!pourLiquidBtn) pourLiquidBtn = simulationContainer.querySelector('.simulation-btn:nth-child(2)');
        if (!stirBtn) stirBtn = simulationContainer.querySelector('.simulation-btn:nth-child(3)');

        // 修复添加事件监听器的方式，确保this上下文正确
        let isAnimating = false; // 防止动画重叠

        // 加冰块动画
        function addIce() {
            console.log('加冰块动画');
            if (!iceCubes || iceCubes.length === 0) {
                console.log('未找到冰块元素');
                return;
            }

            iceCubes.forEach((cube, index) => {
                cube.style.animation = `drop-ice 0.5s ease-in ${index * 0.2}s forwards, float-ice ${3 + index * 0.5}s ease-in-out ${0.7 + index * 0.2}s infinite`;
            });
        }

        // 倒酒动画
        function pourLiquid() {
            console.log('倒酒动画');
            if (!bottle) {
                console.log('未找到酒瓶元素');
                return;
            }
            if (!liquid) {
                console.log('未找到液体元素');
                return;
            }

            bottle.classList.add('pouring');
            liquid.classList.add('pouring');

            setTimeout(() => {
                bottle.classList.remove('pouring');

                // 平滑隐藏酒瓶
                bottle.style.transition = 'opacity 0.8s ease-out, visibility 0.8s ease-out';
                bottle.style.opacity = '0';
                bottle.style.visibility = 'hidden';

                // 更新ABV
                updateLiquidColor();
            }, 3000);
        }

        // 搅拌动画
        function stir() {
            console.log('搅拌动画');
            if (!stirRod) {
                console.log('未找到搅拌棒元素');
                return;
            }
            if (!liquid) {
                console.log('未找到液体元素');
                return;
            }

            // 确保液体已经倒入
            if (!liquid.classList.contains('pouring')) {
                liquid.classList.add('pouring');
            }

            stirRod.classList.add('stirring');
            liquid.classList.add('wavy');

            setTimeout(() => {
                stirRod.classList.remove('stirring');
                liquid.classList.remove('wavy');

                // 搅拌完成后让搅拌棒消失
                stirRod.style.transition = 'opacity 0.8s ease-out, visibility 0.8s ease-out';
                stirRod.style.opacity = '0';
                stirRod.style.visibility = 'hidden';
            }, 3000);
        }

        // 直接绑定事件，不使用事件委托
        console.log('开始绑定按钮事件...');

        // 清除旧事件（通过克隆替换元素）
        function clearEvents(element) {
            if (!element) return null;
            const newElement = element.cloneNode(true);
            if (element.parentNode) {
                element.parentNode.replaceChild(newElement, element);
            }
            return newElement;
        }

        // 清除并重新绑定所有按钮
        addIceBtn = clearEvents(addIceBtn);
        pourLiquidBtn = clearEvents(pourLiquidBtn);
        stirBtn = clearEvents(stirBtn);

        // 重新添加事件，使用匿名函数封装来保持上下文
        if (addIceBtn) {
            console.log('绑定加冰块按钮');
            addIceBtn.addEventListener('click', function (e) {
                console.log('加冰块按钮被点击');
                e.preventDefault();
                addIce(); // 使用当前上下文调用
            });
        }

        if (pourLiquidBtn) {
            console.log('绑定倒入基酒按钮');
            pourLiquidBtn.addEventListener('click', function (e) {
                console.log('倒入基酒按钮被点击');
                e.preventDefault();
                pourLiquid(); // 使用当前上下文调用
            });
        }

        if (stirBtn) {
            console.log('绑定搅拌按钮');
            stirBtn.addEventListener('click', function (e) {
                console.log('搅拌按钮被点击');
                e.preventDefault();
                stir(); // 使用当前上下文调用
            });
        }

        console.log('调酒模拟器初始化完成');
    } catch (e) {
        console.error('初始化调酒模拟器时出现错误:', e);
        throw e; // 重新抛出错误以便外部捕获
    }
}

// 将调酒模拟器添加到页面
function injectCocktailSimulation() {
    console.log('注入调酒模拟器UI');

    try {
        // 找到要插入的位置 - 在酒精含量计算部分
        const abvCalculationSection = document.getElementById('abv-calculation-section');
        if (!abvCalculationSection) {
            console.error('找不到ABV计算部分，无法注入模拟器');
            return;
        }

        // 创建模拟器容器
        const simulationContainer = document.createElement('div');
        simulationContainer.className = 'cocktail-simulation-container';

        simulationContainer.innerHTML = `
            <h3 class="simulation-title">🧊 像素风调酒模拟器</h3>
            
            <div class="simulation-workspace">
                <div class="pixel-grid"></div>
                
                <!-- 像素风鸡尾酒杯 -->
                <div class="pixel-cocktail-glass">
                    <!-- 杯子主体 -->
                    <div class="pixel-glass-top"></div>
                    <div class="pixel-glass-connector"></div>
                    <div class="pixel-glass-stem"></div>
                    <div class="pixel-glass-base"></div>
                    <div class="pixel-glass-shine"></div>
                    
                    <!-- 冰块容器 -->
                    <div class="pixel-ice-container">
                        <div class="pixel-ice-cube pixel-ice-cube-1"></div>
                        <div class="pixel-ice-cube pixel-ice-cube-2"></div>
                        <div class="pixel-ice-cube pixel-ice-cube-3"></div>
                    </div>
                    
                    <!-- 液体 -->
                    <div class="pixel-liquid"></div>
                    
                    <!-- 酒瓶 -->
                    <div class="pixel-bottle">
                        <div class="pixel-bottle-body">
                            <div class="pixel-bottle-liquid-content"></div>
                        </div>
                        <div class="pixel-bottle-neck"></div>
                        <div class="pouring-stream"></div>
                    </div>
                    
                    <!-- 搅拌棒 -->
                    <div class="pixel-stir-rod"></div>
                    
                    <!-- 杯子切口（用于装饰） -->
                    <div class="pixel-glass-notch"></div>
                </div>
            </div>
            
            <div class="simulation-controls">
                <button id="add-ice-btn" class="simulation-btn">🧊 加冰</button>
                <button id="pour-liquid-btn" class="simulation-btn">🍸 倒酒</button>
                <button id="stir-btn" class="simulation-btn">🥄 搅拌</button>
            </div>
        `;

        // 将模拟器插入到ABV计算部分之前
        abvCalculationSection.parentNode.insertBefore(simulationContainer, abvCalculationSection);

        console.log('调酒模拟器UI注入完成');

    } catch (error) {
        console.error('注入调酒模拟器时出错:', error);
        throw error;
    }
}

// bindSimulationEvents 函数保持为兼容性存在
function bindSimulationEvents(container) {
    console.log('绑定调酒模拟器事件 (兼容性函数)');

    try {
        // 重新获取容器，确保是当前DOM中的元素
        const actualContainer = document.querySelector('.cocktail-simulation-container');
        if (!actualContainer) {
            console.error('未找到调酒模拟器容器，跳过事件绑定');
            return;
        }

        // 按钮元素
        const addIceBtn = actualContainer.querySelector('#add-ice-btn');
        const pourLiquidBtn = actualContainer.querySelector('#pour-liquid-btn');
        const stirBtn = actualContainer.querySelector('#stir-btn');

        // 模拟器元素
        const iceCubes = actualContainer.querySelectorAll('.pixel-ice-cube');
        const bottle = actualContainer.querySelector('.pixel-bottle');
        const liquid = actualContainer.querySelector('.pixel-liquid');
        const stirRod = actualContainer.querySelector('.pixel-stir-rod');

        // 加冰块动画
        function addIce() {
            console.log('加冰块动画');
            if (!iceCubes || iceCubes.length === 0) {
                console.log('未找到冰块元素');
                return;
            }

            iceCubes.forEach((cube, index) => {
                cube.style.animation = `drop-ice 0.5s ease-in ${index * 0.2}s forwards, float-ice ${3 + index * 0.5}s ease-in-out ${0.7 + index * 0.2}s infinite`;
            });
        }

        // 倒酒动画
        function pourLiquid() {
            console.log('倒酒动画');
            if (!bottle) {
                console.log('未找到酒瓶元素');
                return;
            }
            if (!liquid) {
                console.log('未找到液体元素');
                return;
            }

            bottle.classList.add('pouring');
            liquid.classList.add('pouring');

            setTimeout(() => {
                bottle.classList.remove('pouring');

                // 平滑隐藏酒瓶
                bottle.style.transition = 'opacity 0.8s ease-out, visibility 0.8s ease-out';
                bottle.style.opacity = '0';
                bottle.style.visibility = 'hidden';

                // 更新ABV
                updateLiquidColor();
            }, 3000);
        }

        // 搅拌动画
        function stir() {
            console.log('搅拌动画');
            if (!stirRod) {
                console.log('未找到搅拌棒元素');
                return;
            }
            if (!liquid) {
                console.log('未找到液体元素');
                return;
            }

            // 确保液体已经倒入
            if (!liquid.classList.contains('pouring')) {
                liquid.classList.add('pouring');
            }

            stirRod.classList.add('stirring');
            liquid.classList.add('wavy');

            setTimeout(() => {
                stirRod.classList.remove('stirring');
                liquid.classList.remove('wavy');

                // 搅拌完成后让搅拌棒消失
                stirRod.style.transition = 'opacity 0.8s ease-out, visibility 0.8s ease-out';
                stirRod.style.opacity = '0';
                stirRod.style.visibility = 'hidden';
            }, 3000);
        }

        // 清除旧事件（通过克隆替换元素）
        function clearEvents(element) {
            if (!element) return null;
            const newElement = element.cloneNode(true);
            if (element.parentNode) {
                element.parentNode.replaceChild(newElement, element);
            }
            return newElement;
        }

        // 清除并重新绑定所有按钮
        let addIceBtnNew = clearEvents(addIceBtn);
        let pourLiquidBtnNew = clearEvents(pourLiquidBtn);
        let stirBtnNew = clearEvents(stirBtn);

        // 重新添加事件
        if (addIceBtnNew) {
            addIceBtnNew.addEventListener('click', function (e) {
                console.log('加冰块按钮被点击');
                e.preventDefault();
                addIce();
            });
        }

        if (pourLiquidBtnNew) {
            pourLiquidBtnNew.addEventListener('click', function (e) {
                console.log('倒入基酒按钮被点击');
                e.preventDefault();
                pourLiquid();
            });
        }

        if (stirBtnNew) {
            stirBtnNew.addEventListener('click', function (e) {
                console.log('搅拌按钮被点击');
                e.preventDefault();
                stir();
            });
        }

        // 获取当前ABV值来设置液体颜色类别
        function updateLiquidColor() {
            const abvValue = parseFloat(document.getElementById('abv-value')?.textContent || '0');
            updateLiquidClassByAbv(abvValue);
        }

        // 根据ABV更新液体颜色类别
        function updateLiquidClassByAbv(abv) {
            const simulationContainer = document.querySelector('.cocktail-simulation-container');
            if (!simulationContainer) return;

            // 清除所有ABV类别
            simulationContainer.classList.remove('abv-low', 'abv-medium', 'abv-high');

            // 根据ABV值添加对应类别
            if (abv < 15) {
                simulationContainer.classList.add('abv-low');
            } else if (abv < 30) {
                simulationContainer.classList.add('abv-medium');
            } else {
                simulationContainer.classList.add('abv-high');
            }
        }

        console.log('调酒模拟器事件绑定完成');

    } catch (error) {
        console.error('绑定调酒模拟器事件时出错:', error);
        throw error;
    }
}

// 获取当前ABV值来设置液体颜色类别
function updateLiquidColor() {
    const abvValue = parseFloat(document.getElementById('abv-value')?.textContent || '0');
    updateLiquidClassByAbv(abvValue);
}

// 根据ABV更新液体颜色类别
function updateLiquidClassByAbv(abv) {
    const simulationContainer = document.querySelector('.cocktail-simulation-container');
    if (!simulationContainer) return;

    // 清除所有ABV类别
    simulationContainer.classList.remove('abv-low', 'abv-medium', 'abv-high');

    // 根据ABV值添加对应类别
    if (abv < 15) {
        simulationContainer.classList.add('abv-low');
    } else if (abv < 30) {
        simulationContainer.classList.add('abv-medium');
    } else {
        simulationContainer.classList.add('abv-high');
    }
}

// 作为备份，在window加载完成后再次尝试初始化
window.addEventListener('load', function () {
    console.log('窗口加载完成，检查调酒模拟器状态');

    setTimeout(function () {
        const container = document.querySelector('.cocktail-simulation-container');
        if (container) {
            // 检查是否已经有按钮事件
            const addIceBtn = container.querySelector('#add-ice-btn');
            if (addIceBtn && !addIceBtn.onclick) {
                console.log('发现模拟器但按钮没有事件，重新绑定事件');
                bindSimulationEvents(container);
            }
        } else {
            // 如果容器不存在，尝试重新创建
            console.log('未找到模拟器容器，尝试重新创建');
            try {
                injectCocktailSimulation();
                setTimeout(function () {
                    bindSimulationEvents();
                }, 500);
            } catch (e) {
                console.error('重新创建模拟器失败:', e);
            }
        }
    }, 2000);
}); 