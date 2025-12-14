import { pipeline } from '@xenova/transformers';

export class AudioTranscriber {
    constructor() {
        this.transcriber = null;
    }

    async init(progressCallback) {
        try {
            progressCallback?.(10, '正在加载语音识别模型...');
            
            // 使用 Whisper tiny 模型进行语音识别
            this.transcriber = await pipeline(
                'automatic-speech-recognition',
                'Xenova/whisper-tiny',
                {
                    progress_callback: (progress) => {
                        if (progress.status === 'progress') {
                            const percent = Math.round((progress.loaded / progress.total) * 100);
                            progressCallback?.(10 + percent * 0.2, `下载模型: ${percent}%`);
                        }
                    }
                }
            );
            
            progressCallback?.(30, '语音识别模型加载完成');
            return true;
        } catch (error) {
            console.error('音频转录器初始化失败:', error);
            return false;
        }
    }

    async extractAudio(videoFile) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            
            video.addEventListener('loadedmetadata', async () => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioContext.createMediaElementSource(video);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    source.connect(audioContext.destination);

                    const mediaRecorder = new MediaRecorder(destination.stream);
                    const chunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            chunks.push(e.data);
                        }
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                        
                        // 转换为 ArrayBuffer
                        const arrayBuffer = await audioBlob.arrayBuffer();
                        
                        // 解码音频数据
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        
                        // 转换为单声道并归一化
                        const audioData = audioBuffer.getChannelData(0);
                        
                        resolve({
                            data: audioData,
                            sampleRate: audioBuffer.sampleRate,
                            duration: audioBuffer.duration
                        });
                        
                        URL.revokeObjectURL(video.src);
                    };

                    // 开始录制
                    video.play();
                    mediaRecorder.start();

                    // 视频播放完成后停止录制
                    video.onended = () => {
                        mediaRecorder.stop();
                        audioContext.close();
                    };

                    // 设置快速播放以加速提取（静音）
                    video.muted = true;
                    video.playbackRate = 16.0; // 最大加速

                } catch (error) {
                    URL.revokeObjectURL(video.src);
                    reject(error);
                }
            });

            video.addEventListener('error', (e) => {
                URL.revokeObjectURL(video.src);
                reject(new Error('视频加载失败'));
            });
        });
    }

    async transcribe(videoFile, progressCallback) {
        try {
            if (!this.transcriber) {
                await this.init(progressCallback);
            }

            progressCallback?.(35, '正在提取音频...');
            
            // 提取音频数据
            const audioData = await this.extractAudio(videoFile);
            
            progressCallback?.(45, '正在转录音频...');
            
            // 执行转录
            const result = await this.transcriber(audioData.data, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: 'chinese',
                task: 'transcribe'
            });
            
            progressCallback?.(55, '音频转录完成');
            
            return {
                text: result.text,
                duration: audioData.duration,
                chunks: result.chunks || []
            };
            
        } catch (error) {
            console.error('音频转录失败:', error);
            return {
                text: '',
                duration: 0,
                chunks: [],
                error: error.message
            };
        }
    }
}
