document.getElementById("start").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "start" });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "transcriptionResult") {
        document.getElementById("result").innerText = message.text;
    }
});
