document.getElementById("start").addEventListener("click", () => {
    console.log("start button clicked");
    chrome.runtime.sendMessage({ action: "start" });
    document.getElementById("result").textContent = "Recording and transcribing...";
});

// 监听来自background script的转录结果
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "transcription") {
        const currentText = document.getElementById("result").textContent;
        // 添加新的转录文本，保留最近的几条记录
        document.getElementById("result").textContent = 
            `${message.timestamp}: ${message.text}\n${currentText}`.split('\n').slice(0, 5).join('\n');
    }
});
