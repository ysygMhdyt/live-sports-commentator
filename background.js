import transcriptionManager from './transcriptionManager.js';

let mediaRecorder;
let currentSettings = {
    language: 'english',
    style: 'default'
};

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "start") {
        console.log("Background received start message");
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                console.error("No active tab found");
                return;
            }
            
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: "start" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending message:", chrome.runtime.lastError);
                    } else {
                        console.log("Message sent successfully");
                    }
                });
            }, 100);
            
        } catch (error) {
            console.error("Error in background script:", error);
        }
    } else if (message.action === "stop") {
        console.log("Background received stop message");
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                console.error("No active tab found");
                return;
            }
            
            chrome.tabs.sendMessage(tab.id, { action: "stop" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending stop message:", chrome.runtime.lastError);
                } else {
                    console.log("Stop message sent successfully");
                }
            });
        } catch (error) {
            console.error("Error in background script:", error);
        }
    } else if (message.action === "audioData") {
        await sendToWhisper(message.data);
    } else if (message.action === "updateSettings") {
        currentSettings = message.settings;
    }
});

// 发送音频到Whisper API
async function sendToWhisper(audioData) {
    console.log("Preparing to send to lemonfox");
    
    try {
        const uint8Array = new Uint8Array(audioData);
        const blob = new Blob([uint8Array], { type: 'audio/wav' });
        console.log("Created blob:", {
            size: blob.size,
            type: blob.type
        });

        const formData = new FormData();
        formData.append("file", blob, "audio.wav");
        formData.append("response_format", "json");

        // 在 sendToWhisper 函数中修改 prompt 设置
        let prompt = "";

        // 添加风格提示
        switch(currentSettings.style) {
            case "excited":
                prompt += "Please rephrase it in an enthusiastic and passionate sports commentary style:";
                break;
            case "technical":
                prompt += "Please rephrase it in a professional technical analysis style:";
                break;
            case "casual":
                prompt += "Please rephrase it in a lighthearted and entertaining style:";
                break;
            default:
                prompt += "";
        }
        formData.append("prompt", prompt);

        const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer API-Key'
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API Response:", result);
        
        if (result.text && result.text.trim()) {
            // 使用 TranscriptionManager 来管理转录文本
            transcriptionManager.addTranscription(
                result.text,
                new Date().toISOString()
            );
        }
    } catch (error) {
        console.error('Error sending to LemonFox:', error);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        mediaRecorder = null;
    }
    // 清理其他资源...
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}
