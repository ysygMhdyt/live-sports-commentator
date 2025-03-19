let audioContext;
let scriptNode;
let isProcessing = false;
let silenceTimeout = null;
let lastAudioLevel = 0;
let audioData = []; // 用于存储音频数据

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.action === "start") {
        console.log("Content script received start message");
        startCapture();
        sendResponse({ status: "received" });
    } else if (message.action === "stop") {
        stopCapture();
        sendResponse({ status: "stopped" });
    }
    return true;
});

function startCapture() {
    console.log("startCapture initiated");
    const videoElement = document.querySelector("video");
    if (!videoElement) {
        console.error("No video element found");
        return;
    }
    
    try {
        console.log("Video element status:", {
            readyState: videoElement.readyState,
            paused: videoElement.paused,
            muted: videoElement.muted,
            volume: videoElement.volume
        });

        // 监听视频暂停/播放事件
        videoElement.addEventListener('pause', handleVideoPause);
        videoElement.addEventListener('play', handleVideoPlay);

        if (videoElement.readyState < 3) {
            console.log("Waiting for video to be ready...");
            videoElement.addEventListener('canplay', startRecording);
        } else {
            startRecording();
        }
    } catch (error) {
        console.error("Error in startCapture:", error);
    }
}

function handleVideoPause() {
    console.log("Video paused");
    stopAudioProcessing();
}

function handleVideoPlay() {
    console.log("Video played");
    if (isProcessing) {
        startAudioProcessing();
    }
}

function startRecording() {
    if (audioContext) {
        audioContext.close();
    }

    audioContext = new AudioContext({ sampleRate: 44100 });
    const videoElement = document.querySelector("video");
    const source = audioContext.createMediaElementSource(videoElement);
    const destination = audioContext.createMediaStreamDestination();
    
    // 创建分析器节点来检测音频电平
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    scriptNode = audioContext.createScriptProcessor(4096, 2, 2);
    
    source.connect(analyser);
    analyser.connect(scriptNode);
    scriptNode.connect(destination);
    scriptNode.connect(audioContext.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let audioData = [];
    isProcessing = true;

    scriptNode.onaudioprocess = (e) => {
        if (!isProcessing) return;

        // 检测音频电平
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // 如果音频电平太低，可能是静音
        if (average < 5) {
            if (!silenceTimeout) {
                silenceTimeout = setTimeout(() => {
                    console.log("Silence detected, pausing processing");
                    stopAudioProcessing();
                }, 2000); // 2秒后停止处理
            }
            return;
        } else {
            if (silenceTimeout) {
                clearTimeout(silenceTimeout);
                silenceTimeout = null;
            }
        }

        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.getChannelData(1);
        
        const samples = new Int16Array(left.length);
        for (let i = 0; i < left.length; i++) {
            const sample = Math.max(-1, Math.min(1, (left[i] + right[i]) / 2));
            samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        audioData.push(samples);
        
        if (audioData.length >= 30) {
            const combinedData = concatenateAudioData(audioData);
            sendAudioData(combinedData);
            audioData = [];
        }
    };
}

function stopAudioProcessing() {
    isProcessing = false;
    if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
    }
}

function startAudioProcessing() {
    isProcessing = true;
}

function stopCapture() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (scriptNode) {
        scriptNode.disconnect();
        scriptNode = null;
    }
    isProcessing = false;
    if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
    }
}

function concatenateAudioData(audioDataArray) {
    const totalLength = audioDataArray.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Int16Array(totalLength);
    let offset = 0;
    
    for (const data of audioDataArray) {
        result.set(data, offset);
        offset += data.length;
    }
    
    return result;
}

function sendAudioData(audioData) {
    // 将音频数据转换为 WAV 格式
    const wavData = createWAV(audioData);
    
    // 发送到 background script
    chrome.runtime.sendMessage({
        action: "audioData",
        data: Array.from(new Uint8Array(wavData)), // 转换为普通数组以便传输
        sampleRate: 44100
    });
}

function createWAV(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 44100 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    // 写入采样数据
    for (let i = 0; i < samples.length; i++) {
        view.setInt16(44 + i * 2, samples[i], true);
    }
    
    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
} 