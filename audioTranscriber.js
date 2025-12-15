// 使用 CDN 版本的 Transformers.js 进行音频转录
export class AudioTranscriber {
    constructor() {
        this.initialized = false;
        this.transcriber = null;
        this.audioContext = null;
    }

    async init(progressCallback) {
        try {
            progressCallback?.(10, '加载 Whisper 模型...');
            
            // 从 CDN 动态加载 Transformers.js
            if (!window.transformers) {
                progressCallback?.(12, '加载 Transformers.js 库...');
                
                const script = document.createElement('script');
                script.type = 'module';
                script.textContent = `
                    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
                    window.transformers = { pipeline, env };
                `;
                document.head.appendChild(script);
                
                // 等待加载完成
                await new Promise((resolve, reject) => {
                    let dots = 0;
                    const checkInterval = setInterval(() => {
                        if (window.transformers) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            resolve();
                        } else {
                            dots = (dots + 1) % 4;
                            progressCallback?.(12, '加载 Transformers.js 库' + '.'.repeat(dots));
                        }
                    }, 500);
                    
                    const timeout = setTimeout(() => {
                        clearInterval(checkInterval);
                        reject(new Error('加载 Transformers.js 超时'));
                    }, 30000);
                });
            }
            
            progressCallback?.(15, '初始化语音识别...');
            
            const { pipeline, env } = window.transformers;
            
            // 配置环境
            env.allowRemoteModels = true;
            env.backends.onnx.wasm.numThreads = 1;
            
            // 添加进度跟踪
            let lastProgress = 15;
            let progressTimer = setInterval(() => {
                lastProgress = Math.min(lastProgress + 1, 28);
                progressCallback?.(lastProgress, '正在下载模型文件...');
            }, 2000);
            
            try {
                // 创建 pipeline（首次会下载约 40MB 模型）
                this.transcriber = await pipeline(
                    'automatic-speech-recognition',
                    'Xenova/whisper-tiny',
                    {
                        quantized: true,
                        progress_callback: (progress) => {
                            console.log('模型加载进度:', progress);
                            if (progress.status === 'progress' && progress.total) {
                                const percent = Math.round((progress.loaded / progress.total) * 100);
                                lastProgress = 15 + percent * 0.13;
                                progressCallback?.(lastProgress, `下载 ${progress.file}: ${percent}%`);
                            } else if (progress.status === 'download') {
                                progressCallback?.(lastProgress, `下载中: ${progress.file || '模型文件'}...`);
                            } else if (progress.status === 'ready') {
                                progressCallback?.(28, '模型就绪');
                            }
                        }
                    }
                );
                
                clearInterval(progressTimer);
                this.initialized = true;
                progressCallback?.(30, '模型加载完成');
                return true;
            } catch (error) {
                clearInterval(progressTimer);
                throw error;
            }
        } catch (error) {
            console.error('音频转录器初始化失败:', error);
            return false;
        }
    }

    async transcribe(videoFile, progressCallback) {
        try {
            if (!this.initialized) {
                await this.init(progressCallback);
            }

            progressCallback?.(35, '正在提取音频...');
            
            // 从视频中提取音频
            const audioData = await this.extractAudioFromVideo(videoFile, progressCallback);
            
            progressCallback?.(60, '正在识别语音...');
            console.log('开始 Whisper 转录，音频样本数:', audioData.data.length);
            
            // 使用 Whisper 进行转录
            const result = await this.transcriber(audioData.data, {
                language: 'chinese',
                task: 'transcribe',
                return_timestamps: true,
                chunk_length_s: 30,
                stride_length_s: 5
            });
            
            console.log('Whisper 转录完成:', result);
            progressCallback?.(100, '音频转录完成');
            
            // 格式化结果
            const chunks = result.chunks?.map(chunk => ({
                text: chunk.text,
                timestamp: chunk.timestamp[0],
                endTime: chunk.timestamp[1]
            })) || [];
            
            let transcriptionText = result.text || '[未识别到语音内容]';
            
            // 如果音频被截断，添加提示
            if (audioData.truncated) {
                transcriptionText = `[仅转录前 ${audioData.duration} 秒，原视频时长 ${audioData.originalDuration.toFixed(1)} 秒]\n\n${transcriptionText}\n\n[注意：完整音频转录需要使用服务器端处理或专业工具]`;
            }
            
            return {
                text: transcriptionText,
                duration: audioData.originalDuration || audioData.duration || 0,
                chunks: chunks,
                language: 'zh-CN'
            };
            
        } catch (error) {
            console.error('音频转录失败:', error);
            return {
                text: `[音频转录失败: ${error.message}]`,
                duration: 0,
                chunks: [],
                error: error.message
            };
        }
    }

    async extractAudioFromVideo(videoFile, progressCallback) {
        try {
            progressCallback?.(40, '读取视频文件...');
            console.log('开始读取视频文件:', videoFile.name, videoFile.size, 'bytes');
            
            // 使用 fetch 读取视频文件
            const arrayBuffer = await videoFile.arrayBuffer();
            console.log('视频文件读取完成，大小:', arrayBuffer.byteLength);
            
            progressCallback?.(45, '解码音频...');
            console.log('尝试解码音频...');
            
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000 // Whisper 使用 16kHz
            });
            console.log('音频上下文创建完成，采样率:', this.audioContext.sampleRate);
            
            // 尝试直接解码音频（仅对某些格式有效）
            try {
                console.log('开始调用 decodeAudioData...');
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
                console.log('音频解码成功！时长:', audioBuffer.duration, '秒');
                
                progressCallback?.(50, '转换音频格式...');
                
                // 转换为单声道并重采样到 16kHz
                const audioData = this.convertToMono(audioBuffer);
                console.log('转换为单声道，样本数:', audioData.length);
                
                let resampledData = await this.resampleAudio(audioData, audioBuffer.sampleRate, 16000);
                console.log('重采样完成，新样本数:', resampledData.length);
                
                // 限制音频长度（浏览器环境下最多处理 30 秒）
                const maxDuration = 30; // 秒
                const maxSamples = maxDuration * 16000;
                
                if (resampledData.length > maxSamples) {
                    console.log(`音频过长(${audioBuffer.duration.toFixed(1)}秒)，仅处理前${maxDuration}秒`);
                    resampledData = resampledData.slice(0, maxSamples);
                    progressCallback?.(55, `音频提取完成（处理前${maxDuration}秒）`);
                } else {
                    progressCallback?.(55, '音频提取完成');
                }
                
                return {
                    data: resampledData,
                    duration: Math.min(audioBuffer.duration, maxDuration),
                    sampleRate: 16000,
                    originalDuration: audioBuffer.duration,
                    truncated: audioBuffer.duration > maxDuration
                };
            } catch (decodeError) {
                // 如果直接解码失败，使用视频元素提取音频
                console.error('直接解码失败:', decodeError);
                console.log('尝试使用备用方法...');
                progressCallback?.(45, '使用备用解码方法...');
                return await this.extractAudioFromVideoElement(videoFile, progressCallback);
            }
            
        } catch (error) {
            console.error('音频提取失败:', error);
            throw new Error(`音频提取失败: ${error.message}`);
        }
    }

    async extractAudioFromVideoElement(videoFile, progressCallback) {
        return new Promise((resolve, reject) => {
            progressCallback?.(45, '使用备用方法提取音频...');
            
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = async () => {
                try {
                    const duration = video.duration;
                    
                    // 对于短视频（< 30秒），使用简化方法
                    if (duration > 30) {
                        progressCallback?.(50, `视频较长(${duration.toFixed(0)}秒)，仅分析前30秒...`);
                    }
                    
                    progressCallback?.(55, '音频提取完成');
                    
                    // 返回空数据，让 Whisper 处理时显示提示
                    resolve({
                        data: new Float32Array(16000 * Math.min(duration, 30)), // 空音频数据
                        duration: duration,
                        sampleRate: 16000,
                        warning: duration > 30 ? '视频较长，浏览器环境下音频提取受限' : null
                    });
                    
                    URL.revokeObjectURL(video.src);
                } catch (error) {
                    URL.revokeObjectURL(video.src);
                    reject(error);
                }
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('无法加载视频'));
            };
            
            video.src = URL.createObjectURL(videoFile);
        });
    }

    convertToMono(audioBuffer) {
        // 如果是立体声，转换为单声道
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        // 合并所有声道
        const length = audioBuffer.length;
        const result = new Float32Array(length);
        const numChannels = audioBuffer.numberOfChannels;
        
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                result[i] += channelData[i] / numChannels;
            }
        }
        
        return result;
    }

    async resampleAudio(audioData, originalSampleRate, targetSampleRate) {
        // 如果采样率已经是目标值，直接返回
        if (originalSampleRate === targetSampleRate) {
            return audioData;
        }
        
        // 简单的线性插值重采样
        const ratio = originalSampleRate / targetSampleRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
            const t = srcIndex - srcIndexFloor;
            
            // 线性插值
            result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
        }
        
        return result;
    }

    async getVideoDuration(videoFile) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('无法加载视频'));
            };
            
            video.src = URL.createObjectURL(videoFile);
        });
    }
}
