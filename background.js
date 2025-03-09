import transcriptionManager from './transcriptionManager.js';

let mediaRecorder;

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
    }
});

// 注入到目标页面的函数
function startCapture() {
    console.log("startCapture initiated");
    const videoElement = document.querySelector("video");
    if (!videoElement) {
        console.error("No video element found");
        return;
    }
    
    try {
        // 添加视频元素状态检查
        console.log("Video element status:", {
            readyState: videoElement.readyState,
            paused: videoElement.paused,
            muted: videoElement.muted,
            volume: videoElement.volume,
            currentTime: videoElement.currentTime
        });

        if (videoElement.readyState < 3) {
            console.log("Waiting for video to be ready...");
            videoElement.addEventListener('canplay', startRecording);
        } else {
            startRecording();
        }

        function startRecording() {
            const audioContext = new AudioContext({ sampleRate: 44100 });
            const source = audioContext.createMediaElementSource(videoElement);
            const destination = audioContext.createMediaStreamDestination();
            
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;
            
            source.connect(gainNode);
            gainNode.connect(destination);
            gainNode.connect(audioContext.destination);

            const stream = destination.stream;
            const audioTracks = stream.getAudioTracks();

            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            mediaRecorder = new MediaRecorder(stream, options);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    // 处理音频数据...
                }
            };

            mediaRecorder.start(200);
        }
    } catch (error) {
        console.error("Error in startCapture:", error);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
}

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
        formData.append("language", "english");
        formData.append("response_format", "json");

        const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer API'
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

// 添加 WAV 转换函数
function convertToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2 * numberOfChannels, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // 写入音频数据
    const channelData = [];
    for (let i = 0; i < numberOfChannels; i++) {
        channelData[i] = audioBuffer.getChannelData(i);
    }
    
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = channelData[channel][i];
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
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
