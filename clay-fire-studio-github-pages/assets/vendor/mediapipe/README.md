# MediaPipe Tasks Vision

本项目在浏览器本地加载以下第三方运行时：

- `@mediapipe/tasks-vision` `1.2.0`
- 来源：<https://www.npmjs.com/package/@mediapipe/tasks-vision>
- 许可证：Apache License 2.0，见同目录 `LICENSE`

使用的文件：

- `vision_bundle.mjs`
- `wasm/vision_wasm_internal.js`
- `wasm/vision_wasm_internal.wasm`
- `wasm/vision_wasm_nosimd_internal.js`
- `wasm/vision_wasm_nosimd_internal.wasm`

手部模型：

- `hand_landmarker.task`
- 来源：<https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task>

模型和运行时均随项目提供，不需要在游戏运行时访问 CDN。若浏览器无法加载本地模块，项目会回退到基础区域追踪；鼠标和触屏输入保持完整可用。
