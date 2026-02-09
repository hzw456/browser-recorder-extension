// Browser Recorder - Popup Script
// 管理 popup 界面的交互

let currentRecordingData = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  loadRecordingData();
  setupEventListeners();
});

function initializeUI() {
  updateStatus(false);
}

function setupEventListeners() {
  document.getElementById('startBtn').addEventListener('click', startRecording);
  document.getElementById('stopBtn').addEventListener('click', stopRecording);
  document.getElementById('playBtn').addEventListener('click', startPlayback);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('clearBtn').addEventListener('click', clearRecording);
}

async function loadRecordingData() {
  try {
    const result = await chrome.storage.local.get(['recordingData']);
    if (result.recordingData) {
      currentRecordingData = result.recordingData;
      updateStats(currentRecordingData);
    }
  } catch (e) {
    console.error('Failed to load recording data:', e);
  }
}

async function startRecording() {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert('No active tab found');
      return;
    }
    
    // 发送开始录制消息
    await chrome.runtime.sendMessage({
      type: 'START_RECORDING'
    });
    
    updateStatus(true);
    
    // 监听来自 background 的录制数据更新
    chrome.runtime.onMessage.addListener(handleRecordingMessage);
    
  } catch (e) {
    console.error('Failed to start recording:', e);
    alert('Failed to start recording. Please refresh the tab and try again.');
  }
}

async function stopRecording() {
  try {
    await chrome.runtime.sendMessage({
      type: 'STOP_RECORDING'
    });
    
    // 移除消息监听器
    chrome.runtime.onMessage.removeListener(handleRecordingMessage);
    
    updateStatus(false);
    
    // 重新加载录制数据
    await loadRecordingData();
    
  } catch (e) {
    console.error('Failed to stop recording:', e);
  }
}

function handleRecordingMessage(message) {
  if (message.type === 'RECORDED_ACTIONS') {
    // 可以在这里实时更新 UI
    if (message.actions) {
      console.log('Recorded actions:', message.actions.length);
    }
  }
}

async function startPlayback() {
  if (!currentRecordingData || currentRecordingData.actions.length === 0) {
    alert('No recording data available. Please record some actions first or import data.');
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: 'START_PLAYBACK',
      data: currentRecordingData
    });
    
    alert('Playback started! Check the active tab.');
  } catch (e) {
    console.error('Failed to start playback:', e);
    alert('Failed to start playback. Please make sure the tab is accessible.');
  }
}

async function exportData() {
  if (!currentRecordingData || currentRecordingData.actions.length === 0) {
    alert('No data to export');
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: 'EXPORT_DATA'
    });
  } catch (e) {
    console.error('Failed to export:', e);
  }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    await chrome.runtime.sendMessage({
      type: 'IMPORT_DATA',
      data: data
    });
    
    await loadRecordingData();
    alert('Recording data imported successfully!');
  } catch (e) {
    console.error('Failed to import:', e);
    alert('Failed to import data. Please check the file format.');
  }
  
  // 清空 input
  event.target.value = '';
}

async function clearRecording() {
  if (!confirm('Are you sure you want to clear all recording data?')) {
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_RECORDING'
    });
    
    currentRecordingData = null;
    updateStats(null);
    updateStatus(false);
  } catch (e) {
    console.error('Failed to clear:', e);
  }
}

function updateStatus(isRecording) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isRecording) {
    statusEl.className = 'status recording';
    statusText.textContent = 'Recording...';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    startBtn.disabled = true;
  } else {
    statusEl.className = 'status idle';
    statusText.textContent = 'Ready';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    startBtn.disabled = false;
  }
}

function updateStats(data) {
  const urlEl = document.getElementById('url');
  const actionCountEl = document.getElementById('actionCount');
  const durationEl = document.getElementById('duration');
  
  if (data) {
    try {
      const url = new URL(data.url);
      urlEl.textContent = url.hostname;
    } catch (e) {
      urlEl.textContent = data.url || '-';
    }
    
    actionCountEl.textContent = data.actions ? data.actions.length : 0;
    
    if (data.actions && data.actions.length > 0) {
      const duration = (data.actions[data.actions.length - 1].timestamp - data.timestamp) / 1000;
      durationEl.textContent = duration.toFixed(1) + 's';
    } else {
      durationEl.textContent = '0s';
    }
  } else {
    urlEl.textContent = '-';
    actionCountEl.textContent = '0';
    durationEl.textContent = '0s';
  }
}
