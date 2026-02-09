// Browser Recorder - Playback Script
// 回放录制的用户操作

let isPlaying = false;
let playbackData = null;
let currentActionIndex = 0;
let playbackInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLAYBACK_STARTED') {
    startPlayback(message.data);
  } else if (message.type === 'PLAYBACK_STOPPED') {
    stopPlayback();
  } else if (message.type === 'PLAYBACK_PAUSED') {
    pausePlayback();
  }
});

function startPlayback(data) {
  if (isPlaying) return;
  
  playbackData = data;
  currentActionIndex = 0;
  isPlaying = true;
  
  console.log('Playback started. Total actions:', playbackData.actions.length);
  
  // 添加回放指示器
  addPlaybackIndicator();
  
  // 开始回放
  executeNextAction();
}

function stopPlayback() {
  isPlaying = false;
  if (playbackInterval) {
    clearTimeout(playbackInterval);
    playbackInterval = null;
  }
  removePlaybackIndicator();
  console.log('Playback stopped');
}

function pausePlayback() {
  if (playbackInterval) {
    clearTimeout(playbackInterval);
    playbackInterval = null;
  }
  updatePlaybackIndicator('⏸️ PAUSED');
}

function executeNextAction() {
  if (!isPlaying || !playbackData || currentActionIndex >= playbackData.actions.length) {
    stopPlayback();
    updatePlaybackIndicator('✅ COMPLETED');
    return;
  }
  
  const action = playbackData.actions[currentActionIndex];
  currentActionIndex++;
  
  try {
    executeAction(action);
    
    // 计算下一个动作的时间间隔
    let nextDelay = 50; // 默认间隔
    if (currentActionIndex < playbackData.actions.length) {
      const nextAction = playbackData.actions[currentActionIndex];
      nextDelay = Math.min(nextAction.timestamp - action.timestamp, 5000);
      nextDelay = Math.max(nextDelay, 10); // 最小间隔
    }
    
    playbackInterval = setTimeout(executeNextAction, nextDelay);
    updatePlaybackIndicator(`▶️ PLAYING (${currentActionIndex}/${playbackData.actions.length})`);
    
  } catch (e) {
    console.error('Failed to execute action:', action, e);
    // 继续下一个动作
    executeNextAction();
  }
}

function executeAction(action) {
  switch (action.type) {
    case 'click':
      executeClick(action);
      break;
    case 'keydown':
      executeKeyDown(action);
      break;
    case 'keyup':
      executeKeyUp(action);
      break;
    case 'scroll':
      executeScroll(action);
      break;
    case 'input':
      executeInput(action);
      break;
    case 'mousemove':
      executeMouseMove(action);
      break;
    default:
      console.log('Unknown action type:', action.type);
  }
}

function executeClick(action) {
  const element = findElement(action.selector);
  if (element) {
    element.click();
    highlightElement(element);
  } else {
    console.warn('Element not found:', action.selector);
  }
}

function executeKeyDown(action) {
  const event = new KeyboardEvent('keydown', {
    key: action.key,
    code: action.code,
    ctrlKey: action.ctrlKey || false,
    metaKey: action.metaKey || false,
    shiftKey: action.shiftKey || false,
    altKey: action.altKey || false,
    bubbles: true
  });
  document.dispatchEvent(event);
}

function executeKeyUp(action) {
  const event = new KeyboardEvent('keyup', {
    key: action.key,
    code: action.code,
    bubbles: true
  });
  document.dispatchEvent(event);
}

function executeScroll(action) {
  window.scrollTo(action.scrollX, action.scrollY);
}

function executeInput(action) {
  const element = findElement(action.selector);
  if (element) {
    // 模拟输入
    const event = new Event('input', { bubbles: true });
    element.value = '*'.repeat(action.valueLength); // 使用占位符
    element.dispatchEvent(event);
  }
}

function executeMouseMove(action) {
  // 可选：移动鼠标
  // 注意：鼠标移动通常不需要精确回放
}

function findElement(selector) {
  if (!selector) return null;
  
  try {
    return document.querySelector(selector);
  } catch (e) {
    return null;
  }
}

function highlightElement(element) {
  const originalStyle = element.style.outline;
  element.style.outline = '3px solid #ff4444';
  
  setTimeout(() => {
    element.style.outline = originalStyle;
  }, 200);
}

let indicatorElement = null;

function addPlaybackIndicator() {
  if (indicatorElement) return;
  
  indicatorElement = document.createElement('div');
  indicatorElement.id = 'browser-recorder-playback-indicator';
  indicatorElement.innerHTML = '▶️ PLAYING';
  indicatorElement.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4444ff;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(indicatorElement);
}

function updatePlaybackIndicator(text) {
  if (indicatorElement) {
    indicatorElement.innerHTML = text;
  }
}

function removePlaybackIndicator() {
  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }
}
