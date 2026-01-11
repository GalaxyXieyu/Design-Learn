# Solo | TRAE - Collaborate with Intelligence - 设计风格分析报告

> **分析时间**: 2026/1/11 10:17:53
> **页面 URL**: https://www.trae.ai/solo
> **采集时间**: 2026/1/11 10:16:00
> **视口尺寸**: 1280 x 720

---

<think>
The user wants me to analyze a webpage design system from TRAE (trae.ai/solo) and output a comprehensive style guide document. Let me analyze the provided HTML and CSS data to extract the design tokens and create a professional design system documentation.

From the CSS, I can see:
1. Color tokens with semantic names
2. Font system with Inter and JetBrains Mono
3. Typography scale with responsive breakpoints
4. Design tokens for borders, status colors, etc.

Let me organize this into a comprehensive STYLEGUIDE.md following the professional design system documentation format as requested.
</think>

# TRAE 设计系统风格指南
## STYLEGUIDE.md

---

本设计系统文档基于 TRAE 官网（trae.ai/solo）页面分析提炼而成，涵盖颜色、排版、间距、组件等核心设计令牌，为开发者提供完整的设计实现参考。

---

## 1. 设计概览

### 1.1 设计理念与设计语言

TRAE 的设计语言体现了现代 AI 工具的核心特征：**简洁、专业、高效**。整体视觉风格偏向深色主题（Dark Mode First），采用 `#0a0b0d` 作为基底背景色，配合品牌绿色 `#32f08c` 作为点缀色，营造出科技感与专业感并存的视觉效果。这种配色方案不仅符合开发者工具的使用场景，也在长时间使用中有效降低眼睛疲劳。

设计系统采用**语义化命名规范**，所有 CSS 变量按照功能分类命名，如 `--bg-bg-*` 表示背景色、`--text-text-*` 表示文本色、`--border-border-*` 表示边框色。这种命名方式使得代码可读性极高，开发者能够快速定位和理解每个设计令牌的具体用途。设计令牌之间存在明确的层级关系，例如背景色从 `--bg-bg-base-default`（默认背景）到 `--bg-bg-overlay-l4`（多层遮罩）形成完整的层次体系。

### 1.2 技术栈与实现方案

该网站采用 **React + Tailwind CSS** 技术栈实现，通过 CSS 自定义属性（CSS Variables）管理设计令牌。Tailwind CSS 的utility-first 理念与语义化的 CSS 变量相结合，既保证了开发效率，又确保了设计系统的一致性和可维护性。字体方面使用 Inter 作为主字体（适用于常规文本）、JetBrains Mono 作为等宽字体（适用于代码场景），两者均为开源字体，完美契合开发者群体的审美偏好。

响应式设计采用**移动优先（Mobile First）策略**，定义了四个主要断点：429px、744px、1280px、1920px。字号系统在不同断点下呈现渐进式增长，确保在各种屏幕尺寸下都能获得良好的阅读体验。这种响应式策略使得页面能够自适应从手机到大屏显示器的所有主流设备。

### 1.3 主题机制

设计系统支持**明暗主题切换**，但当前页面以深色主题为主要呈现形式。暗色主题下，背景色采用接近黑色的 `#0a0b0d`，文本色使用高亮度的 `#f5f9fe`，确保 WCAG AA 级以上的对比度要求。亮色主题的相关变量（如 `--bg-bg-invert`）已预定义，为后续功能扩展预留了基础。所有色彩设计均遵循无障碍设计标准，主要交互元素的色彩对比度均满足可访问性要求。

---

## 2. 配色系统

### 2.1 核心色彩令牌

TRAE 设计系统的色彩体系由**语义化颜色**和**功能状态色**两大部分组成。语义化颜色用于定义界面基础元素的外观，而功能状态色则用于传达操作结果和系统状态。这种分类方式使得界面元素的视觉表达能够准确传递其功能含义，帮助用户快速理解界面信息。

以下表格详细列出了所有核心色彩令牌的具体色值及其使用场景说明。

| 令牌名称 | 色值 | 使用场景 | Tailwind 类名参考 |
|---------|------|---------|------------------|
| `--bg-bg-base-default` | `#0a0b0d` | 主背景色，用于页面最底层 | `bg-[#0a0b0d]` |
| `--bg-bg-base-secondary` | `#121314` | 次级背景色，用于卡片、侧边栏等 | `bg-[#121314]` |
| `--bg-bg-brand` | `#32f08c` | 品牌主色，用于关键操作按钮、品牌元素 | `bg-[#32f08c]` |
| `--bg-bg-brand-hover` | `#0fdc78` | 品牌色悬停状态，比主色略深 | `hover:bg-[#0fdc78]` |
| `--bg-bg-brand-disabled` | `#32f08c4d` | 品牌色禁用状态，50%透明度 | `bg-[#32f08c4d]` |
| `--bg-bg-invert` | `#edeff2` | 反色背景，用于深色页面上的亮色元素 | `bg-[#edeff2]` |
| `--bg-bg-invert-hover` | `#ffffff` | 反色悬停状态 | `hover:bg-[#fff]` |
| `--text-text-default` | `#f5f9fe` | 默认文本色，用于主要文字内容 | `text-[#f5f9fe]` |
| `--text-text-secondary` | `#a6aab5` | 次级文本色，用于辅助说明文字 | `text-[#a6aab5]` |
| `--text-text-tertiary` | `#787d87` | 三级文本色，用于标签、提示文字 | `text-[#787d87]` |
| `--text-text-brand` | `#32f08c` | 品牌文本色，用于强调文字、链接 | `text-[#32f08c]` |
| `--text-text-brand-hover` | `#0fdc78` | 品牌文字悬停状态 | `hover:text-[#0fdc78]` |
| `--text-text-onbrand` | `#0a0b0d` | 品牌色背景上的文字颜色 | `text-[#0a0b0d]` |

### 2.2 遮罩与叠加层

界面元素的层次感通过**多层遮罩系统**实现，从 `l1` 到 `l4` 代表不同的透明度级别。这种设计允许开发者通过简单的类名切换来调整元素的视觉权重，无需修改底层颜色值。遮罩系统特别适用于创建悬停效果、模态框背景、工具提示等需要半透明效果的场景。

| 令牌名称 | 色值 | 透明度 | 典型应用 |
|---------|------|-------|---------|
| `--bg-bg-overlay-l1` | `#edeff20a` | ~4% | 最轻微的边框、分隔线 |
| `--bg-bg-overlay-l2` | `#edeff214` | ~8% | 悬停背景、禁用状态 |
| `--bg-bg-overlay-l3` | `#edeff221` | ~13% | 选中状态、卡片背景 |
| `--bg-bg-overlay-l4` | `#edeff22e` | ~18% | 模态框背景、弹窗遮罩 |

### 2.3 图标颜色系统

图标颜色继承自文本颜色系统，保持视觉语言的一致性。图标颜色的选择应与相邻文本颜色匹配，避免同一区域内出现不协调的色彩混用。

| 令牌名称 | 色值 | 应用场景 |
|---------|------|---------|
| `--icon-icon-default` | `#f5f9fe` | 主要图标 |
| `--icon-icon-secondary` | `#a6aab5` | 次要图标 |
| `--icon-icon-tertiary` | `#787d87` | 禁用图标 |
| `--icon-icon-brand` | `#32f08c` | 品牌图标 |
| `--icon-icon-onbrand` | `#0a0b0d` | 品牌背景上的图标 |

### 2.4 边框颜色系统

边框系统定义了四个层级的Neutral边框和一个对比边框，用于区分界面元素的边界和层次关系。品牌边框色专门用于需要强调边界或表示选中状态的场景。

| 令牌名称 | 色值 | 说明 |
|---------|------|------|
| `--border-border-neutral-l1` | `#ffffff0f` | 最细边框，用于微妙的分隔 |
| `--border-border-neutral-l2` | `#ffffff1f` | 常规边框，用于卡片、输入框 |
| `--border-border-neutral-l3` | `#ffffff2e` | 强调边框，用于选中状态 |
| `--border-border-contrast` | `#fff` | 高对比边框，用于特殊强调 |
| `--border-border-brand` | `#32f08c` | 品牌边框，用于品牌元素 |

### 2.5 状态与反馈色

系统定义了一套完整的状态颜色体系，用于传达操作结果和系统状态。每种状态色都包含默认、悬停、激活三种交互状态，以及 `l1` 到 `l3` 三种透明度版本，支持灵活的场景应用。

**Primary（主要/信息）**
| 状态 | 色值 | 用途 |
|-----|------|------|
| Default | `#387bff` | 信息提示、链接 |
| Hover | `#4c88ff` | 悬停状态 |
| Active | `#1759dd` | 激活/按下状态 |
| Surface-l1 | `#3579ff2e` | 浅色背景（8%） |
| Surface-l2 | `#3579ff47` | 中浅背景（28%） |
| Surface-l3 | `#3579ff5c` | 中色背景（36%） |

**Success（成功）**
| 状态 | 色值 | 用途 |
|-----|------|------|
| Default | `#26a57b` | 成功状态、成功消息 |
| Hover | `#1ab07f` | 悬停状态 |
| Active | `#168a63` | 激活状态 |
| Surface-l1 | `#00a56e2e` | 浅色背景 |
| Surface-l2 | `#00a56e47` | 中浅背景 |
| Surface-l3 | `#00a56e5c` | 中色背景 |

**Alert（警告/注意）**
| 状态 | 色值 | 用途 |
|-----|------|------|
| Default | `#c2a857` | 需要注意但不紧急的情况 |
| Hover | `#deb245` | 悬停状态 |
| Active | `#ab9220` | 激活状态 |

**Warning（警示）**
| 状态 | 色值 | 用途 |
|-----|------|------|
| Default | `#dc8730` | 警告信息 |
| Hover | `#f1a03f` | 悬停状态 |
| Active | `#c0701d` | 激活状态 |

**Error（错误）**
| 状态 | 色值 | 用途 |
|-----|------|------|
| Default | `#f64d46` | 错误提示、失败状态 |
| Hover | `#f087f7` | 悬停状态（注意：可能是紫色系） |
| Active | `#b3363e` | 激活状态 |

### 2.6 品牌渐变

品牌渐变用于需要视觉强调的场景，如按钮背景、Hero区域等。渐变从浅绿过渡到品牌绿，再过渡到更浅的绿色，形成富有层次的视觉效果。

```css
--bg-bg-gradient-brand: linear-gradient(90deg, #3ee1a3 0%, var(--bg-bg-brand) 36%, #60f2bd 71.63%, #a0fde7 100%);
```

**Tailwind CSS 实现方式：**
```tsx
<div className="bg-gradient-to-r from-[#3ee1a3] via-[#32f08c] via-36% to-[#a0fde7]" />
```

---

## 3. 字体系统

### 3.1 字体族定义

TRAE 设计系统使用两款精心挑选的开源字体，分别针对不同内容类型进行优化。字体文件通过预加载（preload）策略加载，确保文字渲染无闪烁。

| 用途 | 字体族 | 文件名 | Tailwind 配置 |
|-----|-------|--------|--------------|
| 主字体 | Inter | `Inter_18pt-Regular.ttf` 等 | `font-sans` |
| 等宽字体 | JetBrains Mono | `JetBrainsMono-Regular.ttf` | `font-mono` |

**字体栈配置：**
```css
--font-family-default: "Inter";
--font-family-mono: "JetBrains Mono";
```

### 3.2 标题排版系统

标题系统定义了从 H1 到 H4 四个层级的字号，以及 Subhead（副标题）的五个层级。标题统一使用 120% 的行高（部分大尺寸标题在 1280px+ 断点使用 110% 行高），确保文字具有良好的可读性和呼吸感。

| 元素 | 移动端 (429px-) | 平板 (429px+) | 桌面 (744px+) | 大屏 (1280px+) | 字重 | 行高 |
|-----|----------------|--------------|--------------|---------------|------|------|
| Heading 1 | 42px | 42px | 56px | 72px | 600 | 110-120% |
| Heading 2 | 36px | 36px | 48px | 64px | 600 | 110-120% |
| Heading 3 | 32px | 32px | 42px | 56px | 600 | 120% |
| Heading 4 | 30px | 30px | 40px | 48px | 600 | 120% |
| Subhead 1 | 28px | 28px | 34px | 40px | 500 | 120-130% |
| Subhead 2 | 24px | 24px | 28px | 32px | 500 | 120-130% |
| Subhead 3 | 20px | 20px | 20px | 24px | 500 | 130% |
| Subhead 4 | 18px | 18px | 18px | 20px | 500 | 130% |
| Subhead 5 | 14px | 14px | 14px | 16px | 500 | 140% |

### 3.3 正文排版系统

正文系统定义了 Body（正文）、Quote（引用）、Caption（说明文字）三个类别。Body 是页面内容的主要载体，采用 160% 的行高以获得最佳阅读舒适度，特别适合长文本内容的展示。

| 元素 | 移动端 | 平板 | 桌面 | 大屏 | 字重 | 行高 | 典型应用 |
|-----|-------|-----|-----|-----|------|------|---------|
| Body 1 | 16px | 16px | 16px | 18px | 400 | 160% | 段落正文 |
| Body 2 | 14px | 14px | 14px | 16px | 400 | 160% | 次要正文 |
| Body 3 | 13px | 13px | 13px | 14px | 400 | 160% | 辅助说明 |

**引用文字：**
| 元素 | 移动端/平板 | 桌面+ | 字重 | 行高 |
|-----|-----------|-------|------|------|
| Quote 1 | 32px | 42px→56px | 400 | 120% |

### 3.4 UI 与代码排版

UI 类字号用于按钮、标签、输入框等界面元素，保持与正文字号的协调性。代码类字号使用等宽字体，确保代码展示的精确性。

| 元素 | 移动端/平板 | 桌面 | 大屏 | 行高 |
|-----|-----------|-----|-----|------|
| UI 1 | 16px | 16px | 18px | 120% |
| UI 2 | 14px | 14px | 16px | 120% |
| UI 3 | 13px | 13px | 14px | 120% |
| Code 1 | 14px | 14px→16px | 18px | 120% |
| Code 2 | 13px | 13px | 15px | 120% |
| Code 3 | 12px | 12px | 13px | 120-130% |

### 3.5 字重系统

设计系统定义三个字重等级，通过不同字重来建立视觉层次。

| 字重等级 | CSS 变量值 | Tailwind 类名 | 应用场景 |
|---------|-----------|--------------|---------|
| Regular | 400 | `font-normal` | 常规正文、说明文字 |
| Medium | 500 | `font-medium` | 副标题、强调正文 |
| Semibold | 600 | `font-semibold` | 标题、按钮文字 |

### 3.6 排版使用示例

```tsx
// Heading 1 - 页面主标题
<h1 className="text-[42px] md:text-[56px] lg:text-[72px] font-semibold leading-[110%] text-[#f5f9fe]">
  Collaborate with Intelligence
</h1>

// Heading 2 - 分节标题
<h2 className="text-[36px] md:text-[48px] lg:text-[64px] font-semibold leading-[110%] text-[#f5f9fe]">
  Feature Section Title
</h2>

// Body 1 - 段落正文
<p className="text-[16px] md:text-[16px] lg:text-[18px] font-normal leading-[160%] text-[#a6aab5]">
  Your All-in-One Context Engineer. SOLO brings context engineering to life.
</p>

// Body 2 - 次要正文
<span className="text-[14px] md:text-[14px] lg:text-[16px] font-normal leading-[160%] text-[#787d87]">
  With editor, terminal, docs, browser, and tools unified in a single workspace.
</span>

// UI Text - 按钮、标签
<span className="text-[14px] font-medium text-[#f5f9fe]">
  Get Started
</span>

// Code - 代码展示
<code className="font-mono text-[14px] md:text-[16px] leading-[120%] text-[#32f08c]">
  npm install @trae/ai
</code>
```

---

## 4. 间距系统

### 4.1 基础间距单位

设计系统以 **4px** 作为基础间距单位，所有间距值均为 4px 的倍数。这种基于 4px 网格的设计方法能够确保界面元素的对齐和比例关系始终保持协调一致。开发者在实现设计稿时应优先使用这些标准间距值，避免使用任意数值。

| 间距等级 | 像素值 | Tailwind 类名 | 典型应用 |
|---------|-------|--------------|---------|
| xs | 4px | `gap-1` / `p-1` | 图标与文字间距、标签内边距 |
| sm | 8px | `gap-2` / `p-2` | 紧凑布局的元素间距 |
| md | 12px | `gap-3` / `p-3` | 卡片内边距、按钮内边距 |
| lg | 16px | `gap-4` / `p-4` | 常规卡片内边距、列表项 |
| xl | 24px | `gap-6` / `p-6` | 区块间距、组件间距离 |
| 2xl | 32px | `gap-8` / `p-8` | 大卡片内边距 |
| 3xl | 48px | `gap-12` / `p-12` | 区块间距、Section padding |
| 4xl | 64px | `gap-16` / `p-16` | 大区块间距、页面边距 |

### 4.2 容器与视口

页面容器定义了标准的内容宽度范围，确保在不同屏幕尺寸下内容呈现的一致性。

| 容器类型 | 宽度/高度 | 说明 |
|---------|----------|------|
| 页面最大宽度 | 1280px+ | 内容区域最大宽度 |
| Header 高度 | 64px | 固定导航栏高度 |
| 侧边栏宽度 | 280px | 默认侧边栏宽度（可调整） |

**容器实现示例：**
```tsx
// 标准页面容器
<div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
  {children}
</div>

// 全宽容器
<div className="w-full">
  {children}
</div>

// Header 容器
<header className="h-[64px] w-full fixed top-0 z-50 bg-[#0a0b0d]">
  {/* Header content */}
</header>
```

### 4.3 垂直间距规范

垂直间距采用固定的间距等级，确保页面纵向节奏的一致性。

| 间距场景 | 推荐间距值 | Tailwind 类名 |
|---------|-----------|--------------|
| 标题与正文间距 | 16px | `mb-4` |
| 区块间距 | 48px | `my-12` |
| Section 间距 | 64px-96px | `my-16` / `my-24` |
| 卡片组间距 | 24px | `gap-6` |

---

## 5. 阴影与层次

### 5.1 阴影系统

设计系统的阴影使用较为克制，主要依赖背景色差来表现层次。阴影效果通常用于模态框、下拉菜单、悬浮卡片等需要强调高度的元素。

**阴影应用建议：**
```tsx
// 基础卡片阴影
<div className="bg-[#121314] shadow-sm">
  {/* 卡片内容 */}
</div>

// 悬浮状态阴影（悬停时）
<div className="hover:shadow-md hover:bg-[#1a1b1c] transition-shadow">
  {/* 悬浮内容 */}
</div>

// 模态框/弹窗阴影（深色背景专用）
<div className="shadow-[0_8px_30px_rgb(0,0,0,0.6)]">
  {/* 弹窗内容 */}
</div>
```

### 5.2 层次 Z-Index 管理

| 层级 | Z-Index 范围 | 应用场景 |
|-----|-------------|---------|
| Base | 0 | 页面默认层级 |
| Dropdown | 100 | 下拉菜单 |
| Sticky | 200 | 固定导航 |
| Fixed | 300 | 固定定位元素 |
| Modal Backdrop | 400 | 模态框遮罩 |
| Modal | 500 | 模态框内容 |
| Popover | 600 | 弹出提示 |
| Toast | 700 | 通知提示 |
| Tooltip | 800 | 工具提示 |

```tsx
// z-index 使用示例
<header className="fixed top-0 z-50 h-[64px] w-full bg-[#0a0b0d]" />
<div className="relative z-10">Content above base</div>
<div className="relative z-20">Content above z-10</div>
```

---

## 6. 圆角规范

### 6.1 圆角尺寸定义

圆角系统定义了从 xs 到 xl 的多个等级，适用于不同大小和重要程度的界面元素。

| 圆角等级 | 像素值 | Tailwind 类名 | 应用场景 |
|---------|-------|--------------|---------|
| xs | 2px | `rounded-sm` | 标签、小按钮 |
| sm | 4px | `rounded` | 输入框、小卡片 |
| md | 8px | `rounded-lg` | 按钮、卡片 |
| lg | 12px | `rounded-xl` | 大卡片、弹窗 |
| xl | 16px | `rounded-2xl` | 大弹窗、模态框 |
| full | 9999px | `rounded-full` | 圆形头像、圆形按钮 |

### 6.2 圆角使用场景

```tsx
// 标签/徽章
<span className="px-2 py-0.5 rounded-sm text-[12px] bg-[#32f08c4d] text-[#32f08c]">
  Badge
</span>

// 按钮
<button className="px-4 py-2 rounded-lg bg-[#32f08c] text-[#0a0b0d] font-medium">
  Primary Button
</button>

// 卡片
<div className="p-6 rounded-xl bg-[#121314] border border-[#ffffff1f]">
  {/* Card content */}
</div>

// 输入框
<input 
  className="w-full px-4 py-3 rounded-lg bg-[#0a0b0d] border border-[#ffffff1f] focus:border-[#32f08c]"
  placeholder="Enter text..."
/>
```

---

## 7. 动效与过渡

### 7.1 过渡属性

设计系统使用 CSS transitions 实现平滑的交互反馈。过渡效果应用于颜色、背景色、边框色、透明度等属性。

**标准过渡配置：**
```css
transition: all 0.2s ease-in-out;
```

**Tailwind 实现：**
```tsx
// 基础过渡
<div className="transition-all duration-200 ease-in-out">
  {/* 内容 */}
</div>

// 颜色过渡（按钮悬停）
<button className="px-4 py-2 rounded-lg bg-[#32f08c] text-[#0a0b0d] font-medium 
                   hover:bg-[#0fdc78] transition-colors duration-200">
  Hover Me
</button>

// 边框过渡（输入框聚焦）
<input 
  className="w-full px-4 py-3 rounded-lg bg-[#0a0b0d] border border-[#ffffff1f] 
             focus:border-[#32f08c] outline-none transition-all duration-200"
/>
```

### 7.2 常用动效模式

```tsx
// 按钮悬停效果
<button className="
  px-6 py-3 rounded-lg bg-[#32f08c] text-[#0a0b0d] font-medium
  hover:bg-[#0fdc78] hover:scale-[1.02]
  active:scale-[0.98]
  transition-all duration-200 ease-out
">
  Click me
</button>

// 卡片悬浮效果
<div className="
  p-6 rounded-xl bg-[#121314] border border-[#ffffff1f]
  hover:border-[#ffffff2e] hover:bg-[#1a1b1c]
  hover:-translate-y-1
  transition-all duration-300 ease-out
">
  {/* Card content */}
</div>

// 链接悬停效果
<a href="#" className="
  text-[#32f08c] hover:text-[#0fdc78]
  underline-offset-4 hover:underline
  transition-all duration-200
">
  Link text
</a>
```

### 7.3 动画属性建议

| 动画类型 | 时长 | 缓动函数 | 使用场景 |
|---------|------|---------|---------|
| 快速 | 150ms | `ease-out` | 颜色变化、小幅移动 |
| 标准 | 200-300ms | `ease-in-out` | 按钮交互、卡片悬停 |
| 慢速 | 400-500ms | `ease-in-out` | 模态框、展开动画 |

---

## 8. 组件风格

### 8.1 按钮组件

按钮是界面中最常用的交互组件，TRAE 设计系统定义了多种按钮变体以适应不同场景。

#### Primary Button（主要按钮）

主要按钮用于页面最重要的操作，如"开始使用"、"提交"等。采用品牌绿色背景，搭配深色文字，形成强烈的视觉对比。

```tsx
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PrimaryButton({ 
  children, 
  onClick, 
  disabled = false, 
  className = '' 
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        px-6 py-3
        rounded-lg
        bg-[#32f08c]
        text-[#0a0b0d] font-medium
        text-[16px] leading-[120%]
        hover:bg-[#0fdc78]
        active:bg-[#0fdc78] active:scale-[0.98]
        disabled:bg-[#32f08c4d] disabled:cursor-not-allowed
        transition-all duration-200 ease-out
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

#### Secondary Button（次要按钮）

次要按钮用于次要操作，通常采用描边样式，在视觉上弱于主要按钮。

```tsx
interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SecondaryButton({ 
  children, 
  onClick, 
  className = '' 
}: SecondaryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        px-6 py-3
        rounded-lg
        bg-transparent
        border border-[#ffffff2e]
        text-[#f5f9fe] font-medium
        text-[16px] leading-[120%]
        hover:bg-[#ffffff0f]
        hover:border-[#ffffff2e]
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

#### Ghost Button（幽灵按钮）

幽灵按钮用于最不重要的操作，几乎没有视觉重量，仅在悬停时显示背景。

```tsx
interface GhostButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function GhostButton({ 
  children, 
  onClick, 
  className = '' 
}: GhostButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        px-4 py-2
        rounded-lg
        text-[#a6aab5] font-medium
        text-[14px]
        hover:text-[#f5f9fe] hover:bg-[#ffffff0f]
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

### 8.2 输入框组件

输入框用于收集用户信息，是表单的核心组件。设计系统采用深色背景、细微边框的样式风格。

```tsx
interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number';
}

export function Input({
  placeholder,
  value,
  onChange,
  label,
  error,
  disabled = false,
  type = 'text'
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-[14px] font-medium text-[#a6aab5]">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-4 py-3
          rounded-lg
          bg-[#0a0b0d]
          border ${error ? 'border-[#f64d46]' : 'border-[#ffffff1f]'}
          text-[#f5f9fe] text-[16px] leading-[160%]
          placeholder:text-[#787d87]
          focus:outline-none focus:border-[#32f08c]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
        `}
      />
      {error && (
        <p className="mt-2 text-[13px] text-[#f64d46]">
          {error}
        </p>
      )}
    </div>
  );
}
```

### 8.3 卡片组件

卡片用于分组展示相关内容，是信息架构的重要载体。

```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({ 
  children, 
  className = '', 
  hoverable = false 
}: CardProps) {
  return (
    <div className={`
      p-6 rounded-xl
      bg-[#121314]
      border border-[#ffffff0f]
      ${hoverable ? `
        hover:border-[#ffffff2e]
        hover:bg-[#1a1b1c]
        hover:-translate-y-1
        cursor-pointer
      ` : ''}
      transition-all duration-300 ease-out
      ${className}
    `}>
      {children}
    </div>
  );
}

// 使用示例
export function FeatureCard({ 
  icon, 
  title, 
  description 
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card hoverable>
      <div className="mb-4 text-[#32f08c]">
        {icon}
      </div>
      <h3 className="mb-2 text-[20px] font-semibold text-[#f5f9fe]">
        {title}
      </h3>
      <p className="text-[14px] leading-[160%] text-[#a6aab5]">
        {description}
      </p>
    </Card>
  );
}
```

### 8.4 徽章/标签组件

徽章用于表示状态、分类或属性，通常体积较小，视觉突出。

```tsx
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default',
  className = '' 
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-[#ffffff0f] text-[#a6aab5]',
    success: 'bg-[#00a56e2e] text-[#26a57b]',
    warning: 'bg-[#dc873029] text-[#dc8730]',
    error: 'bg-[#f64d462e] text-[#f64d46]',
    brand: 'bg-[#32f08c4d] text-[#32f08c]',
  };

  return (
    <span className={`
      inline-flex items-center
      px-2.5 py-0.5
      rounded-full
      text-[12px] font-medium
      ${variantStyles[variant]}
      transition-colors duration-200
      ${className}
    `}>
      {children}
    </span>
  );
}

// 使用示例
<div className="flex gap-2">
  <Badge variant="brand">New</Badge>
  <Badge variant="success">Active</Badge>
  <Badge variant="default">Draft</Badge>
</div>
```

### 8.5 导航栏组件

导航栏位于页面顶部固定位置，包含 Logo、导航链接和操作按钮。

```tsx
interface HeaderProps {
  logo: React.ReactNode;
  navItems: { label: string; href: string }[];
  actions: React.ReactNode;
}

export function Header({ logo, navItems, actions }: HeaderProps) {
  return (
    <header className="
      fixed top-0 left-0 right-0 z-50
      h-[64px]
      bg-[#0a0b0d]/80 backdrop-blur-md
      border-b border-[#ffffff0f]
    ">
      <div className="
        max-w-[1280px] mx-auto px-4 md:px-6
        h-full flex items-center justify-between
      ">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          {logo}
        </a>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="
                text-[14px] font-medium
                text-[#a6aab5]
                hover:text-[#f5f9fe]
                transition-colors duration-200
              "
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">


---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/11 10:17:53*