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
            const audioContext = new AudioContext({ sampleRate: 44100 }); // 使用标准采样率
            const source = audioContext.createMediaElementSource(videoElement);
            const destination = audioContext.createMediaStreamDestination();
            
            // 添加音频处理节点来确保音频质量
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;
            
            source.connect(gainNode);
            gainNode.connect(destination);
            gainNode.connect(audioContext.destination);

            const stream = destination.stream;
            const audioTracks = stream.getAudioTracks();
            
            console.log("Audio setup:", {
                contextState: audioContext.state,
                sampleRate: audioContext.sampleRate,
                trackCount: audioTracks.length,
                trackSettings: audioTracks[0]?.getSettings()
            });

            if (audioTracks.length === 0) {
                console.error("No audio tracks found");
                return;
            }

            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            const mediaRecorder = new MediaRecorder(stream, options);
            console.log("MediaRecorder created:", {
                state: mediaRecorder.state,
                options: options
            });

            // 设置更短的时间间隔
            mediaRecorder.start(200); // 每200ms收集一次数据
            console.log("Recording started");
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
async function sendToWhisper(base64Audio) {
    console.log("Preparing to send to lemonfox");
    
    try {
        // 将 base64 转回 blob
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
        console.log("Created blob:", {
            size: blob.size,
            type: blob.type
        });

        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("language", "english");
        formData.append("response_format", "json");

        // 添加更多的请求头
        const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer XmDWb1cTvs75lVoZj0RMK6M9PmgLo2A5',
                'Accept': 'application/json'
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            
            // 添加更详细的错误信息
            const errorDetails = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: errorText
            };
            console.error("Detailed error information:", errorDetails);
            
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API Response:", result);
        
        if (result.text) {
            chrome.runtime.sendMessage({
                action: "transcription",
                text: result.text,
                timestamp: new Date().toISOString()
            });
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
