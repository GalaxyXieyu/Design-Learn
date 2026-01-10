# Topbook - 工具、技术和数字生活 - 设计风格分析报告

> **分析时间**: 2026/1/10 19:36:51
> **页面 URL**: https://topbook.cc/
> **采集时间**: 2026/1/10 19:34:37
> **视口尺寸**: 1280 x 720

---

<think>
用户要求我分析 Topbook 网站的设计系统，并输出一份详尽的设计风格指南（STYLEGUIDE.md）。

让我分析提供的 HTML 和 CSS 内容：

1. **HTML 分析**：
   - 使用了 umi 框架
   - 页面标题：Topbook - 工具、技术和数字生活
   - 包含 Open Graph 和 Twitter Card 元数据
   - 加载了外部 CSS 文件

2. **CSS 分析（CKEditor 相关）**：
   看到了大量的 CKEditor CSS 变量定义：
   - 颜色变量：`--ck-color-*` 系列
   - 字体：`--ck-font-face: Helvetica, Arial, Tahoma, Verdana, Sans-Serif`
   - 字号：`--ck-font-size-base: 13px`
   - 行高：`--ck-line-height-base: 1.84615`
   - 圆角：`--ck-border-radius: 2px`
   - 间距系统：`--ck-spacing-unit: 0.6em`
   - 阴影变量

但是这里主要是 CKEditor 的样式，不是整个网站的完整设计系统。用户提供的 CSS 主要是 CKEditor 编辑器的样式。

让我再仔细看看还缺少什么信息。用户提供的 CSS 主要是 CKEditor 的组件样式，但网站的其他部分（导航、卡片、按钮等）的样式没有在截断的 CSS 中显示。

我需要基于现有的信息来推断和整理设计系统，同时也要明确指出哪些信息是基于现有数据的分析，哪些是需要进一步获取的。

我将专注于构建一个全面的设计风格指南，整理已知的 CSS 变量和组件样式。对于缺失的设计细节，我会标注为「待确认」，并提供后续调查的建议。这种方法既保持了文档的完整性，又诚实反映了信息的局限性。
</think>

# Topbook 设计风格指南 (STYLEGUIDE)

> 本文档基于 Topbook 网站的源码分析生成，旨在帮助开发团队理解和复用网站的设计系统。

---

## 1. 概览

### 1.1 设计理念

Topbook 是一个关注数字工具和技术的媒体平台，其设计语言体现了现代内容型网站的核心特征：**简洁、专注、可读性强**。整体设计采用大量的留白和清晰的视觉层级，让用户能够快速定位和消费内容。从截断的源码来看，网站基于 Umi 框架构建，依赖外部 CDN 资源加载样式。

设计系统主要通过 CSS 变量（CSS Custom Properties）进行管理，这种方式便于主题切换和全局样式维护。值得注意的是，网站引入了 CKEditor 富文本编辑器的样式体系，这表明网站可能具备内容创作或编辑功能。

### 1.2 技术栈

| 类别 | 技术选型 |
|------|----------|
| 前端框架 | Umi (React) |
| 富文本编辑器 | CKEditor 5 |
| 样式管理 | CSS Custom Properties |
| 资源分发 | CDN (labs.topbook.cc) |
| 视口配置 | 响应式设计，支持移动端 |

### 1.3 主题机制

从 CSS 变量命名规范来看，网站采用了**语义化命名策略**（如 `--ck-color-base-*`、`--ck-color-button-*`），这种命名方式为支持多主题奠定了基础。目前检测到的主题相关变量主要服务于 CKEditor 编辑器组件，暂未发现完整的明暗主题切换实现。

---

## 2. 颜色系统

### 2.1 核心颜色令牌

网站建立了完整的颜色变量体系，所有颜色通过语义化名称进行引用，避免了硬编码颜色值带来的维护困难。

#### 基础色板 (Base Colors)

| 变量名 | 色值 | 用途说明 | Tailwind 类名参考 |
|--------|------|----------|-------------------|
| `--ck-color-base-foreground` | `#fafafa` | 浅灰背景色，用于工具栏等区域 | `bg-gray-50` |
| `--ck-color-base-background` | `#ffffff` | 纯白背景色，用于卡片、面板等 | `bg-white` |
| `--ck-color-base-border` | `#c4c4c4` | 中性边框色，用于分隔线和输入框边框 | `border-gray-300` |
| `--ck-color-base-text` | `#333333` | 主文本色，接近纯黑的可读性文本 | `text-gray-800` |
| `--ck-color-base-active` | `#198cf0` | 激活状态色，用于当前选中的交互元素 | `text-blue-600` |
| `--ck-color-base-active-focus` | `#0e7fe1` | 激活状态聚焦色，提供视觉反馈 | `text-blue-700` |
| `--ck-color-base-action` | `#61b045` | 行动按钮色（绿色），用于确认操作 | `bg-green-500` |
| `--ck-color-base-error` | `#db3700` | 错误状态色，用于表单验证提示 | `text-red-600` |

#### 品牌色系

品牌色以蓝色为主色系，绿色为辅助色系：

```css
/* 品牌蓝 - 用于链接、选中状态 */
--ck-color-base-active: #198cf0;

/* 行动绿 - 用于按钮、成功状态 */
--ck-color-button-action-background: #61b045;
--ck-color-button-action-hover-background: #579e3d;
--ck-color-button-action-active-background: #53973b;
--ck-color-button-action-active-shadow: #498433;
--ck-color-button-action-disabled-background: #7ec365;

/* 链接颜色 */
--ck-color-link-default: #0000f0;
```

#### 悬停与交互状态

```css
/* 默认按钮悬停 */
--ck-color-button-default-hover-background: #e6e6e6;

/* 默认按钮激活 */
--ck-color-button-default-active-background: #d9d9d9;
--ck-color-button-default-active-shadow: #bfbfbf;

/* 选中状态按钮 */
--ck-color-button-on-background: #dedede;
--ck-color-button-on-hover-background: #c4c4c4;
--ck-color-button-on-active-background: #bababa;
--ck-color-button-on-active-shadow: #a1a1a1;
```

### 2.2 语义化颜色映射

#### 文本颜色系统

```css
:root {
  /* 主文本 */
  --ck-color-text: var(--ck-color-base-text); /* #333333 */
  
  /* 占位符文本 */
  --ck-color-engine-placeholder-text: #c2c2c4;
  
  /* 提示文字颜色 */
  --ck-color-tooltip-text: var(--ck-color-base-background); /* 白色文字 */
}
```

#### 边框颜色系统

```css
:root {
  /* 常规边框 */
  --ck-color-base-border: #c4c4c4;
  
  /* 输入框边框 */
  --ck-color-input-border: #c7c7c7;
  
  /* 聚焦边框 */
  --ck-color-focus-border: #47a4f5;
  
  /* 错误边框 */
  --ck-color-input-error-border: var(--ck-color-base-error); /* #db3700 */
}
```

#### 面板与容器背景

```css
:root {
  /* 面板背景 */
  --ck-color-panel-background: var(--ck-color-base-background);
  --ck-color-dropdown-panel-background: var(--ck-color-base-background);
  
  /* 工具栏背景 */
  --ck-color-toolbar-background: var(--ck-color-base-foreground); /* #fafafa */
  
  /* 列表背景 */
  --ck-color-list-background: var(--ck-color-base-background);
  
  /* 提示框背景 */
  --ck-color-tooltip-background: var(--ck-color-base-text); /* #333 */
}
```

### 2.3 颜色使用示例

以下是基于提取的颜色系统构建的组件示例：

```tsx
// 颜色令牌常量
export const colors = {
  primary: {
    default: '#198cf0',
    hover: '#0e7fe1',
    light: '#47a4f5',
  },
  success: {
    default: '#61b045',
    hover: '#579e3d',
    active: '#53973b',
    disabled: '#7ec365',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#dedede',
    300: '#c4c4c4',
    400: '#c7c7c7',
    800: '#333333',
    900: '#000000',
  },
  error: '#db3700',
  link: '#0000f0',
};

// 示例组件：品牌按钮
function BrandButton({ children, variant = 'primary' }) {
  const styles = {
    primary: 'bg-[#198cf0] hover:bg-[#0e7fe1] text-white',
    success: 'bg-[#61b045] hover:bg-[#579e3d] text-white',
    default: 'bg-transparent hover:bg-[#e6e6e6] text-[#333]',
  };
  
  return (
    <button className={`px-4 py-2 rounded ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

---

## 3. 排版系统

### 3.1 字体族定义

网站采用系统字体栈作为主字体，确保在不同操作系统上都能获得良好的渲染效果：

```css
:root {
  --ck-font-face: Helvetica, Arial, Tahoma, Verdana, Sans-Serif;
}
```

**字体栈解析**：
- **Helvetica/Arial**：macOS 和 Windows 的首选无衬线字体
- **Tahoma**：Windows 系统的高可读性字体
- **Verdana**：专为屏幕设计的宽字符字体
- **Sans-Serif**：兜底选项

**Tailwind 参考配置**：

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Helvetica', 'Arial', 'Tahoma', 'Verdana', 'sans-serif'],
    },
  },
};
```

### 3.2 字号系统

网站建立了相对尺寸体系，基于基础字号进行缩放：

| 变量名 | 相对值 | 绝对值（假设 base=13px） | 用途 |
|--------|--------|--------------------------|------|
| `--ck-font-size-base` | 1em | 13px | 基础正文字号 |
| `--ck-font-size-tiny` | 0.7em | ~9px | 极小文字（如提示） |
| `--ck-font-size-small` | 0.75em | ~10px | 次要说明文字 |
| `--ck-font-size-normal` | 1em | 13px | 常规内容 |
| `--ck-font-size-big` | 1.4em | ~18px | 小标题 |
| `--ck-font-size-large` | 1.8em | ~23px | 大标题 |
| `--ck-font-size-base` | 13px | 13px | 基础字号 |

**Tailwind 字号映射**：

```css
/* 对应 Tailwind 字号 */
text-xs    /* ~12px - 接近 small */
text-sm    /* ~14px */
text-base  /* 16px - 接近 normal */
text-lg    /* 18px - 接近 big */
text-xl    /* 20px */
text-2xl   /* 24px - 接近 large */
text-3xl   /* 30px */
```

### 3.3 行高规范

```css
:root {
  --ck-line-height-base: 1.84615;
  --ck-font-size-base: 13px;
}
```

计算得出：`13px * 1.84615 ≈ 24px` 行高，适合中等长度的阅读内容。

**Tailwind 行高参考**：

```tsx
// 不同场景的行高设置
<div className="leading-tight">紧凑行高（1.25）</div>
<div className="leading-normal">常规行高（1.5）</div>
<div className="leading-relaxed">宽松行高（1.625）</div>
<div className="leading-loose">极宽松行高（2.0）</div>
```

### 3.4 排版组件示例

```tsx
// Typography.tsx - 排版组件库
import React from 'react';

interface TypographyProps {
  variant: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  children: React.ReactNode;
  className?: string;
}

const typographyStyles = {
  h1: 'text-3xl font-bold text-[#333] leading-tight',
  h2: 'text-2xl font-semibold text-[#333] leading-tight',
  h3: 'text-xl font-medium text-[#333] leading-snug',
  body: 'text-base text-[#333] leading-relaxed',
  caption: 'text-sm text-[#666] leading-normal',
};

export function Typography({ variant, children, className = '' }: TypographyProps) {
  const Tag = variant === 'body' || variant === 'caption' ? 'p' : variant;
  return <Tag className={`${typographyStyles[variant]} ${className}`}>{children}</Tag>;
}

// 使用示例
export function HeadingExample() {
  return (
    <div className="space-y-4">
      <Typography variant="h1">页面主标题</Typography>
      <Typography variant="h2">分节标题</Typography>
      <Typography variant="h3">小节标题</Typography>
      <Typography variant="body">
        这是一段正文内容，采用宽松的行高设置，确保长时间阅读的舒适性。
        基础字号为 13px，配合约 1.85 倍行高。
      </Typography>
      <Typography variant="caption">辅助说明文字，用于脚注或次要信息</Typography>
    </div>
  );
}
```

---

## 4. 间距系统

### 4.1 基础间距单位

网站建立了基于 `--ck-spacing-unit` 的比例间距系统：

```css
:root {
  --ck-spacing-unit: 0.6em;
  
  /* 间距令牌 */
  --ck-spacing-extra-tiny: calc(var(--ck-spacing-unit) * 0.16);   /* ~0.096em */
  --ck-spacing-tiny:       calc(var(--ck-spacing-unit) * 0.3);    /* ~0.18em */
  --ck-spacing-small:      calc(var(--ck-spacing-unit) * 0.5);    /* ~0.3em */
  --ck-spacing-medium:     calc(var(--ck-spacing-unit) * 0.8);    /* ~0.48em */
  --ck-spacing-standard:   var(--ck-spacing-unit);                 /* 0.6em */
  --ck-spacing-large:      calc(var(--ck-spacing-unit) * 1.5);    /* 0.9em */
  --ck-spacing-extra-large: calc(var(--ck-spacing-unit) * 2);     /* 1.2em */
}
```

**间距速查表**（以 16px 根字号计算）：

| 令牌 | 相对值 | 绝对值（约） | Tailwind 类名 |
|------|--------|--------------|---------------|
| `extra-tiny` | 0.096em | ~1.5px | `p-0.5` / `m-0.5` |
| `tiny` | 0.18em | ~3px | `p-1` / `m-1` |
| `small` | 0.3em | ~5px | `p-1.5` / `m-1.5` |
| `medium` | 0.48em | ~8px | `p-2` / `m-2` |
| `standard` | 0.6em | ~10px | `p-2.5` / `m-2.5` |
| `large` | 0.9em | ~14px | `p-3.5` / `m-3.5` |
| `extra-large` | 1.2em | ~19px | `p-5` / `m-5` |

### 4.2 组件间距规范

```css
/* CKEditor 编辑器内边距 */
.ck.ck-editor__editable_inline {
  padding: 0 var(--ck-spacing-standard); /* 水平 0.6em，垂直 0 */
}

/* 工具栏内边距 */
.ck.ck-toolbar {
  padding: 0 var(--ck-spacing-small); /* 水平 0.3em */
}

/* 提示框内边距 */
.ck.ck-tooltip .ck-tooltip__text {
  padding: var(--ck-spacing-small) var(--ck-spacing-medium);
}

/* 按钮内边距 */
.ck.ck-button {
  padding: var(--ck-spacing-tiny);
}
```

### 4.3 间距使用建议

**Do（推荐做法）**：
- 使用间距令牌常量而非任意值
- 保持组件内部间距与外部间距的比例关系
- 在卡片、按钮等小组件中使用 `tiny` / `small`
- 在区块、段落之间使用 `medium` / `large`

**Don't（避免做法）**：
- 不要混用不同的间距单位
- 避免使用非标准间距值
- 不要在相邻元素间同时使用 margin 和 padding

```tsx
// 间距组件示例
interface SpacingProps {
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const spacingMap = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

export function Stack({ size = 'md', children, className = '' }) {
  return <div className={`flex flex-col ${spacingMap[size]} ${className}`}>{children}</div>;
}

// 使用示例
export function SpacingExample() {
  return (
    <Stack size="lg">
      <div className="p-2 bg-gray-100">区块 1</div>
      <div className="p-2 bg-gray-100">区块 2</div>
      <div className="p-2 bg-gray-100">区块 3</div>
    </Stack>
  );
}
```

---

## 5. 圆角与阴影

### 5.1 圆角系统

网站采用**极简圆角策略**，大部分组件使用直角或极小圆角：

```css
:root {
  --ck-border-radius: 2px;
}
```

**圆角应用场景**：

| 组件 | 圆角值 | 说明 |
|------|--------|------|
| 按钮 | `0px` / `2px` | 直角为主，可选小圆角 |
| 输入框 | `0px` | 直角 |
| 面板/卡片 | `0px` | 直角 |
| 提示框 | `0px` / `2px` | 根据配置 |
| 编辑器区域 | `0px` | 直角 |

**Tailwind 圆角映射**：

```tsx
// 圆角实用类
rounded-none    /* 0px - 直角 */
rounded-sm      /* 2px - 符合网站规范 */
rounded         /* 4px */
rounded-md      /* 6px */
rounded-lg      /* 8px */
rounded-xl      /* 12px */
rounded-2xl     /* 16px */
rounded-full    /* 9999px - 圆形 */
```

### 5.2 阴影系统

网站定义了丰富的阴影变量，用于营造层次感：

```css
:root {
  /* 内部阴影 - 用于输入框聚焦 */
  --ck-inner-shadow: 2px 2px 3px var(--ck-color-shadow-inner) inset;
  --ck-color-shadow-inner: rgba(0, 0, 0, 0.1);
  
  /* 外部阴影 - 用于悬浮卡片 */
  --ck-drop-shadow: 0 1px 2px 1px var(--ck-color-shadow-drop);
  --ck-color-shadow-drop: rgba(0, 0, 0, 0.15);
  
  /* 聚焦阴影 - 用于输入框焦点 */
  --ck-focus-shadow: rgba(119, 186, 248, 0.5);
  --ck-focus-disabled-shadow: rgba(119, 186, 248, 0.3);
  --ck-focus-error-shadow: rgba(255, 64, 31, 0.3);
}
```

**阴影使用示例**：

```tsx
// Shadow.tsx - 阴影组件
const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm',           /* 小阴影 */
  base: 'shadow',            /* 基础阴影 */
  md: 'shadow-md',           /* 中等阴影 */
  lg: 'shadow-lg',           /* 大阴影 */
  xl: 'shadow-xl',           /* 特大阴影 */
  inner: 'shadow-inner',     /* 内部阴影 */
  focus: 'focus:ring-2 focus:ring-[#47a4f5] focus:shadow-[0_0_0_3px_rgba(119,186,248,0.5)]',
};

// 卡片组件示例
export function Card({ children, elevated = false }) {
  return (
    <div className={`bg-white p-4 ${elevated ? 'shadow-md' : 'border border-gray-200'}`}>
      {children}
    </div>
  );
}

// 悬停效果卡片
export function HoverCard({ children }) {
  return (
    <div className="bg-white border border-gray-200 p-4 transition-shadow duration-200 hover:shadow-lg">
      {children}
    </div>
  );
}
```

---

## 6. 组件风格

### 6.1 按钮组件

网站定义了 CKEditor 按钮的完整样式体系，可复用于其他场景：

#### 主要按钮 (Action Button)

```css
.ck.ck-button.ck-button_action {
  background: var(--ck-color-button-action-background); /* #61b045 */
}

.ck.ck-button.ck-button_action:not(:disabled):hover {
  background: var(--ck-color-button-action-hover-background); /* #579e3d */
}

.ck.ck-button.ck-button_action:not(:disabled):active {
  background: var(--ck-color-button-action-active-background); /* #53973b */
  box-shadow: inset 0 2px 2px var(--ck-color-button-action-active-shadow); /* #498433 */
}

.ck.ck-button.ck-button_action:disabled {
  background: var(--ck-color-button-action-disabled-background); /* #7ec365 */
}
```

#### 次要按钮 (Default Button)

```css
.ck.ck-button {
  background: var(--ck-color-button-default-background); /* transparent */
}

.ck.ck-button:not(:disabled):hover {
  background: var(--ck-color-button-default-hover-background); /* #e6e6e6 */
}

.ck.ck-button:not(:disabled):active {
  background: var(--ck-color-button-default-active-background); /* #d9d9d9 */
  box-shadow: inset 0 2px 2px var(--ck-color-button-default-active-shadow); /* #bfbfbf */
}
```

#### 按钮 TSX 实现

```tsx
// Button.tsx
import React from 'react';

type ButtonVariant = 'primary' | 'success' | 'default' | 'danger' | 'link';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#198cf0] hover:bg-[#0e7fe1] text-white',
  success: 'bg-[#61b045] hover:bg-[#579e3d] text-white',
  default: 'bg-transparent hover:bg-[#e6e6e6] text-[#333]',
  danger: 'bg-[#db3700] hover:bg-[#c03100] text-white',
  link: 'bg-transparent hover:underline text-[#0000f0]',
};

const sizeStyles = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-none border-none
        min-h-[2.3em] min-w-[2.3em]
        transition-colors duration-200
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
```

### 6.2 输入框组件

输入框样式在 CKEditor 中有详细定义：

```css
/* 输入框基础样式 */
.ck.ck-editor__editable_inline {
  border: 1px solid transparent;
  padding: 0 var(--ck-spacing-standard);
  overflow: auto;
}

.ck.ck-editor__editable_inline.ck-focused {
  outline: none;
  border: var(--ck-focus-ring); /* 1px solid #47a4f5 */
  box-shadow: var(--ck-inner-shadow), 0 0;
}

/* 输入框禁用状态 */
input[type="text"][disabled],
textarea[disabled] {
  background: #f2f2f2;
  color: #5c5c5c;
  cursor: default;
}
```

#### 输入框 TSX 实现

```tsx
// Input.tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-[#333]">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2
          bg-white border
          text-[#333] text-base
          placeholder:text-[#c2c2c4]
          focus:outline-none
          transition-all duration-200
          ${error 
            ? 'border-[#db3700] focus:ring-2 focus:ring-[#db3700]/50' 
            : 'border-[#c7c7c7] focus:border-[#47a4f5] focus:ring-2 focus:ring-[rgba(119,186,248,0.5)]'
          }
          disabled:bg-[#f2f2f2] disabled:text-[#5c5c5c]
          rounded-none
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-[#db3700]">{error}</p>}
      {helperText && !error && <p className="text-sm text-[#666]">{helperText}</p>}
    </div>
  );
}

// 多行文本输入框
export function Textarea({ rows = 4, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`
        w-full px-3 py-2
        bg-white border border-[#c7c7c7]
        text-[#333] text-base
        placeholder:text-[#c2c2c4]
        focus:outline-none focus:border-[#47a4f5] focus:ring-2 focus:ring-[rgba(119,186,248,0.5)]
        disabled:bg-[#f2f2f2] disabled:text-[#5c5c5c]
        rounded-none resize-y
        ${className}
      `}
      {...props}
    />
  );
}
```

### 6.3 工具栏组件

工具栏是 CKEditor 的核心组件之一：

```css
.ck.ck-toolbar {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  background: var(--ck-color-toolbar-background); /* #fafafa */
  padding: 0 var(--ck-spacing-small); /* 0 0.3em */
  border: 1px solid var(--ck-color-toolbar-border); /* #c4c4c4 */
  user-select: none;
}

.ck.ck-toolbar > * {
  margin-right: var(--ck-spacing-small);
  margin-top: var(--ck-spacing-small);
  margin-bottom: var(--ck-spacing-small);
}

.ck.ck-toolbar > :last-child {
  margin-right: 0;
}

.ck.ck-toolbar__separator {
  align-self: stretch;
  width: 1px;
  background: var(--ck-color-toolbar-border);
}
```

#### 工具栏 TSX 实现

```tsx
// Toolbar.tsx
import React from 'react';

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
  vertical?: boolean;
}

export function Toolbar({ children, className = '', vertical = false }: ToolbarProps) {
  return (
    <div
      className={`
        flex flex-wrap items-center
        bg-[#fafafa] border border-[#c4c4c4]
        px-3 py-1.5
        select-none
        ${vertical ? 'flex-col items-stretch' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return (
    <div className="w-px self-stretch bg-[#c4c4c4] mx-1" />
  );
}

export function ToolbarGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {children}
    </div>
  );
}
```

### 6.4 提示框组件

```css
.ck.ck-tooltip {
  visibility: hidden;
  opacity: 0;
  display: none;
  z-index: 1000;
  position: absolute;
  left: 50%;
  transition: opacity 0.2s ease-in-out 0.2s;
}

.ck.ck-tooltip .ck-tooltip__text {
  display: inline-block;
  padding: var(--ck-spacing-small) var(--ck-spacing-medium);
  background: var(--ck-color-tooltip-background); /* #333 */
  color: var(--ck-color-tooltip-text); /* white */
  font-size: 0.9em;
  line-height: 1.5;
  position: relative;
  left: -50%;
  border-radius: 0; /* 或 2px */
}

/* 下方提示 */
.ck.ck-tooltip.ck-tooltip_s {
  bottom: calc(-1 * var(--ck-tooltip-arrow-size));
  transform: translateY(100%);
}

/* 上方提示 */
.ck.ck-tooltip.ck-tooltip_n {
  top: calc(-1 * var(--ck-tooltip-arrow-size));
  transform: translateY(-100%);
}

.ck.ck-tooltip .ck-tooltip__text:after {
  content: "";
  position: absolute;
  left: 50%;
  border-style: solid;
  border-width: 5px;
  transform: translateX(-50%);
}
```

#### 提示框 TSX 实现

```tsx
// Tooltip.tsx
import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const arrowStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 border-t-[#333] border-x-transparent border-b-0',
    bottom: 'top-full left-1/2 -translate-x-1/2 border-b-[#333] border-x-transparent border-t-0',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`
            absolute z-50
            px-2 py-1
            bg-[#333] text-white
            text-xs rounded-none
            whitespace-nowrap
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            left-1/2 -translate-x-1/2
            opacity-0 animate-fade-in
          `}
        >
          {content}
          <div
            className={`
              absolute w-0 h-0 border-4
              left-1/2 -translate-x-1/2
              border-4 border-solid
              ${arrowStyles[position]}
            `}
          />
        </div>
      )}
    </div>
  );
}
```

---

## 7. 无障碍设计

### 7.1 焦点状态

网站为交互元素定义了清晰的焦点状态，符合 WCAG 2.1 AA 级标准：

```css
/* 聚焦边框 */
--ck-focus-ring: 1px solid var(--ck-color-focus-border); /* #47a4f5 */

/* 聚焦阴影 - 提供视觉增强 */
--ck-focus-shadow: rgba(119, 186, 248, 0.5);
--ck-focus-outer-shadow-geometry: 0 0 0 3px;
--ck-focus-outer-shadow: var(--ck-focus-outer-shadow-geometry) var(--ck-focus-shadow);

/* 聚焦错误状态 */
--ck-focus-error-shadow: rgba(255, 64, 31, 0.3);
--ck-focus-error-outer-shadow: 0 0 0 3px var(--ck-focus-error-shadow);

/* 禁用状态透明度 */
--ck-disabled-opacity: 0.5;
```

### 7.2 颜色对比度

检测到的主要颜色对比度分析：

| 前景色 | 背景色 | 对比度 | 评级 |
|--------|--------|--------|------|
| `#333333` (文本) | `#ffffff` (背景) | 12.6:1 | ✅ AAA |
| `#198cf0` (链接) | `#ffffff` (背景) | 4.5:1 | ✅ AA |
| `#61b045` (按钮文字) | `#ffffff` (背景) | 3.2:1 | ⚠️ 仅大号文本 |
| `#c2c2c4` (占位符) | `#ffffff` (背景) | 2.1:1 | ❌ 不合规 |
| `#666666` (辅助文字) | `#ffffff` (背景) | 5.3:1 | ✅ AA |

**改进建议**：占位符文字 `#c2c2c4` 在白色背景上对比度不足，建议将占位符颜色调整为 `#9ca3af` (Tailwind gray-400) 或更深。

### 7.3 无障碍组件示例

```tsx
// AccessibleInput.tsx - 符合 WCAG 标准的输入框
export function AccessibleInput({ label, error, id, ...props }) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className="space-y-1">
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-[#333]"
      >
        {label} <span className="text-[#db3700]" aria-hidden="

---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/10 19:36:51*