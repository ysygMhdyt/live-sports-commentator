let mediaRecorder;

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "start") {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                console.error("No active tab found");
                return;
            }
            console.log("received start message");
            // 注入并执行脚本来获取媒体流
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: startCapture
            });
        } catch (error) {
            console.error("Error starting capture:", error);
        }
    } else if (message.action === "audioData") {
        // 收到音频数据后发送到Whisper API
        await sendToWhisper(message.data);
    }
});

// 注入到目标页面的函数
function startCapture() {
    console.log("startCapture initiated");
    const mediaElement = document.querySelector("video, audio");
    if (!mediaElement) {
        console.warn("No media element found");
        return;
    }
    
    const stream = mediaElement.captureStream();
    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 // Whisper推荐的比特率
    });
    
    let currentChunk = [];
    
    mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
            currentChunk.push(event.data);
            
            // 当收集到足够的数据时（约3秒），发送到Whisper
            if (currentChunk.length >= 3) {
                const blob = new Blob(currentChunk, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                chrome.runtime.sendMessage({
                    action: "audioData",
                    data: arrayBuffer
                });
                currentChunk = []; // 清空当前chunk
            }
        }
    };
    
    mediaRecorder.start(1000); // 每秒收集一次数据
    console.log("Recording started in page context");
}

// 发送音频到Whisper API
async function sendToWhisper(audioData) {
    console.log("sending to whisper");
    const formData = new FormData();
    const blob = new Blob([audioData], { type: 'audio/webm' });
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");

    try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_OPENAI_API_KEY'
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.text) {
            chrome.runtime.sendMessage({
                action: "transcription",
                text: result.text,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error sending to Whisper:', error);
    }
}
