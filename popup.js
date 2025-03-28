let isRecording = false;

document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startButton');
    const transcriptionContainer = document.getElementById('transcriptionContainer');
    const statusElement = document.getElementById('status');
    const languageInput = document.getElementById('languageInput');
    const commentatorInput = document.getElementById('commentatorInput');

    // 恢复之前的转录记录
    chrome.runtime.sendMessage({ action: "getTranscriptions" }, (response) => {
        if (response && response.transcriptions) {
            updateTranscriptionDisplay(response.transcriptions);
        }
    });

    startButton.addEventListener('click', function() {
        if (!isRecording) {
            // 获取用户输入
            const language = languageInput.value.trim() || 'english';
            const commentator = commentatorInput.value.trim() || '';

            // 保存到本地 storage
            chrome.storage.local.set({ language, commentator });

            // 通知后台脚本
            chrome.runtime.sendMessage({
                action: "updateSettings",
                settings: { language, commentator }
            });

            // 开始录音
            chrome.runtime.sendMessage({ action: "start" });
            startButton.textContent = "Stop Recording";
            startButton.classList.add('recording');
            statusElement.textContent = "Recording";
            isRecording = true;
        } else {
            chrome.runtime.sendMessage({ action: "stop" });
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
