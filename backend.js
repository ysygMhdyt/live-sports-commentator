let mediaRecorder;
let audioChunks = [];

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "startRecording") {
        startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
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
