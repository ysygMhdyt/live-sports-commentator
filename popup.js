document.getElementById("start").addEventListener("click", () => {
    console.log("start button clicked");
    chrome.runtime.sendMessage({ action: "start" });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "transcriptionResult") {
        document.getElementById("result").innerText = message.text;
    }
});
