let isRecording = false;

document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startButton');
    const transcriptionContainer = document.getElementById('transcriptionContainer');
    const statusElement = document.getElementById('status');
    const languageSelect = document.getElementById('languageSelect');
    const styleSelect = document.getElementById('styleSelect');

    // 恢复之前的转录记录
    chrome.runtime.sendMessage({action: "getTranscriptions"}, (response) => {
        if (response && response.transcriptions) {
            updateTranscriptionDisplay(response.transcriptions);
        }
    });

    startButton.addEventListener('click', function() {
        if (!isRecording) {
            chrome.runtime.sendMessage({action: "start"});
            startButton.textContent = "Stop Recording";
            startButton.classList.add('recording');
            statusElement.textContent = "Recording";
            isRecording = true;
        } else {
            chrome.runtime.sendMessage({action: "stop"});
            startButton.textContent = "Start Recording";
            startButton.classList.remove('recording');
            statusElement.textContent = "Stopped";
            isRecording = false;
        }
    });

    // 监听转录更新
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateTranscriptions") {
            updateTranscriptionDisplay(message.transcriptions);
        }
    });

    // 保存设置变化
    languageSelect.addEventListener('change', function() {
        chrome.storage.local.set({ language: this.value });
        // 通知后台脚本设置已更改
        chrome.runtime.sendMessage({
            action: "updateSettings",
            settings: {
                language: this.value,
                style: styleSelect.value
            }
        });
    });

    styleSelect.addEventListener('change', function() {
        chrome.storage.local.set({ style: this.value });
        // 通知后台脚本设置已更改
        chrome.runtime.sendMessage({
            action: "updateSettings",
            settings: {
                language: languageSelect.value,
                style: this.value
            }
        });
    });

    function updateTranscriptionDisplay(transcriptions) {
        transcriptionContainer.innerHTML = '';
        
        transcriptions.forEach(trans => {
            const div = document.createElement('div');
            div.className = 'transcription-item';
            
            const time = new Date(trans.timestamp);
            const timeStr = time.toLocaleTimeString();
            
            div.innerHTML = `
                <div class="text">${trans.text}</div>
                <div class="timestamp">${timeStr}</div>
            `;
            
            transcriptionContainer.appendChild(div);
        });
        
        // 自动滚动到底部
        transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
    }
});

// 保持popup窗口打开
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === "popup") {
        port.onDisconnect.addListener(function() {
            // popup关闭时的处理
        });
    }
});
