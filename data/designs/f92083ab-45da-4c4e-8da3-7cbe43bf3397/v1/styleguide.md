# TRAE - Collaborate with Intelligence - 设计风格分析报告

> **分析时间**: 2026/1/14 14:22:34
> **页面 URL**: https://www.trae.ai/
> **采集时间**: 2026/1/14 14:21:42
> **视口尺寸**: 1889 x 811

---

<think>
用户要求我分析 TRAE 网站（https://www.trae.ai/）的设计系统，并输出一份详尽的设计风格指南（STYLEGUIDE.md）。

让我根据提供的 HTML 和 CSS 源码来分析设计系统：

## 关键发现：

### 1. 字体系统
- 主字体：Inter 18pt (Medium, Regular, SemiBold)
- 等宽字体：JetBrains Mono Regular
- 备用字体：ProximaNova, PingFangSC, Arial, sans-serif

### 2. 颜色系统
从 CSS 中可以看到：
- Primary（主色）：#fe2c55（红色/粉色）
- BGPrimary：var(--BGPrimary) - 背景色
- BGInput2：var(--BGInput2) - 输入框背景
- TextPrimary：var(--TextPrimary) - 主文本色
- TextQuaternary：var(--TextQuaternary) - 次要文本色
- LineSecondary2：var(--LineSecondary2) - 边框色
- Negative：错误/负向状态红色 #ff4c3a, #fe3824
- LineInput：输入框边框线颜色

### 3. 组件样式
- 按钮：圆角 4px，最小高度 48px，最小宽度 168px
- 输入框：圆角 4px，高度 46px


- 导航栏：高度 44px
- 弹窗：圆角 4px，最大高度 693px

### 4. 交互动效
- 按钮悬浮和点击时添加微妙遮罩效果
- 加载动画采用旋转动画增强用户体验
- 移动端验证码输入采用闪烁光标动效

### 5. 间距规范
- 输入框内边距 12px
- 移动端验证码输入框宽度 45px
- 移动设备间使用 .5px 分隔线

### 6. 圆角设计
- 组件采用 4px 统一圆角
- 保持整体界面简洁协调

### 7. 阴影层次
- 弹窗使用固定定位和层级管理
- 确保界面层次感和交互深度
</think>

# TRAE 设计风格指南 (STYLEGUIDE)

本文档基于 TRAE 官网（https://www.trae.ai/）的源码分析，提取并整理了一套完整的设计系统规范。本指南旨在帮助开发者和设计师理解和复用 TRAE 的设计语言，确保产品的一致性和可维护性。

---

## 1. 设计概览

### 1.1 设计理念

TRAE 的设计语言体现出一种**现代、简洁且专业**的风格特征。作为一款 AI IDE 产品，其界面设计强调**功能导向**和**内容优先**的原则。整体视觉语言偏向深色主题（默认使用 `cc--elegant-black` 类名），营造出开发者友好的技术氛围，同时通过精心调配的色彩系统保持视觉舒适度。设计系统中大量使用**圆角几何形状**（4px 基础圆角）来软化界面硬度，使专业工具呈现出友好的使用体验。

### 1.2 技术栈

基于源码分析，TRAE 网站采用以下技术实现：

- **字体加载策略**：使用 CDN 预加载机制，优先加载 Inter 18pt 字体的 Medium、Regular、SemiBold 字重，以及 JetBrains Mono 等宽字体
- **样式管理**：采用 CSS 变量系统（CSS Custom Properties）管理设计令牌，支持主题切换
- **组件封装**：遵循 BEM 命名规范的组件化样式（如 `.twv-component-button`、`.twv-components-code-input`）
- **动画实现**：使用 CSS @keyframes 定义动效，包括加载动画、过渡动画等

### 1.3 主题机制

TRAE 使用**CSS 类名切换**的方式实现主题切换，根元素上的 `cc--elegant-black` 类名表示当前使用优雅黑色主题。所有颜色值通过 CSS 变量引用（如 `var(--Primary)`、`var(--BGPrimary)`），这种设计使得主题切换只需要修改变量值即可完成，为未来的亮色主题扩展预留了良好的架构基础。

---

## 2. 配色系统

### 2.1 核心色彩令牌

TRAE 的色彩系统以**品牌红色**为核心，辅以层次分明的中性色系。以下是提取自源码的具体色值：

| 令牌名称 | 色值 | 用途说明 | Tailwind 类名建议 |
|---------|------|---------|------------------|
| `--Primary` | `#fe2c55` | 主要品牌色，用于按钮、强调元素 | `bg-rose-500` / `#fe2c55` |
| `--Negative` | `#ff4c3a` | 错误状态、警告提示 | `text-red-500` / `#ff4c3a` |
| `--NegativeAlt` | `#fe3824` | 替代错误色，用于错误文本 | `text-red-600` / `#fe3824` |
| `--BGPrimary` | 变量引用 | 主背景色（深色主题下为深黑） | `bg-neutral-950` |
| `--BGInput2` | 变量引用 | 输入框背景色，略浅于主背景 | `bg-neutral-900` |
| `--TextPrimary` | 变量引用 | 主文本色，高对比度 | `text-white` |
| `--TextQuaternary` | 变量引用 | 次要文本色、低强调度文字 | `text-neutral-400` |
| `--LineSecondary2` | 变量引用 | 次级边框线颜色 | `border-neutral-700` |
| `--LineInput` | 变量引用 | 输入框边框线颜色 | `border-neutral-600` |
| `--ConstTextInverse` | 变量引用 |  inverse 文本色（按钮上文字） | `text-white` |

### 2.2 品牌色应用规范

**主按钮（Primary Button）**

品牌红色 `#fe2c55` 是 TRAE 设计系统中最具识别度的色彩元素。它被严格应用于主要操作按钮，通过渐变叠加的方式实现悬浮和点击状态的微妙的视觉反馈。

```tsx
// 主要品牌按钮
const PrimaryButton = ({ children, disabled, onClick }) => (
  <button
    className="
      bg-[#fe2c55]
      text-white
      rounded-[4px]
      min-h-[48px]
      min-w-[168px]
      text-[18px]
      font-semibold
      flex items-center justify-center
      px-3 py-1.5
      cursor-pointer
      transition-all
      hover:bg-gradient-to-b hover:from-black/6 hover:to-transparent hover:from-0% hover:to-6%
      active:bg-gradient-to-b active:from-black/12 active:to-transparent
      disabled:bg-[var(--BGInput2)]
      disabled:text-[var(--TextQuaternary)]
      disabled:cursor-not-allowed
      outline-none
      select-none
    "
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);
```

**使用场景与注意事项**：品牌红色按钮应仅用于页面中最重要的单一操作入口，如"提交"、"发送验证码"、"开始使用"等场景。避免在同一页面中使用多个品牌色按钮，这会导致视觉重点分散。同时，确保按钮上的文字与背景的对比度符合 WCAG AA 标准（4.5:1）。

### 2.3 功能色系统

**错误状态（Negative State）**

TRAE 使用 `#ff4c3a` 和 `#fe3824` 两种红色来表达错误、警告等负向状态。在验证码输入框的错误场景中，边框线会变为错误红，同时错误提示文本使用稍浅的 `#fe3824`。

```tsx
// 错误状态输入框
const ErrorInput = ({ hasError, errorMessage }) => (
  <div className="relative">
    <input
      className={`
        w-full h-[46px] px-3
        bg-[var(--BGInput2)]
        text-[var(--TextPrimary)]
        text-[16px] leading-[22px]
        border-none outline-none
        rounded-l-[4px]
        placeholder:text-[var(--TextQuaternary)]
        ${hasError ? 'border border-[#ff4c3a]' : ''}
      `}
      placeholder="请输入验证码"
    />
    {hasError && (
      <span className="text-[#fe3824] text-[12px] leading-[15px] mt-1 block">
        {errorMessage}
      </span>
    )}
  </div>
);
```

**加载动画颜色**

加载环（Loading Ring）使用 `var(--BGPrimary)` 作为 SVG 填充色，这与页面背景融为一体，形成优雅的旋转效果。光标颜色（caret-color）也使用了品牌红色 `#fe2c55`，与整体设计语言保持一致。

### 2.4 中性色阶

TRAE 的中性色系统主要用于构建界面的层次结构，包括背景色、边框色、文字色等层级。这些颜色通过 CSS 变量统一管理，便于统一调整：

- **背景层级**：主背景 `BGPrimary` → 输入框背景 `BGInput2`（略浅）
- **文字层级**：主文本 `TextPrimary`（高亮白）→ 次要文本 `TextQuaternary`（灰白色）
- **边框层级**：次级边框 `LineSecondary2` → 输入框边框 `LineInput`

---

## 3. 字体系统

### 3.1 字体族配置

TRAE 的字体系统采用**Inter 18pt**作为主要字体，配合**JetBrains Mono**作为代码展示字体，辅以多种系统字体作为 fallback：

| 用途 | 字体栈 | Tailwind 配置 |
|-----|-------|--------------|
| 主字体（Body） | Inter 18pt, ProximaNova, PingFangSC, Arial, sans-serif | `font-sans` |
| 等宽字体（Code） | JetBrains Mono, monospace | `font-mono` |
| 按钮字体 | "ProximaNova, PingFangSC, sans-serif" | `font-sans` |
| 错误文本 | "ProximaNova, Arial, Tahoma, PingFangSC, sans-serif" | `font-sans` |

```tsx
// Tailwind 字体配置建议
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['"Inter 18pt"', 'ProximaNova', 'PingFangSC', 'Arial', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
    },
  },
};
```

### 3.2 排版层级

**字号与行高规范**

TRAE 的字体系统使用**16px 作为基础字号**，配合不同字重来建立视觉层级：

| 元素类型 | 字号 | 行高 | 字重 | 说明 |
|---------|------|------|------|------|
| 页面大标题 | - | - | - | 源码中未明确，可能是更大尺寸 |
| 按钮文字 | 18px | 25px | 600 (SemiBold) | 主要操作按钮 |
| 输入框文字 | 16px | 22px | 400 (Regular) | 表单输入、验证码 |
| 错误提示 | 12px | 15px | - | 辅助说明文字 |
| 移动端更多文字 | 15px | 17px | - | 次要信息 |
| 验证码输入格 | 15px | 45px | - | 垂直居中于 45px 高度 |

```tsx
// 排版样式映射
const typographyStyles = {
  button: "text-[18px] leading-[25px] font-[600]",
  body: "text-[16px] leading-[22px] font-[400]",
  caption: "text-[12px] leading-[15px]",
  mobileBody: "text-[15px] leading-[17px]",
  codeCell: "text-[15px] leading-[45px] text-center",
};
```

### 3.3 等宽字体应用

JetBrains Mono 字体被预加载用于代码展示场景。在验证码输入场景中，每个输入格使用 `text-[15px]` 的字号，行高设置为 `45px`（与容器高度一致），实现文字在垂直方向的完美居中。

```tsx
// 验证码等宽输入格
const CodeCell = ({ value, isSelected }) => (
  <div 
    className={`
      w-[45px] h-[45px]
      text-[15px] leading-[45px] text-center
      relative
      border-b border-[rgba(22,24,35,0.5)]
      ${isSelected ? '' : ''}
    `}
  >
    {value}
    {isSelected && (
      <span className="absolute left-1/2 top-[31.25%] h-[20px] w-[2px] bg-[#ff5000] animate-pulse" />
    )}
  </div>
);
```

---

## 4. 间距与布局系统

### 4.1 基础尺寸单位

TRAE 的设计系统以**4px 作为基础网格单位**，所有尺寸都是 4px 的倍数，这种设计保证了视觉上的一致性和开发效率：

| 用途 | 尺寸值 | 对应单位 |
|-----|-------|---------|
| 圆角基数 | 4px | `rounded-[4px]` |
| 按钮高度 | 48px | 12 单位 |
| 输入框高度 | 46px | 11.5 单位 |
| 导航栏高度 | 44px | 11 单位 |
| 验证码格尺寸 | 45px | 11.25 单位 |
| 验证码分隔线宽度 | 71px / 43px | 不规则值 |
| 移动端分隔线 | 0.5px | 极细线条 |

### 4.2 容器与内边距

**固定宽度弹窗**

Web 端验证码弹窗采用**固定尺寸设计**，这种设计确保了不同屏幕尺寸下的一致体验：

```tsx
// Web 端弹窗容器
const WebModal = ({ children }) => (
  <div 
    className="
      fixed top-1/2 left-1/2
      -translate-x-1/2 -translate-y-1/2
      w-[483px] max-h-[693px]
      rounded-[4px]
      bg-[var(--BGPrimary)]
      p-[81px_48px]
      z-[7001]
    "
  >
    {children}
  </div>
);
```

**移动端全屏弹窗**

移动端采用全屏布局设计，移除固定宽度限制：

```tsx
// 移动端容器
const MobileView = ({ children }) => (
  <div 
    className="
      fixed top-0 left-0
      w-screenvw h-full
      bg-[var(--BGPrimary)]
      p-[0_32px_12px]
      z-[99]
      flex flex-col
    "
  >
    {children}
  </div>
);
```

### 4.3 组件间距规范

**验证码输入组间距**

整个验证码输入组件使用 Flexbox 布局实现水平排列，元素间通过自然间距分隔：

```tsx
// 验证码输入容器
const CodeInputGroup = () => (
  <div 
    className="
      flex flex-row
      h-[46px]
      justify-between
      w-full
    "
  >
    <div className="flex-1">
      <input 
        className="w-full h-full bg-[var(--BGInput2)] rounded-l-[4px] px-3"
      />
    </div>
    <button 
      className="
        h-full min-w-[160px]
        border border-[var(--LineSecondary2)]
        rounded-r-[4px]
        text-[16px] font-bold
      "
    >
      发送验证码
    </button>
  </div>
);
```

**内部元素间距**

根据源码分析，各元素间的间距遵循以下规范：

- 输入框与按钮间距：无间距（相邻布局）
- 标题与内容间距：24px（`margin-bottom-[24px]`）
- 按钮与上方元素间距：15px（`margin-top-[15px]`）
- 错误提示与输入框间距：4px（`margin-[4px_0]`）
- 移动端标题间距：24px（`margin-top-[24px]`）

---

## 5. 组件风格规范

### 5.1 按钮组件（Button）

**主要品牌按钮**

这是 TRAE 设计系统中最核心的交互组件，采用品牌红色背景配合精细的交互状态设计：

```tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  onClick,
  className = '',
}) => {
  const baseStyles = `
    relative
    flex items-center justify-center
    box-border
    font-sans
    text-[18px] font-[600] leading-[25px]
    min-h-[48px] min-w-[168px]
    rounded-[4px]
    outline-none
    select-none
    cursor-pointer
    transition-all duration-150
    ${disabled ? 'bg-[var(--BGInput2)] text-[var(--TextQuaternary)] cursor-not-allowed pointer-events-none' : ''}
    ${!disabled && variant === 'primary' ? 'bg-[#fe2c55] text-white' : ''}
  `;

  return (
    <button
      className={`${baseStyles} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {loading && (
        <span className="icon-button-loading absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
          <svg 
            className="animate-spin h-5 w-5" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 

---

*本报告由 Frontend Style Generator AI 自动生成*
*使用模板: 默认模板*
*生成时间: 2026/1/14 14:22:34*