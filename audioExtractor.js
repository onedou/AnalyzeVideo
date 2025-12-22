export class AudioExtractor {
    constructor() {
        this.audioContext = null;
    }

    /**
     * 从视频文件提取音频并导出为WAV格式（快速，无需编码）
     * @param {File} videoFile - 视频文件
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Blob>} WAV音频Blob
     */
    async extractAudioAsMP3(videoFile, progressCallback = null) {
        try {
            progressCallback?.(10, '正在解码视频音频...');
            
            // 读取视频文件
            const arrayBuffer = await videoFile.arrayBuffer();
            
            progressCallback?.(30, '正在提取音频数据...');
            
            // 创建音频上下文
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // 解码音频数据（这会直接提取完整音频，非常快！）
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            progressCallback?.(60, '正在编码为WAV格式...');
            
            // 将AudioBuffer转换为WAV格式
            const wavBlob = this.audioBufferToWav(audioBuffer);
            
            progressCallback?.(100, '导出完成！');
            
            return wavBlob;

        } catch (error) {
            console.error('音频提取失败:', error);
            throw new Error('音频提取失败: ' + error.message);
        }
    }

    /**
     * 将AudioBuffer转换为WAV格式
     * @param {AudioBuffer} audioBuffer 
     * @returns {Blob}
     */
    audioBufferToWav(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;
        
        const samples = this.interleave(audioBuffer);
        const dataLength = samples.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        
        // WAV文件头
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // 写入PCM数据
        this.floatTo16BitPCM(view, 44, samples);
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * 交错音频通道
     */
    interleave(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const result = new Float32Array(length * numberOfChannels);
        
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                result[i * numberOfChannels + channel] = channelData[i];
            }
        }
        
        return result;
    }

    /**
     * 写入字符串到DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * 将Float32转换为16位PCM
     */
    floatTo16BitPCM(view, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    /**
     * 下载音频文件
     * @param {Blob} audioBlob - 音频Blob
     * @param {string} filename - 文件名（不含扩展名）
     */
    downloadAudio(audioBlob, filename = 'audio') {
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.wav`; // 改为WAV格式
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
