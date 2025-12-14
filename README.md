# 🎬 视频内容分析器

一个完全基于浏览器端的 MP4 视频内容分析工具，使用 AI 模型进行音频转录、物体识别和文字识别。

## ✨ 特性

- 🔒 **完全本地处理** - 所有分析都在浏览器中进行，视频文件不会上传到任何服务器
- 🎤 **音频转录** - 使用 Whisper 模型识别视频中的语音内容（支持中文）
- 👁️ **物体识别** - 使用 COCO-SSD 模型检测视频帧中的物体
- 📝 **文字识别** - 使用 Tesseract.js OCR 识别视频帧中的文字（支持中英文）
- 🖼️ **关键帧提取** - 自动提取视频的关键帧进行分析
- 📊 **JSON 导出** - 将分析结果导出为结构化的 JSON 数据

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000` 即可使用。

### 构建生产版本

```bash
npm run build
```

构建结果将输出到 `dist` 目录。

## 📖 使用方法

1. 点击"选择文件"按钮，选择一个 MP4 视频文件
2. 视频预览会显示在页面上
3. 点击"开始分析"按钮
4. 等待分析完成（首次使用需要下载 AI 模型，可能需要几分钟）
5. 查看分析结果：
   - 音频转录文字
   - 关键帧中识别的物体和文字
   - 完整的 JSON 数据

## 🛠️ 技术栈

- **前端框架**: Vite
- **AI 模型**:
  - `@xenova/transformers` - Whisper 语音识别模型
  - `@tensorflow-models/coco-ssd` - 物体检测模型
  - `tesseract.js` - OCR 文字识别
- **视频处理**: Web APIs (Canvas, Video, Audio)

## 📦 项目结构

```
analyzeVideo/
├── index.html              # 主页面
├── style.css              # 样式文件
├── main.js                # 入口文件，UI 交互逻辑
├── videoAnalyzer.js       # 视频分析主类
├── audioTranscriber.js    # 音频转录模块
├── frameAnalyzer.js       # 关键帧分析模块（物体+文字识别）
├── package.json           # 依赖配置
├── vite.config.js         # Vite 配置
└── README.md              # 项目文档
```

## 🔧 配置说明

### 关键帧数量

在 `videoAnalyzer.js` 中可以调整提取的关键帧数量：

```javascript
const frames = await this.frameAnalyzer.extractKeyframes(videoFile, 6); // 默认6帧
```

### 语音识别语言

在 `audioTranscriber.js` 中可以调整语言设置：

```javascript
const result = await this.transcriber(audioData.data, {
    language: 'chinese', // 可改为 'english' 等
    task: 'transcribe'
});
```

## ⚠️ 注意事项

1. **首次运行**: 首次使用时需要下载 AI 模型文件（约 100-200MB），请确保网络连接稳定
2. **浏览器兼容性**: 建议使用最新版本的 Chrome、Edge 或 Firefox
3. **性能**: 分析大型视频可能需要较长时间，建议使用性能较好的设备
4. **内存**: 确保浏览器有足够的内存来处理视频和 AI 模型

## 🎯 输出格式

分析结果为 JSON 格式，包含以下信息：

```json
{
  "filename": "video.mp4",
  "filesize": 1234567,
  "timestamp": "2025-12-14T...",
  "transcription": {
    "text": "转录的文字内容...",
    "duration": 30.5,
    "chunks": [...]
  },
  "keyframes": [
    {
      "timestamp": 5.2,
      "imageUrl": "data:image/jpeg;base64,...",
      "objects": [
        {
          "class": "person",
          "score": 0.95,
          "bbox": [x, y, width, height]
        }
      ],
      "text": "识别到的文字..."
    }
  ]
}
```

## 📝 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请提交 Issue。
