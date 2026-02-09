// Browser Recorder - Content Script
// 在每个页面上注入，负责捕获用户操作事件

let isRecording = false;
let actionBuffer = [];
let bufferFlushInterval = null;
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL = 100; // ms

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RECORDING_STARTED') {
    startRecording();
    sendResponse({ success: true });
  } else if (message.type === 'RECORDING_STOPPED') {
    stopRecording();
    sendResponse({ success: true });
  }
});

function startRecording() {
  if (isRecording) return;
  
  isRecording = true;
  actionBuffer = [];
  
  // 注册所有事件监听器
  registerEventListeners();
  
  // 启动缓冲区刷新
  bufferFlushInterval = setInterval(flushBuffer, FLUSH_INTERVAL);
  
  console.log('Content script: Recording started');
  
  // 添加视觉指示器
  addRecordingIndicator();
}

function stopRecording() {
  if (!isRecording) return;
  
  isRecording = false;
  
  // 移除所有事件监听器
  removeEventListeners();
  
  // 清除缓冲区
  clearInterval(bufferFlushInterval);
  flushBuffer();
  
  console.log('Content script: Recording stopped. Total actions:', actionBuffer.length);
  
  // 移除视觉指示器
  removeRecordingIndicator();
}

function registerEventListeners() {
  // 点击事件
  document.addEventListener('click', handleClick, true);
  
  // 键盘事件
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  // 滚动事件
  document.addEventListener('scroll', handleScroll, true);
  
  // 输入事件（用于表单）
  document.addEventListener('input', handleInput, true);
  
  // 鼠标移动（可选，用于热图）
  document.addEventListener('mousemove', handleMouseMove, true);
}

function removeEventListeners() {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('keyup', handleKeyUp, true);
  document.removeEventListener('scroll', handleScroll, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
}

// 事件处理器
function handleClick(event) {
  if (!isRecording) return;
  
  const selector = generateSelector(event.target);
  if (!selector) return;
  
  const action = {
    type: 'click',
    timestamp: Date.now(),
    selector: selector,
    tagName: event.target.tagName,
    text: event.target.textContent?.substring(0, 100),
    position: { x: event.clientX, y: event.clientY },
    url: window.location.href
  };
  
  addAction(action);
  event.stopPropagation();
}

function handleKeyDown(event) {
  if (!isRecording) return;
  
  // 只记录有意义的按键（不记录普通字符，input事件会处理）
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) return;
  
  const action = {
    type: 'keydown',
    timestamp: Date.now(),
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    url: window.location.href
  };
  
  addAction(action);
}

function handleKeyUp(event) {
  if (!isRecording) return;
  
  const action = {
    type: 'keyup',
    timestamp: Date.now(),
    key: event.key,
    url: window.location.href
  };
  
  addAction(action);
}

function handleScroll(event) {
  if (!isRecording) return;
  
  const action = {
    type: 'scroll',
    timestamp: Date.now(),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    scrollDirection: getScrollDirection(),
    url: window.location.href
  };
  
  addAction(action);
}

function handleInput(event) {
  if (!isRecording) return;
  
  const target = event.target;
  const action = {
    type: 'input',
    timestamp: Date.now(),
    selector: generateSelector(target),
    tagName: target.tagName,
    inputType: event.inputType,
    // 不记录敏感内容，只记录长度和类型
    hasValue: target.value !== undefined,
    valueLength: target.value?.length || 0,
    url: window.location.href
  };
  
  addAction(action);
}

let lastMousePosition = { x: 0, y: 0 };
let lastScrollY = 0;

function handleMouseMove(event) {
  if (!isRecording) return;
  
  // 每隔一定距离才记录，避免数据过多
  const distance = Math.abs(event.clientX - lastMousePosition.x) + 
                  Math.abs(event.clientY - lastMousePosition.y);
  
  if (distance < 50) return;
  
  const action = {
    type: 'mousemove',
    timestamp: Date.now(),
    x: event.clientX,
    y: event.clientY,
    url: window.location.href
  };
  
  lastMousePosition = { x: event.clientX, y: event.clientY };
  addAction(action);
}

function getScrollDirection() {
  const currentScrollY = window.scrollY;
  const direction = currentScrollY > lastScrollY ? 'down' : 
                    currentScrollY < lastScrollY ? 'up' : 'none';
  lastScrollY = currentScrollY;
  return direction;
}

// 辅助函数
function addAction(action) {
  actionBuffer.push(action);
  
  if (actionBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }
}

function flushBuffer() {
  if (actionBuffer.length === 0) return;
  
  const actionsToSend = [...actionBuffer];
  actionBuffer = [];
  
  chrome.runtime.sendMessage({
    type: 'RECORDED_ACTIONS',
    actions: actionsToSend
  });
}

function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(/\s+/).filter(c => c).slice(0, 3);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // 添加 nth-child 如果有兄弟元素
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

function addRecordingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'browser-recorder-indicator';
  indicator.innerHTML = '🔴 REC';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff4444;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(indicator);
}

function removeRecordingIndicator() {
  const indicator = document.getElementById('browser-recorder-indicator');
  if (indicator) {
    indicator.remove();
  }
}
