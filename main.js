import { VideoAnalyzer } from './videoAnalyzer.js';
import { AudioExtractor } from './audioExtractor.js';

// DOM元素
const videoFileInput = document.getElementById('videoFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const exportAudioBtn = document.getElementById('exportAudioBtn');
const videoPreview = document.getElementById('videoPreview');
const videoPlayer = document.getElementById('videoPlayer');
const progressDiv = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultsDiv = document.getElementById('results');
const transcriptionDiv = document.getElementById('transcription');
const framesDiv = document.getElementById('frames');
const jsonOutput = document.getElementById('jsonOutput');
const copyJsonBtn = document.getElementById('copyJson');
const downloadJsonBtn = document.getElementById('downloadJson');

let analyzer = null;
let audioExtractor = null;
let currentVideoFile = null;
let analysisResult = null;

// 视频文件选择
videoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    console.log('文件选择:', file);
    console.log('文件类型:', file ? file.type : 'null');
    
    if (file && file.type === 'video/mp4') {
        currentVideoFile = file;
        analyzeBtn.disabled = false;
        exportAudioBtn.disabled = false;
        console.log('按钮已启用, disabled =', analyzeBtn.disabled);
        
        // 预览视频
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPreview.classList.remove('hidden');
        
        // 隐藏之前的结果
        resultsDiv.classList.add('hidden');
        progressDiv.classList.add('hidden');
    } else {
        console.log('文件类型不匹配或没有文件');
    }
});

// 开始分析
analyzeBtn.addEventListener('click', async () => {
    if (!currentVideoFile) return;
    
    analyzeBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    resultsDiv.classList.remove('hidden');
    
    // 初始化分析器
    if (!analyzer) {
        analyzer = new VideoAnalyzer();
        await analyzer.init((progress, message) => {
            updateProgress(progress, message);
        });
    }
    
    try {
        // 执行分析
        analysisResult = await analyzer.analyze(currentVideoFile, (progress, message) => {
            updateProgress(progress, message);
        });
        
        // 显示结果
        displayResults(analysisResult);
        updateProgress(100, '分析完成！');
        
    } catch (error) {
        console.error('分析失败:', error);
        alert('分析失败: ' + error.message);
    } finally {
        analyzeBtn.disabled = false;
    }
});

// 更新进度
function updateProgress(percent, message) {
    progressBar.style.width = percent + '%';
    progressText.textContent = message;
}

// 显示结果
function displayResults(result) {
    // 显示转录结果
    if (result.transcription && result.transcription.text) {
        transcriptionDiv.innerHTML = `<p>${result.transcription.text || '未检测到音频内容'}</p>`;
    } else {
        transcriptionDiv.innerHTML = '<p>未检测到音频内容</p>';
    }
    
    // 显示关键帧分析
    framesDiv.innerHTML = '';
    if (result.keyframes && result.keyframes.length > 0) {
        result.keyframes.forEach((frame, index) => {
            const frameDiv = document.createElement('div');
            frameDiv.className = 'frame-item';
            
            let objectsHtml = '';
            if (frame.objects && frame.objects.length > 0) {
                objectsHtml = '<div class="objects">' + 
                    frame.objects.map(obj => 
                        `<span class="object-tag">${obj.class} (${(obj.score * 100).toFixed(1)}%)</span>`
                    ).join('') + 
                    '</div>';
            }
            
            let textHtml = '';
            if (frame.text && frame.text.trim()) {
                textHtml = `<p><strong>识别文字:</strong> ${frame.text}</p>`;
            }
            
            frameDiv.innerHTML = `
                <img src="${frame.imageUrl}" alt="关键帧 ${index + 1}">
                <h4>帧 ${index + 1} (${frame.timestamp.toFixed(2)}s)</h4>
                ${textHtml}
                ${objectsHtml}
            `;
            
            framesDiv.appendChild(frameDiv);
        });
    } else {
        framesDiv.innerHTML = '<p class="loading">未提取到关键帧</p>';
    }
    
    // 显示JSON
    jsonOutput.textContent = JSON.stringify(result, null, 2);
}

// 复制JSON
copyJsonBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2))
        .then(() => alert('已复制到剪贴板！'))
        .catch(err => alert('复制失败: ' + err));
});

// 下载JSON
downloadJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// 导出音频为MP3
exportAudioBtn.addEventListener('click', async () => {
    if (!currentVideoFile) return;
    
    exportAudioBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    
    try {
        // 初始化音频提取器
        if (!audioExtractor) {
            audioExtractor = new AudioExtractor();
        }
        
        // 提取音频
        updateProgress(0, '开始提取音频...');
        const audioBlob = await audioExtractor.extractAudioAsMP3(currentVideoFile, (progress, message) => {
            updateProgress(progress, message);
        });
        
        // 下载音频文件
        const filename = currentVideoFile.name.replace(/\.[^/.]+$/, '') + '-audio';
        audioExtractor.downloadAudio(audioBlob, filename);
        
        updateProgress(100, '音频导出成功！');
        
        // 3秒后隐藏进度条
        setTimeout(() => {
            progressDiv.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('音频导出失败:', error);
        alert('音频导出失败: ' + error.message);
        progressDiv.classList.add('hidden');
    } finally {
        exportAudioBtn.disabled = false;
    }
});
