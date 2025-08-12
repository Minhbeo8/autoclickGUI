// ==UserScript==
// @name         Universal Auto Clicker GUI - Floating Bubbles
// @namespace    http://tampermonkey.net/
// @version      2.0
// @license      MIT
// @description  Visual auto clicker 
// @author       Minhbeo8(hominz) 
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isPlaying = false;
    let clickBubbles = [];
    let playInterval = null;
    let bubbleCounter = 0;
    let totalClicks = 0;
    let isCollapsed = false;
    let deleteTimer = null;
    
    let globalSettings = {
        clickDelay: 1000,
        stopCondition: 'infinite',
        timeLimit: 300,
        clickCount: 1000,
        antiDetection: true,
        clickSound: false,
        visualFeedback: true,
        stealthMode: true,
        stealthMethod: 'advanced'
    };
    
    let startTime = null;

    const CLICK_PRESETS = {
        human: {
            name: "Human-like",
            delay: 150,
            description: "Giống người thật"
        },
        fast: {
            name: "Fast",
            delay: 100,
            description: "Nhanh"
        },
        insane: {
            name: "Insane",
            delay: 50,
            description: "Siêu nhanh"
        },
        godmode: {
            name: "God Mode",
            delay: 25,
            description: "Thần thánh"
        },
        ultrasonic: {
            name: "Ultrasonic",
            delay: 10,
            description: "Siêu âm"
        }
    };

    function addStyle() {
        if (document.getElementById('autoclicker-style')) return;
        const style = document.createElement('style');
        style.id = 'autoclicker-style';
        style.textContent = `
            #auto-clicker-panel {
                position: fixed;
                top: 50%;
                left: 10px;
                transform: translateY(-50%);
                width: 70px;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                padding: 10px;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                font-family: Arial, sans-serif;
                user-select: none;
                transition: all 0.3s ease-in-out;
            }

            #auto-clicker-panel.collapsed {
                width: 50px;
                padding: 5px;
                border-radius: 10px;
            }

            .control-btn {
                width: 50px;
                height: 50px;
                margin: 8px 0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            }
            
            #auto-clicker-panel.collapsed .control-btn {
                width: 40px;
                height: 40px;
                margin: 5px 0;
            }
            
            #auto-clicker-panel.collapsed .control-btn:not([data-action="play"]):not([data-action="toggle-collapse-and-move"]) {
                display: none;
            }

            #auto-clicker-panel.collapsed .control-btn[data-action="toggle-collapse-and-move"],
            #auto-clicker-panel.collapsed .control-btn[data-action="play"] {
                 border-radius: 10px;
            }

            .control-btn:hover {
                transform: scale(1.15);
                box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            }

            .click-bubble {
                position: fixed;
                width: 50px;
                height: 50px;
                background: linear-gradient(145deg, #2196F3, #1976D2);
                border: 3px solid #FFF;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: move;
                font-size: 18px;
                font-weight: bold;
                color: white;
                z-index: 9999;
                box-shadow: 0 8px 25px rgba(33, 150, 243, 0.5);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                user-select: none;
                will-change: transform;
            }
        `;
        document.head.appendChild(style);
    }
    
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'auto-clicker-panel';

        const controls = [
            { icon: '▶️', action: 'play', title: 'Play/Pause', color: '#4CAF50' },
            { icon: '➕', action: 'add', title: 'Add Click Point', color: '#2196F3' },
            { icon: '🗑️', action: 'clear', title: 'Clear Last / Hold to Clear All', color: '#F44336' },
            { icon: '⚙️', action: 'settings', title: 'Global Settings', color: '#9C27B0' },
            { icon: '⇕', action: 'toggle-collapse-and-move', title: 'Collapse/Expand Panel', color: '#607D8B' }
        ];

        controls.forEach(ctrl => {
            const btn = document.createElement('div');
            btn.className = 'control-btn';
            btn.style.background = ctrl.color;
            btn.innerHTML = ctrl.icon;
            btn.title = ctrl.title;
            btn.dataset.action = ctrl.action;
            
            if (ctrl.action === 'clear') {
                btn.addEventListener('mousedown', handleDeleteDown);
                btn.addEventListener('touchstart', handleDeleteDown);
                btn.addEventListener('mouseup', handleDeleteUp);
                btn.addEventListener('touchend', handleDeleteUp);
            } else {
                btn.addEventListener('click', handleControlClick);
            }

            panel.appendChild(btn);
        });

        document.body.appendChild(panel);
        makeDraggable(panel);
        return panel;
    }

    function handleDeleteDown(e) {
        e.preventDefault();
        deleteTimer = setTimeout(() => {
            if (confirm('Xóa tất cả các điểm click?')) {
                clearAllBubbles();
            }
        }, 1000);
    }

    function handleDeleteUp(e) {
        clearTimeout(deleteTimer);
        if (e.target.dataset.action === 'clear' && clickBubbles.length > 0) {
            removeLastBubble();
        }
    }

    function removeLastBubble() {
        if (clickBubbles.length > 0) {
            const lastBubble = clickBubbles.pop();
            lastBubble.element.remove();
            if (clickBubbles.length === 0) {
                bubbleCounter = 0;
            }
            showToast(`Đã xóa điểm click ${lastBubble.id}`);
        }
    }

    function toggleCollapse() {
        const panel = document.getElementById('auto-clicker-panel');
        const toggleBtn = document.querySelector('[data-action="toggle-collapse-and-move"]');
        
        isCollapsed = !isCollapsed;

        if (isCollapsed) {
            panel.classList.add('collapsed');
            toggleBtn.innerHTML = '↔️';
            hideBubbles();
            showToast('Panel collapsed, auto-clicker still running');
        } else {
            panel.classList.remove('collapsed');
            toggleBtn.innerHTML = '⇕';
            showBubbles();
            showToast('Panel expanded');
        }
    }

    function hideBubbles() {
        clickBubbles.forEach(bubble => {
            if (bubble.element) {
                bubble.element.style.display = 'none';
            }
        });
    }

    function showBubbles() {
        clickBubbles.forEach(bubble => {
            if (bubble.element) {
                bubble.element.style.display = 'flex';
            }
        });
    }

    function createClickBubble(x = null, y = null) {
        bubbleCounter++;
        
        const bubble = document.createElement('div');
        bubble.className = 'click-bubble';
        bubble.dataset.bubbleId = bubbleCounter;
        
        const posX = x || window.innerWidth / 2;
        const posY = y || window.innerHeight / 2;
        
        bubble.style.left = `${posX - 25}px`;
        bubble.style.top = `${posY - 25}px`;
        bubble.style.display = isCollapsed ? 'none' : 'flex';
        
        bubble.innerHTML = bubbleCounter;
        
        bubble.addEventListener('mouseenter', () => {
            if (!bubble._isDragging || !bubble._isDragging()) {
                bubble.style.transform = 'scale(1.2)';
                bubble.style.boxShadow = '0 10px 30px rgba(33, 150, 243, 0.8)';
            }
        });
        
        bubble.addEventListener('mouseleave', () => {
            if (!bubble._isDragging || !bubble._isDragging()) {
                bubble.style.transform = 'scale(1)';
                bubble.style.boxShadow = '0 8px 25px rgba(33, 150, 243, 0.5)';
            }
        });
        
        document.body.appendChild(bubble);
        makeBubbleDraggable(bubble);
        
        clickBubbles.push({
            id: bubbleCounter,
            element: bubble,
            x: posX,
            y: posY,
            settings: {
                clickDelay: globalSettings.clickDelay,
            }
        });
        
        showToast(`Click point ${bubbleCounter} added!`);
        
        return bubble;
    }

    function handleControlClick(e) {
        e.stopPropagation();
        const action = e.target.closest('.control-btn').dataset.action;
        
        switch(action) {
            case 'play':
                togglePlay();
                break;
            case 'add':
                createClickBubble();
                break;
            case 'settings':
                showGlobalSettings();
                break;
            case 'toggle-collapse-and-move':
                toggleCollapse();
                break;
        }
    }

    function togglePlay() {
        const playBtn = document.querySelector('[data-action="play"]');
        
        if (isPlaying) {
            if (playInterval) {
                clearTimeout(playInterval);
            }
            isPlaying = false;
            playBtn.innerHTML = '▶️';
            playBtn.style.background = '#4CAF50';
            resetBubbleStyles();
            showToast('Auto clicking stopped');
        } else {
            if (clickBubbles.length === 0) {
                showToast('Please add some click points first!');
                return;
            }
            
            isPlaying = true;
            startTime = Date.now();
            totalClicks = 0;
            playBtn.innerHTML = '⏸️';
            playBtn.style.background = '#FF5722';
            startAutoClicking();
            showToast('Auto clicking started');
        }
    }

    function startAutoClicking() {
        let currentIndex = 0;
        
        const performNextClick = () => {
            if (!isPlaying) return;
            
            if (shouldStopClicking(totalClicks, startTime)) {
                togglePlay();
                return;
            }
            
            if (clickBubbles.length === 0) {
                togglePlay();
                return;
            }
            
            const currentBubble = clickBubbles[currentIndex];
            if (!currentBubble || !document.body.contains(currentBubble.element)) {
                currentIndex = (currentIndex + 1) % clickBubbles.length;
                return;
            }
            
            highlightBubble(currentBubble);
            
            performClickAt(currentBubble);
            
            totalClicks++;
            
            currentIndex = (currentIndex + 1) % clickBubbles.length;
        };
        
        const getNextDelay = (bubble) => {
            let delay = bubble.settings.clickDelay || globalSettings.clickDelay;
            if (globalSettings.antiDetection) {
                const variation = delay * 0.2;
                delay += (Math.random() - 0.5) * 2 * variation;
            }
            return Math.max(10, delay);
        };
        
        const scheduleNext = () => {
            if (isPlaying) {
                let currentBubble = clickBubbles[currentIndex];
                let nextDelay = getNextDelay(currentBubble);

                playInterval = setTimeout(() => {
                    performNextClick();
                    scheduleNext();
                }, nextDelay);
            }
        };
        
        performNextClick();
        scheduleNext();
    }
    
    function shouldStopClicking(totalClicks, startTime) {
        switch(globalSettings.stopCondition) {
            case 'infinite':
                return false;
            case 'time':
                const elapsed = (Date.now() - startTime) / 1000;
                return elapsed >= globalSettings.timeLimit;
            case 'count':
                return totalClicks >= globalSettings.clickCount;
            default:
                return false;
        }
    }

    function highlightBubble(bubble) {
        if (isCollapsed) return;
        resetBubbleStyles();
        
        const originalNumber = bubble.element.innerHTML;
        
        bubble.element.style.background = 'linear-gradient(145deg, #4CAF50, #388E3C)';
        bubble.element.style.transform = 'scale(1.3)';
        bubble.element.style.boxShadow = '0 12px 35px rgba(76, 175, 80, 0.8)';
        
        setTimeout(() => {
            if (bubble.element && document.body.contains(bubble.element)) {
                bubble.element.style.background = 'linear-gradient(145deg, #2196F3, #1976D2)';
                bubble.element.style.transform = 'scale(1)';
                bubble.element.style.boxShadow = '0 8px 25px rgba(33, 150, 243, 0.5)';
                bubble.element.innerHTML = originalNumber;
            }
        }, 300);
    }

    function resetBubbleStyles() {
        clickBubbles.forEach(bubble => {
            if (bubble.element && document.body.contains(bubble.element)) {
                bubble.element.style.background = 'linear-gradient(145deg, #2196F3, #1976D2)';
                bubble.element.style.transform = 'scale(1)';
                bubble.element.style.boxShadow = '0 8px 25px rgba(33, 150, 243, 0.5)';
            }
        });
    }
    
    function performClickAt(bubble) {
        const rect = bubble.element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        bubble.element.style.pointerEvents = 'none';
        const targetElement = document.elementFromPoint(x, y);
        bubble.element.style.pointerEvents = 'auto';
        
        if (!targetElement) return;

        if (globalSettings.stealthMode && isClickTestSite()) {
            performStealthClick(targetElement, x, y);
        } else {
            simulateRealClick(targetElement, x, y);
        }

        if (globalSettings.visualFeedback && !isCollapsed) {
            createClickEffect(x, y);
        }
        if (globalSettings.clickSound) {
            playClickSound();
        }
    }
    
    function performStealthClick(targetElement, x, y) {
        const randomX = x + (Math.random() - 0.5) * 4;
        const randomY = y + (Math.random() - 0.5) * 4;
        
        simulateRealClick(targetElement, randomX, randomY);
        tryDirectScoreManipulation();
    }

    function simulateRealClick(element, x, y) {
        const eventOptions = {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: 1,
            detail: 1
        };
        
        const mouseEvents = ['mousedown', 'mouseup', 'click'];
        
        let lastEventDelay = 0;
        
        mouseEvents.forEach(eventName => {
            lastEventDelay += Math.random() * 5;
            setTimeout(() => {
                const event = new MouseEvent(eventName, eventOptions);
                element.dispatchEvent(event);
            }, lastEventDelay);
        });
    }

    function tryDirectScoreManipulation() {
        const scoreSelectors = [
            '#clicks', '#score', '#counter', '#cps',
            '.clicks', '.score', '.counter', '.cps',
            '[class*="click"]', '[id*="click"]',
            '[class*="score"]', '[id*="score"]',
            '#clicks-per-second',
            '#hits'
        ];
        
        scoreSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = element.textContent || element.value;
                    if (text && !isNaN(parseInt(text))) {
                        const currentValue = parseInt(text);
                        const newValue = currentValue + 1;
                        
                        if (element.tagName === 'INPUT') {
                            element.value = newValue;
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                        } else {
                            element.textContent = newValue;
                        }
                    }
                });
            } catch (e) {
                
            }
        });
    }

    function isClickTestSite() {
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();
        
        const clickTestIndicators = [
            'clickspeed', 'cpstest', 'click-test', 'clicks-per-second',
            'clicker', 'click speed', 'cps', 'click test'
        ];
        
        return clickTestIndicators.some(indicator => 
            url.includes(indicator) || title.includes(indicator)
        );
    }
    
    function createClickEffect(x, y) {
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: fixed;
            left: ${x - 10}px;
            top: ${y - 10}px;
            width: 20px;
            height: 20px;
            background: #FFD700;
            border-radius: 50%;
            pointer-events: none;
            z-index: 10001;
            animation: clickEffect 0.6s ease-out forwards;
        `;
        
        if (!document.getElementById('click-effect-style')) {
            const style = document.createElement('style');
            style.id = 'click-effect-style';
            style.textContent = `
                @keyframes clickEffect {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(3); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(effect);
        setTimeout(() => effect.remove(), 600);
    }
    
    function playClickSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9QDQBXQVZFZm10IBAAAAABAAEARKwAAIhYBAACABAAZGF0YU'+btoa(String.fromCharCode(...new Array(44100).fill(0).map((_, i) => 128 + 30 * Math.sin(i * 0.1) * (1 - i / 44100))))+'');
            audio.volume = 0.5;
            audio.play();
        } catch (e) {
            
        }
    }

    function clearAllBubbles() {
        if (isPlaying) {
            togglePlay();
        }
        
        clickBubbles.forEach(bubble => bubble.element.remove());
        clickBubbles = [];
        bubbleCounter = 0;
        showToast('All click points cleared!');
    }

    function showGlobalSettings() {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10003;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
            border-radius: 15px;
            padding: 0;
            width: 400px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 70px rgba(0,0,0,0.9);
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            border: 2px solid #333;
        `;
        
        const currentCPS = Math.round(1000 / globalSettings.clickDelay);
        
        dialog.innerHTML = `
            <div style="
                background: linear-gradient(45deg, #FF6B35, #F7931E);
                padding: 20px;
                border-radius: 15px 15px 0 0;
                text-align: center;
                position: relative;
            ">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">
                    ⚡ Speed Settings ⚡
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Current: ${currentCPS} CPS
                </div>
                <div style="
                    position: absolute;
                    top: 15px;
                    right: 20px;
                    background: rgba(255,255,255,0.2);
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    font-weight: bold;
                ">
                    🎯 CPS MODE
                </div>
            </div>
            
            <div style="padding: 25px;">
                <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #FF6B35; font-size: 18px;">
                        🚀 Speed Presets
                    </h3>
                    <div id="speed-presets" style="display: grid; gap: 10px;">
                        ${Object.entries(CLICK_PRESETS).map(([key, preset]) => `
                            <div class="preset-option" data-preset="${key}" style="
                                background: linear-gradient(135deg, #333, #444);
                                border: 2px solid ${currentCPS === Math.round(1000/preset.delay) ? '#FF6B35' : '#555'};
                                border-radius: 10px;
                                padding: 15px;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            ">
                                <div>
                                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">
                                        ${preset.name}
                                    </div>
                                    <div style="color: #bbb; font-size: 12px;">
                                        ${preset.description}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #FF6B35; font-weight: bold; font-size: 18px;">
                                        ${Math.round(1000/preset.delay)}
                                    </div>
                                    <div style="color: #aaa; font-size: 11px;">
                                        CPS
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <h4 style="margin: 0 0 15px 0; color: #FF6B35;">🎛️ Custom Speed</h4>
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; font-size: 14px; color: #ccc; margin-bottom: 8px;">
                                Delay (ms):
                            </label>
                            <input type="number" id="custom-delay" value="${globalSettings.clickDelay}" min="1" max="5000" style="
                                background: #444;
                                border: 2px solid #666;
                                border-radius: 8px;
                                padding: 12px;
                                color: white;
                                width: 100%;
                                font-size: 16px;
                                text-align: center;
                            ">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; font-size: 14px; color: #ccc; margin-bottom: 8px;">
                                Result CPS:
                            </label>
                            <div id="cps-display" style="
                                background: #222;
                                border: 2px solid #FF6B35;
                                border-radius: 8px;
                                padding: 12px;
                                color: #FF6B35;
                                font-size: 20px;
                                font-weight: bold;
                                text-align: center;
                            ">${currentCPS}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="quick-btn" data-delay="1000" style="
                            background: #666;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 12px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            flex: 1;
                        ">1s (1 CPS)</button>
                        <button class="quick-btn" data-delay="500" style="
                            background: #666;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 12px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            flex: 1;
                        ">0.5s (2 CPS)</button>
                        <button class="quick-btn" data-delay="100" style="
                            background: #666;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 12px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            flex: 1;
                        ">0.1s (10 CPS)</button>
                    </div>
                </div>
                
                <div style="
                    background: rgba(244,67,54,0.1);
                    border: 1px solid rgba(244,67,54,0.3);
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: flex-start;
                ">
                    <span style="font-size: 20px; margin-right: 12px;">⚠️</span>
                    <div>
                        <div style="font-weight: bold; margin-bottom: 8px; color: #FF5252;">
                            Lưu ý quan trọng:
                        </div>
                        <div style="font-size: 14px; color: #ddd; line-height: 1.4;">
                            • Delay quá thấp có thể làm trình duyệt lag<br>
                            • Một số site có thể phát hiện auto clicker<br>
                            • Chỉ dùng cho mục đích test/giải trí
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        background: #666;
                        border: none;
                        border-radius: 8px;
                        padding: 12px 24px;
                        color: white;
                        cursor: pointer;
                        font-weight: 500;
                    ">Cancel</button>
                    <button id="apply-btn" style="
                        background: linear-gradient(45deg, #FF6B35, #F7931E);
                        border: none;
                        border-radius: 8px;
                        padding: 12px 24px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                        box-shadow: 0 4px 15px rgba(255,107,53,0.4);
                    ">🚀 APPLY</button>
                </div>
            </div>
        `;
        
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        
        const delayInput = dialog.querySelector('#custom-delay');
        const cpsDisplay = dialog.querySelector('#cps-display');
        
        delayInput.oninput = () => {
            const delay = parseInt(delayInput.value) || 1000;
            const cps = Math.round(1000 / delay);
            cpsDisplay.textContent = cps > 999 ? '999+' : cps;
            cpsDisplay.style.color = cps > 50 ? '#FF5252' : cps > 20 ? '#FF9800' : '#FF6B35';
        };
        
        dialog.querySelectorAll('.preset-option').forEach(preset => {
            preset.onclick = () => {
                dialog.querySelectorAll('.preset-option').forEach(p => 
                    p.style.border = '2px solid #555'
                );
                preset.style.border = '2px solid #FF6B35';
                
                const presetKey = preset.dataset.preset;
                const presetData = CLICK_PRESETS[presetKey];
                delayInput.value = presetData.delay;
                delayInput.dispatchEvent(new Event('input'));
            };
            
            preset.onmouseenter = () => {
                if (!preset.style.border.includes('#FF6B35')) {
                    preset.style.border = '2px solid #777';
                    preset.style.background = 'linear-gradient(135deg, #444, #555)';
                }
            };
            preset.onmouseleave = () => {
                if (!preset.style.border.includes('#FF6B35')) {
                    preset.style.border = '2px solid #555';
                    preset.style.background = 'linear-gradient(135deg, #333, #444)';
                }
            };
        });
        
        dialog.querySelectorAll('.quick-btn').forEach(btn => {
            btn.onclick = () => {
                delayInput.value = btn.dataset.delay;
                delayInput.dispatchEvent(new Event('input'));
            };
        });
        
        dialog.querySelector('#apply-btn').onclick = () => {
            const newDelay = parseInt(delayInput.value) || 1000;
            globalSettings.clickDelay = newDelay;
            
            const cps = Math.round(1000 / newDelay);
            showToast(`🚀 Speed updated: ${cps} CPS (${newDelay}ms delay)`);
            backdrop.remove();
        };
        
        dialog.querySelector('#cancel-btn').onclick = () => {
            backdrop.remove();
        };
        
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                backdrop.remove();
            }
        };
    }
    
    function showBubbleSettings(bubbleData) {
        const bubbleId = bubbleData.id;
        
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10003;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #424242;
            border-radius: 8px;
            padding: 20px;
            width: 320px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;
        
        let displayDelay, displayUnit;
        const currentDelaySeconds = bubbleData.settings.clickDelay / 1000;
        
        if (currentDelaySeconds >= 60) {
            displayDelay = (currentDelaySeconds / 60).toFixed(2);
            displayUnit = 'min';
        } else if (currentDelaySeconds < 1) {
            displayDelay = bubbleData.settings.clickDelay.toFixed(0);
            displayUnit = 'ms';
        } else {
            displayDelay = currentDelaySeconds.toFixed(2);
            displayUnit = 's';
        }
        
        dialog.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 25px;
                color: #2196F3;
            ">
                <span style="font-size: 18px; font-weight: 500;">
                    <span style="font-size: 24px; font-weight: bold; margin-right: 8px;">${bubbleId}</span>
                    Thời gian trễ
                </span>
                <span style="font-size: 14px; color: #9E9E9E;">(Mặc định: ${globalSettings.clickDelay/1000}s)</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 30px;">
                <input type="number" id="bubble-delay-input" value="${displayDelay}" min="0.01" step="0.01" style="
                    background: #555;
                    border: 1px solid #777;
                    border-radius: 4px;
                    padding: 12px;
                    color: white;
                    width: 120px;
                    text-align: center;
                    outline: none;
                    font-size: 16px;
                    flex-grow: 1;
                ">
                <select id="bubble-time-unit" style="
                    background: #555;
                    border: 1px solid #777;
                    border-radius: 4px;
                    padding: 12px 15px;
                    color: white;
                    cursor: pointer;
                    outline: none;
                    font-size: 16px;
                ">
                    <option value="ms" ${displayUnit === 'ms' ? 'selected' : ''}>mili giây</option>
                    <option value="s" ${displayUnit === 's' ? 'selected' : ''}>giây</option>
                    <option value="min" ${displayUnit === 'min' ? 'selected' : ''}>phút</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="cancel-btn" style="
                    background: #666;
                    border: none;
                    border-radius: 6px;
                    padding: 12px 24px;
                    color: white;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    text-transform: uppercase;
                ">HỦY</button>
                <button id="ok-btn" style="
                    background: #2196F3;
                    border: none;
                    border-radius: 6px;
                    padding: 12px 24px;
                    color: white;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    text-transform: uppercase;
                ">OK</button>
            </div>
        `;
        
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        
        const delayInput = dialog.querySelector('#bubble-delay-input');
        const timeUnit = dialog.querySelector('#bubble-time-unit');

        dialog.querySelector('#ok-btn').onclick = () => {
            const value = parseFloat(delayInput.value);
            const unit = timeUnit.value;
            
            if (!isNaN(value) && value > 0) {
                let newDelay;
                switch(unit) {
                    case 'ms':
                        newDelay = value;
                        break;
                    case 's':
                        newDelay = value * 1000;
                        break;
                    case 'min':
                        newDelay = value * 60 * 1000;
                        break;
                    default:
                        newDelay = value * 1000;
                }
                
                bubbleData.settings.clickDelay = newDelay;
                const unitText = unit === 'ms' ? 'mili giây' : unit === 's' ? 'giây' : 'phút';
                showToast(`Đã lưu: Delay ${delayInput.value} ${unitText} cho điểm ${bubbleId}`);
            }
            backdrop.remove();
        };
        
        dialog.querySelector('#cancel-btn').onclick = () => {
            backdrop.remove();
        };
        
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                backdrop.remove();
            }
        };
        
        delayInput.focus();
        delayInput.select();
        
        const buttons = dialog.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.opacity = '0.8';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '1';
            });
        });
    }
    
    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10004;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border-left: 4px solid #2196F3;
            animation: fadeIn 0.3s ease-out forwards;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        if (!document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.textContent = `
                @keyframes fadeIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function makeDraggable(element) {
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        element.onmousedown = dragMouseDown;
        element.ontouchstart = dragTouchStart;
        
        function dragMouseDown(e) {
            if (e.target.dataset.action && e.target.dataset.action !== 'toggle-collapse-and-move') {
                return;
            }
            isDragging = true;
            e.preventDefault();
            offset.x = e.clientX - element.offsetLeft;
            offset.y = e.clientY - element.offsetTop;
            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        }
        
        function dragTouchStart(e) {
            if (e.target.dataset.action && e.target.dataset.action !== 'toggle-collapse-and-move') {
                return;
            }
            isDragging = true;
            const touch = e.touches[0];
            offset.x = touch.clientX - element.offsetLeft;
            offset.y = touch.clientY - element.offsetTop;
            document.addEventListener('touchmove', elementDrag);
            document.addEventListener('touchend', closeDragElement);
        }

        function elementDrag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            element.style.left = (clientX - offset.x) + "px";
            element.style.top = (clientY - offset.y) + "px";
        }
        
        function closeDragElement() {
            isDragging = false;
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
            document.removeEventListener('touchmove', elementDrag);
            document.removeEventListener('touchend', closeDragElement);
        }
    }

    function makeBubbleDraggable(bubble) {
        let isDragging = false;
        let dragStarted = false;
        let startX, startY;
        let initialMouseX, initialMouseY;
        let currentX, currentY;
        let rafId = null;
        
        bubble.addEventListener('mousedown', handleStart, true);
        bubble.addEventListener('touchstart', handleTouchStart, { passive: false });
        
        function handleStart(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = false;
            dragStarted = false;
            
            const rect = bubble.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
        }
        
        function handleTouchStart(e) {
            e.preventDefault();
            const touch = e.touches[0];
            
            isDragging = false;
            dragStarted = false;
            
            const rect = bubble.getBoundingClientRect();
            startX = touch.clientX - rect.left;
            startY = touch.clientY - rect.top;
            initialMouseX = touch.clientX;
            initialMouseY = touch.clientY;
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleEnd);
        }
        
        function handleMove(e) {
            const deltaX = Math.abs(e.clientX - initialMouseX);
            const deltaY = Math.abs(e.clientY - initialMouseY);
            
            if (!dragStarted && (deltaX > 5 || deltaY > 5)) {
                dragStarted = true;
                isDragging = true;
                
                bubble.style.transition = 'none';
                bubble.style.transform = 'scale(1.1)';
                bubble.style.zIndex = '10001';
            }
            
            if (isDragging) {
                currentX = e.clientX - startX;
                currentY = e.clientY - startY;
                
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
                
                rafId = requestAnimationFrame(updateBubblePosition);
            }
        }
        
        function handleTouchMove(e) {
            e.preventDefault();
            const touch = e.touches[0];
            
            const deltaX = Math.abs(touch.clientX - initialMouseX);
            const deltaY = Math.abs(touch.clientY - initialMouseY);
            
            if (!dragStarted && (deltaX > 5 || deltaY > 5)) {
                dragStarted = true;
                isDragging = true;
                
                bubble.style.transition = 'none';
                bubble.style.transform = 'scale(1.1)';
                bubble.style.zIndex = '10001';
            }
            
            if (isDragging) {
                currentX = touch.clientX - startX;
                currentY = touch.clientY - startY;
                
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
                
                rafId = requestAnimationFrame(updateBubblePosition);
            }
        }
        
        function updateBubblePosition() {
            const maxX = window.innerWidth - bubble.offsetWidth;
            const maxY = window.innerHeight - bubble.offsetHeight;
            
            const newX = Math.max(0, Math.min(currentX, maxX));
            const newY = Math.max(0, Math.min(currentY, maxY));
            
            bubble.style.left = newX + 'px';
            bubble.style.top = newY + 'px';
            
            const bubbleId = parseInt(bubble.dataset.bubbleId);
            const bubbleData = clickBubbles.find(b => b.id === bubbleId);
            if (bubbleData) {
                bubbleData.x = newX + bubble.offsetWidth / 2;
                bubbleData.y = newY + bubble.offsetHeight / 2;
            }
        }
        
        function handleEnd(e) {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
            
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            bubble.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
            bubble.style.transform = 'scale(1)';
            bubble.style.zIndex = '9999';
            
            if (!dragStarted) {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    const bubbleId = parseInt(bubble.dataset.bubbleId);
                    const bubbleData = clickBubbles.find(b => b.id === bubbleId);
                    if (bubbleData) {
                         showBubbleSettings(bubbleData);
                    }
                }, 50);
            }
            
            setTimeout(() => {
                isDragging = false;
                dragStarted = false;
            }, 100);
        }
        
        bubble._isDragging = () => isDragging;
    }

    function init() {
        addStyle();
        createControlPanel();
        
        showToast('Auto Clicker loaded! Click ➕ để thêm điểm click.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
