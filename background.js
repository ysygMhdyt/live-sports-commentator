let mediaRecorder;
let audioChunks = [];

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
    }
});

// 在页面上下文中执行的函数
function startCapture() {
    console.log("startCapture");
    const mediaElement = document.querySelector("video, audio");
    if (!mediaElement) {
        console.warn("Audio or video not found");
        return;
    }
    
    const stream = mediaElement.captureStream ? mediaElement.captureStream() : mediaElement.mozCaptureStream();
    if (stream) {
        startRecording(stream);
    }
}

async function startRecording(stream) {
    try {
        console.log("startRecording");
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
            console.log("audio chunk added");
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioFile = new File([audioBlob], "audio.webm", { type: "audio/webm" });

            const transcript = await sendToWhisper(audioFile);
            chrome.runtime.sendMessage({ action: "transcriptionResult", text: transcript });
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 10000); // 10 秒录音
    } catch (error) {
        console.error("Failed recording:", error);
    }
}

async function sendToWhisper(audioFile) {
    console.log("sending to whisper");
    const apiKey = "YOUR_OPENAI_API_KEY";
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", "whisper-1");

    try {
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}` },
            body: formData
        });

        const result = await response.json();
        return result.text;
    } catch (error) {
        console.error("Whisper API failed:", error);
        return "Failed to transcribe audio";
    }
}
