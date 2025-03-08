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
        console.warn("No video element found");
        return;
    }
    
    try {
        // 等待视频准备就绪
        if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
            console.log("Waiting for video to be ready...");
            videoElement.addEventListener('canplay', startRecording);
        } else {
            startRecording();
        }

        function startRecording() {
            // 创建 AudioContext 来处理音频流
            const audioContext = new AudioContext({ sampleRate: 16000 }); // Whisper推荐的采样率
            const source = audioContext.createMediaElementSource(videoElement);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            source.connect(audioContext.destination); // 保持原始音频输出

            const stream = destination.stream;
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.error("No audio tracks found in the stream");
                return;
            }

            // 尝试使用更通用的 MIME 类型
            let options;
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { 
                    mimeType: 'audio/webm;codecs=opus',
                    audioBitsPerSecond: 16000
                };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { 
                    mimeType: 'audio/webm',
                    audioBitsPerSecond: 16000
                };
            } else {
                console.error("No supported mime type found");
                return;
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            
            let currentChunk = [];
            
            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    currentChunk.push(event.data);
                    
                    // 对于直播，我们可以缩短处理间隔以获得更实时的转录
                    if (currentChunk.length >= 2) { // 改为2秒
                        const blob = new Blob(currentChunk, { type: options.mimeType });
                        const arrayBuffer = await blob.arrayBuffer();
                        chrome.runtime.sendMessage({
                            action: "audioData",
                            data: arrayBuffer
                        });
                        currentChunk = [];
                    }
                }
            };
            
            mediaRecorder.start(1000); // 每秒收集一次数据
            console.log("Recording started in page context");
        }
    } catch (error) {
        console.error("Error in startCapture:", error);
    }
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
