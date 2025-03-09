class TranscriptionManager {
    constructor() {
        this.transcriptions = [];
        this.lastTimestamp = null;
        this.mergeThreshold = 2000; // 2秒内的文本将被合并
    }

    addTranscription(text, timestamp) {
        const currentTime = new Date(timestamp);
        
        // 如果与上一条文本时间接近，则合并
        if (this.lastTimestamp && 
            (currentTime - this.lastTimestamp) < this.mergeThreshold &&
            this.transcriptions.length > 0) {
            
            const lastTranscription = this.transcriptions[this.transcriptions.length - 1];
            lastTranscription.text += ' ' + text;
        } else {
            // 添加新的转录文本
            this.transcriptions.push({
                text: text,
                timestamp: timestamp
            });
        }
        
        this.lastTimestamp = currentTime;
        
        // 保持最近的10条记录
        if (this.transcriptions.length > 10) {
            this.transcriptions.shift();
        }
        
        // 发送更新到popup
        this.updatePopup();
    }

    updatePopup() {
        // 发送所有转录文本到popup
        chrome.runtime.sendMessage({
            action: "updateTranscriptions",
            transcriptions: this.transcriptions
        });
    }

    getTranscriptions() {
        return this.transcriptions;
    }
}

// 导出实例
const transcriptionManager = new TranscriptionManager();
export default transcriptionManager; 