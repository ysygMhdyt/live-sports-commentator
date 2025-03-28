import transcriptionManager from './transcriptionManager.js';
import OpenAI from 'openai';

let mediaRecorder;
let currentSettings = {
    language: 'english',
    commentator: ''
};

require('dotenv').config();

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'DEEPSEEK_API_KEY'
});

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
    } else if (message.action === "updateSettings") {
        currentSettings = message.settings;
    }
});

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
        formData.append("response_format", "json");

        const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer API_KEY'
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
            // 先用 DeepSeek 处理文本
            const processedText = await processWithDeepSeek(result.text);
            
            // 使用处理后的文本更新转录
            transcriptionManager.addTranscription(
                processedText,
                new Date().toISOString()
            );
        }
    } catch (error) {
        console.error('Error sending to LemonFox:', error);
    }
}

async function processWithDeepSeek(text) {
    try {
        const prompt = generatePrompt(text, currentSettings);
        console.log(prompt)
        
        const completion = await openai.chat.completions.create({
            model: "deepseek/deepseek-chat-v3-0324:free",
            messages: [
                { 
                    role: "system", 
                    content: "You are a professional sports commentator who can translate and rephrase content in different styles." 
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error calling DeepSeek API:', error);
        return text;
    }
}

function generatePrompt(text, userInput) {
    let prompt = "";

    // 添加翻译指令
    if (userInput.language.toLowerCase() !== 'english') {
        prompt += `Translate the following text transcribed from a sports game commentary to ${userInput.language}, `;
    }

    // 添加风格化指令
    if (userInput.commentator) {
        prompt += `Rephrase it in the style of ${userInput.commentator}, focusing on their typical tone and commentary style: `;
    }

    return prompt + text;
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
