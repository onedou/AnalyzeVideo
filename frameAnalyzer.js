import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { createWorker } from 'tesseract.js';

export class FrameAnalyzer {
    constructor() {
        this.objectDetector = null;
        this.ocrWorker = null;
    }

    async init(progressCallback) {
        try {
            // 等待 TensorFlow.js 准备就绪
            progressCallback?.(25, '初始化 TensorFlow...');
            console.log('开始初始化 TensorFlow...');
            await tf.ready();
            console.log('TensorFlow 准备完成');
            progressCallback?.(28, 'TensorFlow 准备完成');
            
            // 加载 COCO-SSD 物体检测模型
            progressCallback?.(30, '正在加载物体识别模型...');
            console.log('开始加载 COCO-SSD 模型...');
            
            try {
                // 添加超时保护 - 60秒超时
                const loadModel = cocoSsd.load({
                    base: 'lite_mobilenet_v2' // 使用更轻量的模型
                });
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('模型加载超时（60秒）')), 60000)
                );
                
                this.objectDetector = await Promise.race([loadModel, timeout]);
                console.log('COCO-SSD 模型加载完成');
                progressCallback?.(40, '物体识别模型加载完成');
            } catch (modelError) {
                console.warn('物体识别模型加载失败，跳过此功能:', modelError);
                progressCallback?.(40, '物体识别模型加载失败（跳过）');
                this.objectDetector = null;
            }

            // 初始化 OCR
            progressCallback?.(45, '正在初始化文字识别...');
            console.log('开始初始化 OCR...');
            try {
                this.ocrWorker = await createWorker('chi_sim+eng', 1, {
                    workerPath: '/tesseract/worker.min.js',
                    langPath: '/tesseract',
                    corePath: '/tesseract',
                    logger: (m) => {
                        console.log('OCR:', m.status, m.progress);
                        if (m.status === 'loading tesseract core') {
                            progressCallback?.(45, 'OCR: 加载核心模块...');
                        } else if (m.status === 'initializing tesseract') {
                            progressCallback?.(48, 'OCR: 初始化中...');
                        } else if (m.status === 'loading language traineddata') {
                            progressCallback?.(50, 'OCR: 加载语言包...');
                        }
                    }
                });
                console.log('OCR 初始化完成');
                progressCallback?.(55, '文字识别初始化完成');
            } catch (ocrError) {
                console.warn('OCR 初始化失败，跳过此功能:', ocrError);
                progressCallback?.(55, 'OCR 初始化失败（跳过）');
                this.ocrWorker = null;
            }
            
            return true;
        } catch (error) {
            console.error('帧分析器初始化失败:', error);
            progressCallback?.(55, '初始化失败: ' + error.message);
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
                console.log('开始物体检测，时间戳:', frame.timestamp);
                // 从 canvas 获取图像进行检测
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = frame.imageUrl;
                });
                
                const predictions = await this.objectDetector.detect(img);
                console.log('检测到', predictions.length, '个物体');
                result.objects = predictions.map(p => ({
                    class: p.class,
                    score: p.score,
                    bbox: p.bbox
                }));
            } else {
                console.log('物体检测器未加载，跳过');
                result.objects = [];
            }

            // OCR 文字识别
            if (this.ocrWorker) {
                console.log('开始 OCR 识别');
                try {
                    const { data: { text } } = await this.ocrWorker.recognize(frame.imageUrl);
                    result.text = text.trim();
                    console.log('OCR 识别完成');
                } catch (ocrError) {
                    console.warn('OCR识别失败:', ocrError);
                    result.text = '';
                }
            } else {
                console.log('OCR 工作器未加载，跳过');
                result.text = '';
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
