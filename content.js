// 获取页面上的视频或音频流
function getMediaStream() {
    const mediaElement = document.querySelector("video, audio");
    if (!mediaElement) {
        console.warn("Audio or video not found");
        return null;
    }
    return mediaElement.captureStream ? mediaElement.captureStream() : mediaElement.mozCaptureStream();
}

// 发送音频流到 background.js
function sendStreamToBackground() {
    const stream = getMediaStream();
    if (stream) {
        chrome.runtime.sendMessage({ action: "startRecording", streamId: stream.id });
    }
}

// 监听来自 popup 或 background 的消息
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "start") {
        sendStreamToBackground();
    }
});
