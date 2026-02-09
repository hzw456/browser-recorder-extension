// Browser Recorder - Background Service Worker
// 管理录制状态和处理来自 content scripts 和 popup 的消息

let isRecording = false;
let currentTabId = null;
let recordingData = {
  url: '',
  timestamp: Date.now(),
  actions: []
};

// 监听来自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理来自 content script 的录制数据
  if (message.type === 'RECORDED_ACTIONS') {
    if (message.actions && Array.isArray(message.actions)) {
      recordingData.actions.push(...message.actions);
    }
    return;
  }
  
  // 处理来自 popup 的命令
  if (message.type === 'START_RECORDING') {
    startRecording(sender.tab?.id);
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording();
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ isRecording, recordingData });
  } else if (message.type === 'CLEAR_RECORDING') {
    clearRecording();
    sendResponse({ success: true });
  } else if (message.type === 'EXPORT_DATA') {
    exportData(sendResponse);
    return true; // 异步响应
  } else if (message.type === 'IMPORT_DATA') {
    importData(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'START_PLAYBACK') {
    startPlayback(message.data);
  }
});

async function startRecording(tabId) {
  if (isRecording) return;
  
  isRecording = true;
  currentTabId = tabId;
  recordingData = {
    url: '',
    timestamp: Date.now(),
    actions: []
  };
  
  // 获取当前标签页信息
  try {
    const tab = await chrome.tabs.get(tabId);
    recordingData.url = tab.url;
  } catch (e) {
    console.error('Failed to get tab info:', e);
  }
  
  // 通知 content script 开始录制
  chrome.tabs.sendMessage(tabId, { type: 'RECORDING_STARTED' });
  
  console.log('Recording started for tab:', tabId);
}

function stopRecording() {
  if (!isRecording) return;
  
  isRecording = false;
  
  // 通知 content script 停止录制
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'RECORDING_STOPPED' });
  }
  
  console.log('Recording stopped. Total actions:', recordingData.actions.length);
  
  // 保存到存储
  chrome.storage.local.set({ recordingData });
}

function clearRecording() {
  recordingData = {
    url: '',
    timestamp: Date.now(),
    actions: []
  };
  isRecording = false;
  currentTabId = null;
}

function exportData(sendResponse) {
  const dataStr = JSON.stringify(recordingData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `recording-${Date.now()}.json`,
    saveAs: true
  }, (downloadId) => {
    sendResponse({ success: true, downloadId });
  });
}

function importData(data) {
  try {
    recordingData = typeof data === 'string' ? JSON.parse(data) : data;
    isRecording = false;
    chrome.storage.local.set({ recordingData });
  } catch (e) {
    console.error('Failed to import data:', e);
  }
}

async function startPlayback(data) {
  const playbackData = data || recordingData;
  
  // 获取当前活动标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error('No active tab found');
    return;
  }
  
  // 注入 content script 并开始回放
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['playback.js']
  }, () => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'PLAYBACK_STARTED',
      data: playbackData
    });
  });
}
