import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { createWorker } from 'tesseract.js';

export class FrameAnalyzer {
    constructor() {
        this.objectDetector = null;
        this.ocrWorker = null;
    }

    async init(progressCallback) {
        try {
            // 加载 COCO-SSD 物体检测模型
            progressCallback?.(30, '正在加载物体识别模型...');
            this.objectDetector = await cocoSsd.load();
            progressCallback?.(40, '物体识别模型加载完成');

            // 初始化 OCR
            progressCallback?.(45, '正在初始化文字识别...');
            this.ocrWorker = await createWorker('chi_sim+eng', 1, {
                logger: (m) => {
                    if (m.status === 'loading tesseract core') {
                        progressCallback?.(45, 'OCR: 加载核心模块...');
                    } else if (m.status === 'initializing tesseract') {
                        progressCallback?.(48, 'OCR: 初始化中...');
                    } else if (m.status === 'loading language traineddata') {
                        progressCallback?.(50, 'OCR: 加载语言包...');
                    }
                }
            });
            progressCallback?.(55, '文字识别初始化完成');
            
            return true;
        } catch (error) {
            console.error('帧分析器初始化失败:', error);
            return false;
        }
    }

    async extractKeyframes(videoFile, numFrames = 6) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.preload = 'metadata';

            video.addEventListener('loadedmetadata', async () => {
                const duration = video.duration;
                const interval = duration / (numFrames + 1);
                const frames = [];

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const captureFrame = (timestamp) => {
                    return new Promise((res) => {
                        video.currentTime = timestamp;
                        video.onseeked = () => {
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0);
                            
                            const imageUrl = canvas.toDataURL('image/jpeg', 0.85);
                            frames.push({
                                timestamp,
                                imageUrl,
                                canvas: canvas
                            });
                            res();
                        };
                    });
                };

                try {
                    // 按顺序提取帧
                    for (let i = 1; i <= numFrames; i++) {
                        const timestamp = interval * i;
                        await captureFrame(timestamp);
                    }
                    
                    URL.revokeObjectURL(video.src);
                    resolve(frames);
                } catch (error) {
                    URL.revokeObjectURL(video.src);
                    reject(error);
                }
            });

            video.addEventListener('error', () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('视频加载失败'));
            });
        });
    }

    async analyzeFrame(frame) {
        const result = {
            timestamp: frame.timestamp,
            imageUrl: frame.imageUrl,
            objects: [],
            text: ''
        };

        try {
            // 物体检测
            if (this.objectDetector) {
                // 从 canvas 获取图像进行检测
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = frame.imageUrl;
                });
                
                const predictions = await this.objectDetector.detect(img);
                result.objects = predictions.map(p => ({
                    class: p.class,
                    score: p.score,
                    bbox: p.bbox
                }));
            }

            // OCR 文字识别
            if (this.ocrWorker) {
                try {
                    const { data: { text } } = await this.ocrWorker.recognize(frame.imageUrl);
                    result.text = text.trim();
                } catch (ocrError) {
                    console.warn('OCR识别失败:', ocrError);
                }
            }

        } catch (error) {
            console.error('帧分析失败:', error);
        }

        return result;
    }

    async analyzeKeyframes(frames, progressCallback) {
        const results = [];
        const totalFrames = frames.length;

        for (let i = 0; i < frames.length; i++) {
            const progress = 60 + Math.round((i / totalFrames) * 35);
            progressCallback?.(progress, `正在分析第 ${i + 1}/${totalFrames} 帧...`);
            
            const result = await this.analyzeFrame(frames[i]);
            results.push(result);
        }

        return results;
    }

    async cleanup() {
        if (this.ocrWorker) {
            await this.ocrWorker.terminate();
        }
    }
}
