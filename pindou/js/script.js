// 拼豆生成器逻辑
// 包含色卡数据、图像处理、颜色量化和渲染逻辑

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 色卡数据 (MARD/通用色系匹配图纸)
    // ==========================================
    
    // 基础色 (16色 - 兼容)
    const PALETTE_BASIC = [
        { code: "W", name: "白色", hex: "#FFFFFF" },
        { code: "BK", name: "黑色", hex: "#000000" },
        { code: "G1", name: "灰色", hex: "#8B8B8B" },
        { code: "R1", name: "红色", hex: "#C60C30" },
        { code: "O1", name: "橙色", hex: "#FF8200" },
        { code: "Y1", name: "黄色", hex: "#FFC627" },
        { code: "GR1", name: "绿色", hex: "#009639" },
        { code: "GR2", name: "深绿", hex: "#004B23" },
        { code: "B1", name: "天蓝", hex: "#00AEEF" },
        { code: "B2", name: "深蓝", hex: "#0033A0" },
        { code: "P1", name: "紫色", hex: "#702082" },
        { code: "PK1", name: "粉色", hex: "#F49AC1" },
        { code: "BR1", name: "棕色", hex: "#4E3629" },
        { code: "SK1", name: "肉色", hex: "#F2C9A9" },
        { code: "T1", name: "透明", hex: "#EAEAEA" },
    ];

    // MARD 72色模拟 (A-H系列)
    const PALETTE_MARD_72 = [
        // === A 系列 (黄色/橙色系) ===
        { code: "A1", name: "奶油黄", hex: "#FFFFCC" },
        { code: "A2", name: "浅黄", hex: "#FFFF99" },
        { code: "A3", name: "柠檬黄", hex: "#FFEB3B" },
        { code: "A4", name: "中黄", hex: "#FFD700" },
        { code: "A5", name: "蛋黄", hex: "#FFC107" },
        { code: "A6", name: "橘黄", hex: "#FFB300" },
        { code: "A7", name: "深橘黄", hex: "#FFA000" },
        { code: "A8", name: "浅橙", hex: "#FFCC80" },
        { code: "A9", name: "橙色", hex: "#FF9800" },
        { code: "A10", name: "深橙", hex: "#F57C00" },
        { code: "A11", name: "红橙", hex: "#EF6C00" },
        { code: "A12", name: "浅杏", hex: "#FFE0B2" },
        { code: "A13", name: "深杏", hex: "#FFCCBC" },

        // === B 系列 (绿色系) ===
        { code: "B1", name: "荧光绿", hex: "#CCFF90" },
        { code: "B2", name: "嫩绿", hex: "#B2FF59" },
        { code: "B3", name: "浅绿", hex: "#76FF03" },
        { code: "B4", name: "草绿", hex: "#64DD17" },
        { code: "B5", name: "中绿", hex: "#43A047" },
        { code: "B6", name: "深绿", hex: "#2E7D32" },
        { code: "B7", name: "橄榄绿", hex: "#558B2F" },
        { code: "B8", name: "墨绿", hex: "#33691E" },
        { code: "B9", name: "青绿", hex: "#00E676" },
        { code: "B10", name: "薄荷绿", hex: "#69F0AE" },
        { code: "B11", name: "松石绿", hex: "#1DE9B6" },
        { code: "B12", name: "孔雀绿", hex: "#00BFA5" },

        // === C 系列 (蓝色系) ===
        { code: "C1", name: "淡蓝", hex: "#E3F2FD" },
        { code: "C2", name: "浅天蓝", hex: "#BBDEFB" },
        { code: "C3", name: "天蓝", hex: "#90CAF9" },
        { code: "C4", name: "湖蓝", hex: "#64B5F6" },
        { code: "C5", name: "中蓝", hex: "#42A5F5" },
        { code: "C6", name: "宝蓝", hex: "#2196F3" },
        { code: "C7", name: "深蓝", hex: "#1976D2" },
        { code: "C8", name: "藏青", hex: "#0D47A1" },
        { code: "C9", name: "浅青", hex: "#B3E5FC" },
        { code: "C10", name: "青色", hex: "#03A9F4" },
        { code: "C11", name: "深青", hex: "#0288D1" },
        { code: "C12", name: "靛蓝", hex: "#303F9F" },

        // === D 系列 (紫色系) ===
        { code: "D1", name: "浅紫", hex: "#F3E5F5" },
        { code: "D2", name: "香芋紫", hex: "#E1BEE7" },
        { code: "D3", name: "中紫", hex: "#CE93D8" },
        { code: "D4", name: "深紫", hex: "#BA68C8" },
        { code: "D5", name: "葡萄紫", hex: "#AB47BC" },
        { code: "D6", name: "暗紫", hex: "#8E24AA" },
        { code: "D7", name: "深暗紫", hex: "#6A1B9A" },
        { code: "D8", name: "蓝紫", hex: "#7E57C2" },
        { code: "D9", name: "深蓝紫", hex: "#512DA8" },

        // === E 系列 (粉色系) ===
        { code: "E1", name: "淡粉", hex: "#FFEBEE" },
        { code: "E2", name: "浅粉", hex: "#FFCDD2" },
        { code: "E3", name: "粉红", hex: "#EF9A9A" },
        { code: "E4", name: "桃红", hex: "#E57373" },
        { code: "E5", name: "玫红", hex: "#F48FB1" },
        { code: "E6", name: "深玫红", hex: "#F06292" },
        { code: "E7", name: "紫红", hex: "#EC407A" },
        { code: "E8", name: "深紫红", hex: "#D81B60" },

        // === F 系列 (红色系) ===
        { code: "F1", name: "浅红", hex: "#FF8A80" },
        { code: "F2", name: "朱红", hex: "#FF5252" },
        { code: "F3", name: "大红", hex: "#FF1744" },
        { code: "F4", name: "深红", hex: "#D50000" },
        { code: "F5", name: "暗红", hex: "#B71C1C" },
        { code: "F6", name: "酒红", hex: "#880E4F" },

        // === G 系列 (棕色/肤色系) ===
        { code: "G1", name: "浅肤", hex: "#FFE0B2" },
        { code: "G2", name: "肤色", hex: "#FFCC80" },
        { code: "G3", name: "深肤", hex: "#FFB74D" },
        { code: "G4", name: "沙色", hex: "#D7CCC8" },
        { code: "G5", name: "浅棕", hex: "#BCAAA4" },
        { code: "G6", name: "中棕", hex: "#A1887F" },
        { code: "G7", name: "深棕", hex: "#795548" },
        { code: "G8", name: "咖啡", hex: "#5D4037" },
        { code: "G9", name: "深咖", hex: "#3E2723" },

        // === H 系列 (黑白灰系) ===
        { code: "H1", name: "白色", hex: "#FFFFFF" },
        { code: "H2", name: "浅灰", hex: "#F5F5F5" },
        { code: "H3", name: "银灰", hex: "#E0E0E0" },
        { code: "H4", name: "中灰", hex: "#9E9E9E" },
        { code: "H5", name: "深灰", hex: "#616161" },
        { code: "H6", name: "炭黑", hex: "#424242" },
        { code: "H7", name: "黑色", hex: "#000000" }
    ];

    const PALETTES = {
        basic: PALETTE_BASIC,
        mard72: PALETTE_MARD_72,
        grayscale: [
            { code: "W", name: "白色", hex: "#FFFFFF" },
            { code: "LG", name: "浅灰", hex: "#D3D3D3" },
            { code: "G", name: "中灰", hex: "#808080" },
            { code: "DG", name: "深灰", hex: "#696969" },
            { code: "BK", name: "黑色", hex: "#000000" }
        ]
    };

    // 预计算所有色卡的 Lab 值，加速查找
    // 这是一个对象，Key是 Palette Name，Value是计算好的 Lab 数组
    const PALETTE_LAB_CACHE = {};

    function precomputeLab(paletteName) {
        if (PALETTE_LAB_CACHE[paletteName]) return PALETTE_LAB_CACHE[paletteName];

        const palette = PALETTES[paletteName];
        const labs = palette.map(p => {
            const rgb = hexToRgb(p.hex);
            const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
            return { ...p, lab: lab };
        });

        PALETTE_LAB_CACHE[paletteName] = labs;
        return labs;
    }


    // ==========================================
    // 2. DOM 元素
    // ==========================================
    const els = {
        imageUpload: document.getElementById('imageUpload'),
        widthSlider: document.getElementById('gridWidth'),
        widthInput: document.getElementById('gridWidthInput'),
        paletteSelect: document.getElementById('paletteSelect'),
        showGrid: document.getElementById('showGrid'),
        processBtn: document.getElementById('processBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        canvas: document.getElementById('mainCanvas'),
        stats: document.getElementById('stats'),
        colorList: document.getElementById('colorList'),
        uploadLabel: document.querySelector('.custom-file-upload'),
        tooltip: document.getElementById('pixelTooltip'),
        canvasWrapper: document.querySelector('.canvas-wrapper'),
        emptyState: document.getElementById('emptyState')
    };

    const ctx = els.canvas.getContext('2d');
    
    // 状态变量
    let state = {
        originalImage: null, // Image 对象
        gridWidth: 50,
        palette: 'mard72', // 默认使用 MARD 72色
        showGrid: true,
        useDithering: false, // 默认关闭抖动
        enhanceColor: true, // 默认开启增强
        quantizedResult: null // 存储量化结果 { colors: [], colorObjects: [], width, height }
    };

    // ==========================================
    // 3. 事件监听
    // ==========================================
    
    // 图片上传
    els.imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('请上传有效的图片文件！');
            return;
        }

        els.uploadLabel.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                state.originalImage = img;
                processImage(); 
            };
            img.onerror = () => {
                alert('图片加载失败，请重试。');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 宽度滑块事件
    els.widthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.gridWidth = val;
        els.widthInput.value = val;
    });

    els.widthInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (val < 10) val = 10;
        if (val > 150) val = 150;
        state.gridWidth = val;
        els.widthSlider.value = val;
        els.widthInput.value = val;
    });

    els.processBtn.addEventListener('click', () => {
        if (state.originalImage) {
            processImage();
        } else {
            alert('请先选择一张图片！');
        }
    });

    els.downloadBtn.addEventListener('click', () => {
        if (!state.quantizedResult) return;
        downloadFullSheet();
    });

    // 交互：鼠标悬停显示色号 Tooltip
    els.canvas.addEventListener('mousemove', (e) => {
        if (!state.quantizedResult) return;
        
        const rect = els.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = els.canvas.width / rect.width;
        const scaleY = els.canvas.height / rect.height;
        
        const canvasX = x * scaleX;
        const canvasY = y * scaleY;
        const blockSize = 20; 
        const gridX = Math.floor(canvasX / blockSize);
        const gridY = Math.floor(canvasY / blockSize);
        
        const { width, height, colorObjects } = state.quantizedResult;
        
        if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
            const index = gridY * width + gridX;
            const colorObj = colorObjects[index];
            
            if (colorObj && colorObj.code !== '-') {
                els.tooltip.innerHTML = `
                    <span style="display:inline-block;width:10px;height:10px;background:${colorObj.hex};border:1px solid #fff;margin-right:5px;"></span>
                    <strong>${colorObj.code}</strong> ${colorObj.name}
                `;
                els.tooltip.classList.add('visible');
                els.tooltip.style.position = 'fixed';
                els.tooltip.style.left = `${e.clientX + 15}px`;
                els.tooltip.style.top = `${e.clientY + 15}px`;
            } else {
                els.tooltip.classList.remove('visible');
            }
        } else {
            els.tooltip.classList.remove('visible');
        }
    });

    els.canvas.addEventListener('mouseleave', () => {
        els.tooltip.classList.remove('visible');
    });

    // ==========================================
    // 4. 核心逻辑
    // ==========================================

    function processImage() {
        if (!state.originalImage) return;

        state.gridWidth = parseInt(els.widthSlider.value);
        els.widthInput.value = state.gridWidth;
        state.palette = els.paletteSelect.value;
        state.showGrid = els.showGrid.checked;
        state.useDithering = false; // 强制关闭
        state.enhanceColor = true; // 强制开启

        const img = state.originalImage;
        const width = state.gridWidth;
        const aspectRatio = img.height / img.width;
        const height = Math.round(width * aspectRatio);

        els.emptyState.style.display = 'none';
        els.canvas.style.display = 'block';

        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext('2d');
        
        // 如果开启色彩增强，先应用滤镜
        if (state.enhanceColor) {
            offCtx.filter = 'saturate(1.2) contrast(1.1)';
        }
        
        offCtx.drawImage(img, 0, 0, width, height);
        // 重置 filter 避免影响后续
        offCtx.filter = 'none';
        
        const imageData = offCtx.getImageData(0, 0, width, height);
        const data = imageData.data; 
        
        // 预计算 Lab 色卡
        const currentPaletteLabs = precomputeLab(state.palette);
        
        const resultColors = []; 
        const resultObjects = []; 

        const ditherData = new Float32Array(data);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                const r = ditherData[idx];
                const g = ditherData[idx + 1];
                const b = ditherData[idx + 2];
                const a = ditherData[idx + 3];

                let bestMatch;
                
                if (a < 128) {
                    bestMatch = { code: "-", name: "背景", hex: "#FFFFFF" };
                } else {
                    // 使用 Lab 距离计算
                    bestMatch = getClosestColorLab(r, g, b, currentPaletteLabs);
                }

                resultColors.push(bestMatch.hex);
                resultObjects.push(bestMatch);

                if (state.useDithering && a >= 128) {
                    const matchRgb = hexToRgb(bestMatch.hex);
                    const errR = r - matchRgb.r;
                    const errG = g - matchRgb.g;
                    const errB = b - matchRgb.b;

                    distributeError(ditherData, x, y, width, height, errR, errG, errB);
                }
            }
        }

        state.quantizedResult = {
            colors: resultColors,
            colorObjects: resultObjects,
            width: width,
            height: height
        };

        renderToCanvas(resultObjects, width, height);
        updateStats(resultObjects);
        
        els.downloadBtn.disabled = false;
        els.processBtn.textContent = "重新生成";
    }

    function distributeError(data, x, y, w, h, er, eg, eb) {
        const addErr = (dx, dy, factor) => {
            if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) {
                const i = ((y + dy) * w + (x + dx)) * 4;
                data[i] += er * factor;
                data[i + 1] += eg * factor;
                data[i + 2] += eb * factor;
            }
        };

        addErr(1, 0, 7/16);
        addErr(-1, 1, 3/16);
        addErr(0, 1, 5/16);
        addErr(1, 1, 1/16);
    }

    /**
     * 使用 Lab 空间的欧氏距离寻找最接近颜色 (Simple Lab distance)
     * 比 RGB 更接近人眼感知
     */
    function getClosestColorLab(r, g, b, paletteLabs) {
        let minDistance = Infinity;
        let bestColor = paletteLabs[0];

        // 转换当前像素到 Lab
        const currentLab = rgbToLab(r, g, b);

        for (const p of paletteLabs) {
            const targetLab = p.lab;
            
            // CIELAB 欧氏距离 Delta E 76
            // (也可以升级为 DE2000，但计算量大，DE76 对于这种简单应用足够好)
            const dL = currentLab.l - targetLab.l;
            const da = currentLab.a - targetLab.a;
            const db = currentLab.b - targetLab.b;
            
            const distance = dL * dL + da * da + db * db; // 实际上不需要开方比较大小

            if (distance < minDistance) {
                minDistance = distance;
                bestColor = p;
            }
        }
        return bestColor;
    }

    /**
     * RGB 转 Lab (D65)
     * 参考: http://www.easyrgb.com/index.php?X=MATH
     */
    function rgbToLab(r, g, b) {
        let r1 = r / 255;
        let g1 = g / 255;
        let b1 = b / 255;

        r1 = (r1 > 0.04045) ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
        g1 = (g1 > 0.04045) ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
        b1 = (b1 > 0.04045) ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;

        let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) * 100;
        let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) * 100;
        let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) * 100;

        let x1 = x / 95.047;
        let y1 = y / 100.000;
        let z1 = z / 108.883;

        x1 = (x1 > 0.008856) ? Math.pow(x1, 1/3) : (7.787 * x1) + 16/116;
        y1 = (y1 > 0.008856) ? Math.pow(y1, 1/3) : (7.787 * y1) + 16/116;
        z1 = (z1 > 0.008856) ? Math.pow(z1, 1/3) : (7.787 * z1) + 16/116;

        return {
            l: (116 * y1) - 16,
            a: 500 * (x1 - y1),
            b: 200 * (y1 - z1)
        };
    }

    /**
     * 渲染到界面上的 Canvas
     */
    function renderToCanvas(colorObjects, gridW, gridH) {
        const blockSize = 20; 
        els.canvas.width = gridW * blockSize;
        els.canvas.height = gridH * blockSize;

        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const index = y * gridW + x;
                const obj = colorObjects[index];
                
                ctx.fillStyle = obj.hex;
                ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);

                if (obj.code !== '-') {
                    const rgb = hexToRgb(obj.hex);
                    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                    ctx.fillStyle = brightness > 128 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)";
                    ctx.fillText(obj.code, x * blockSize + blockSize/2, y * blockSize + blockSize/2);
                }
            }
        }

        if (state.showGrid) {
            drawGridLines(ctx, gridW, gridH, blockSize, els.canvas.width, els.canvas.height);
        }
    }

    function drawGridLines(context, gridW, gridH, blockSize, w, h) {
        context.strokeStyle = '#e0e0e0';
        context.lineWidth = 1;

        for (let x = 0; x <= gridW; x++) {
            context.beginPath();
            context.moveTo(x * blockSize, 0);
            context.lineTo(x * blockSize, h);
            if (x % 10 === 0) {
                context.strokeStyle = '#999';
                context.lineWidth = 1.5;
                context.stroke();
                context.lineWidth = 1;
                context.strokeStyle = '#e0e0e0';
            } else {
                context.stroke();
            }
        }

        for (let y = 0; y <= gridH; y++) {
            context.beginPath();
            context.moveTo(0, y * blockSize);
            context.lineTo(w, y * blockSize);
             if (y % 10 === 0) {
                context.strokeStyle = '#999';
                context.lineWidth = 1.5;
                context.stroke();
                context.lineWidth = 1;
                context.strokeStyle = '#e0e0e0';
            } else {
                context.stroke();
            }
        }
    }

    /**
     * 生成完整的图纸并下载
     */
    function downloadFullSheet() {
        const { colorObjects, width, height } = state.quantizedResult;
        const blockSize = 30; 
        
        const counts = {};
        colorObjects.forEach(obj => {
            if (obj.code === "-") return;
            if (!counts[obj.code]) counts[obj.code] = { ...obj, count: 0 };
            counts[obj.code].count++;
        });
        const sortedKeys = Object.keys(counts).sort(); 
        
        const cols = 4; 
        const rows = Math.ceil(sortedKeys.length / cols);
        const legendItemHeight = 40;
        const legendPadding = 20;
        const legendHeight = rows * legendItemHeight + legendPadding * 2 + 50; 

        const canvasW = width * blockSize;
        const canvasH = height * blockSize + legendHeight;
        
        const c = document.createElement('canvas');
        c.width = canvasW;
        c.height = canvasH;
        const cx = c.getContext('2d');

        cx.fillStyle = "#FFFFFF";
        cx.fillRect(0, 0, canvasW, canvasH);

        cx.font = "12px Arial";
        cx.textAlign = "center";
        cx.textBaseline = "middle";

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const obj = colorObjects[index];
                
                cx.fillStyle = obj.hex;
                cx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);

                if (obj.code !== '-') {
                    const rgb = hexToRgb(obj.hex);
                    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                    cx.fillStyle = brightness > 128 ? "#000" : "#fff";
                    cx.fillText(obj.code, x * blockSize + blockSize/2, y * blockSize + blockSize/2);
                }
            }
        }

        if (state.showGrid) {
            drawGridLines(cx, width, height, blockSize, width * blockSize, height * blockSize);
        }

        const legendStartY = height * blockSize;
        
        cx.beginPath();
        cx.moveTo(0, legendStartY);
        cx.lineTo(canvasW, legendStartY);
        cx.strokeStyle = "#333";
        cx.lineWidth = 2;
        cx.stroke();

        cx.fillStyle = "#333";
        cx.font = "bold 20px Arial";
        cx.textAlign = "left";
        cx.fillText("拼豆用量清单", 20, legendStartY + 35);

        cx.font = "14px Arial";
        const itemW = (canvasW - legendPadding * 2) / cols;
        
        sortedKeys.forEach((key, index) => {
            const item = counts[key];
            const row = Math.floor(index / cols);
            const col = index % cols;
            
            const x = legendPadding + col * itemW;
            const y = legendStartY + 60 + row * legendItemHeight;

            cx.fillStyle = item.hex;
            cx.fillRect(x, y, 20, 20);
            cx.strokeStyle = "#ccc";
            cx.strokeRect(x, y, 20, 20);

            cx.fillStyle = "#333";
            cx.textAlign = "left";
            cx.fillText(`[${item.code}] ${item.name} x ${item.count}`, x + 30, y + 15);
        });

        // App 环境下的保存逻辑
        if (window.plus) {
            try {
                plus.nativeUI.showWaiting("正在保存...");
                const base64Data = c.toDataURL('image/png');
                const bitmap = new plus.nativeObj.Bitmap("pindou_pattern");
                
                bitmap.loadBase64Data(base64Data, function() {
                    const fileName = "_doc/pindou_" + Date.now() + ".png";
                    bitmap.save(fileName, {overwrite: true, format: "png"}, function(i) {
                        plus.gallery.save(fileName, function() {
                            plus.nativeUI.closeWaiting();
                            plus.nativeUI.toast("已保存到相册");
                            bitmap.clear();
                        }, function(e) {
                            plus.nativeUI.closeWaiting();
                            plus.nativeUI.toast("保存到相册失败: " + (e.message || e));
                            bitmap.clear();
                        });
                    }, function(e) {
                        plus.nativeUI.closeWaiting();
                        plus.nativeUI.toast("保存临时文件失败: " + (e.message || e));
                        bitmap.clear();
                    });
                }, function(e) {
                    plus.nativeUI.closeWaiting();
                    plus.nativeUI.toast("加载图片数据失败: " + (e.message || e));
                    bitmap.clear();
                });
            } catch (e) {
                plus.nativeUI.closeWaiting();
                plus.nativeUI.toast("发生错误: " + e.message);
                console.error(e);
            }
            return;
        }

        // 浏览器环境下的下载逻辑
        const link = document.createElement('a');
        link.download = `pixel-pattern-${Date.now()}.png`;
        link.href = c.toDataURL();
        link.click();
    }

    function updateStats(colorObjects) {
        const counts = {};
        
        colorObjects.forEach(obj => {
            if (obj.code === "-") return;
            const key = obj.code; 
            if (!counts[key]) {
                counts[key] = {
                    count: 0,
                    obj: obj
                };
            }
            counts[key].count++;
        });

        els.colorList.innerHTML = '';
        els.stats.style.display = 'block';

        const sortedKeys = Object.keys(counts).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        sortedKeys.forEach(key => {
            const item = counts[key];
            const { count, obj } = item;

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="color-swatch" style="background-color: ${obj.hex}"></span>
                <span class="color-info">
                    <span class="color-code">[${obj.code}]</span>
                    <span class="color-name">${obj.name}</span>
                </span>
                <span class="color-count">x <strong>${count}</strong></span>
            `;
            els.colorList.appendChild(li);
        });
    }

    function hexToRgb(hex) {
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
});
