import { AudioTranscriber } from './audioTranscriber.js';
import { FrameAnalyzer } from './frameAnalyzer.js';

export class VideoAnalyzer {
    constructor() {
        this.audioTranscriber = new AudioTranscriber();
        this.frameAnalyzer = new FrameAnalyzer();
        this.initialized = false;
    }

    async init(progressCallback) {
        if (this.initialized) return;

        progressCallback?.(0, '初始化中...');

        // 初始化帧分析器（包含物体检测和OCR）
        await this.frameAnalyzer.init(progressCallback);

        // 音频转录器将在需要时初始化
        
        this.initialized = true;
        progressCallback?.(55, '初始化完成');
    }

    async analyze(videoFile, progressCallback) {
        if (!this.initialized) {
            await this.init(progressCallback);
        }

        const result = {
            filename: videoFile.name,
            filesize: videoFile.size,
            timestamp: new Date().toISOString(),
            transcription: null,
            keyframes: []
        };

        try {
            // 1. 提取关键帧
            progressCallback?.(55, '正在提取关键帧...');
            const frames = await this.frameAnalyzer.extractKeyframes(videoFile, 6);
            progressCallback?.(60, '关键帧提取完成');

            // 2. 分析关键帧（物体检测 + OCR）
            result.keyframes = await this.frameAnalyzer.analyzeKeyframes(frames, progressCallback);
            progressCallback?.(80, '关键帧分析完成');

            // 3. 音频转录
            progressCallback?.(85, '开始音频转录...');
            result.transcription = await this.audioTranscriber.transcribe(videoFile, progressCallback);

            progressCallback?.(100, '分析完成！');
            return result;

        } catch (error) {
            console.error('视频分析失败:', error);
            throw error;
        }
    }

    async cleanup() {
        await this.frameAnalyzer.cleanup();
    }
}
