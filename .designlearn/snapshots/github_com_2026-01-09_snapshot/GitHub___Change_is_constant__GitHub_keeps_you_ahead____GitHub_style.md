# GitHub · Change is constant. GitHub keeps you ahead. · GitHub - 设计风格分析报告

> **分析时间**: 2026/1/9 18:47:54
> **页面 URL**: https://github.com/
> **采集时间**: 2026/1/9 18:30:32
> **视口尺寸**: 1920 x 1080

---

<think>
用户请求我分析GitHub首页的设计系统，并输出一份详细的设计风格指南（STYLEGUIDE.md）。让我仔细分析提供的HTML和CSS内容。

从HTML中我可以看到：
1. GitHub使用了Turbo框架
2. 有多种主题：light、dark、light_high_contrast、dark_high_contrast等
3. 使用了自定义字体"Mona Sans"
4. 加载了Primer设计系统（primer-primitives、primer-dc3bfaf4b78e.css等）
5. 使用了Tailwind类似的类名系统

从CSS中我可以看到：
1. turbo-progress-bar 使用 #0076ff（蓝色）
2. 暗色主题背景 #24292f
3. 文字颜色 #ffffff
4. 强调色 #d8b9ff（淡紫色）
5. 按钮样式
6. 响应式设计（768px断点）
7. 主题切换功能

让我整理一份全面的设计风格指南。
</think>

# GitHub 设计风格指南 (STYLEGUIDE)

本设计风格指南基于 GitHub 官网（github.com）的视觉设计系统编制，旨在帮助开发者和设计师理解和复用 GitHub 的设计语言。GitHub 作为全球最大的代码托管平台，其设计系统经过多年迭代，形成了一套成熟、专业的设计规范。

---

## 1. 设计语言概览

### 1.1 核心设计理念

GitHub 的设计语言体现了"简洁、高效、可访问"三大核心原则。整个界面以内容为中心，通过精心的视觉层次引导用户完成各项操作。设计系统大量使用 Primer——GitHub 自研的开源设计系统，确保了跨产品的一致性体验。

**技术栈特征**方面，GitHub 采用现代化的前端技术架构：
- **框架基础**：Turbo 驱动页面导航，配合 Stimulus 实现交互逻辑
- **样式系统**：Primer 设计系统 + 自定义 CSS 变量
- **主题机制**：支持 8 种主题模式（light/dark + 基础/高对比/色盲友好/色盲高对比/三原色色盲/三原色色盲高对比 + dimmed 变体）
- **字体策略**：主字体为 Mona Sans，等宽字体为 UI Monospace/SF Mono

### 1.2 主题架构

GitHub 采用了复杂但灵活的主题系统，通过 CSS 变量和媒体查询实现多主题支持。从提供的代码可以看到，页面会根据用户偏好自动应用相应主题：

```css
/* 主题相关 CSS 变量定义位置 */
[data-color-mode="dark"] {
  /* 暗色主题变量 */
}

[data-color-theme="dark_dimmed"] {
  /* 暗色柔和主题变量 */
}
```

**支持的主题类型**包括：
- `light` - 浅色主题
- `light_high_contrast` - 浅色高对比度主题
- `light_colorblind` - 浅色色盲友好主题
- `light_colorblind_high_contrast` - 浅色色盲友好高对比主题
- `light_tritanopia` - 浅色三原色色盲主题
- `light_tritanopia_high_contrast` - 浅色三原色色盲高对比主题
- `dark` - 暗色主题
- `dark_high_contrast` - 暗色高对比度主题
- `dark_colorblind` - 暗色色盲友好主题
- `dark_colorblind_high_contrast` - 暗色色盲友好高对比主题
- `dark_tritanopia` - 暗色三原色色盲主题
- `dark_tritanopia_high_contrast` - 暗色三原色色盲高对比主题
- `dark_dimmed` - 暗色柔和主题
- `dark_dimmed_high_contrast` - 暗色柔和高对比主题

---

## 2. 配色系统

### 2.1 核心品牌色

GitHub 的品牌色以蓝色为主色调，但在实际应用中更多使用紫色/淡紫色作为强调色，形成了独特的视觉识别。

| 色彩角色 | 色值（HEX） | RGB 值 | Tailwind 类名参考 | 使用场景 |
|---------|------------|--------|------------------|---------|
| **主品牌色** | `#0076ff` | 0, 118, 255 | `text-blue-500` | 进度条、活动指示器、链接 |
| **强调色（暗色）** | `#d8b9ff` | 216, 185, 255 | `text-purple-300` | 暗色主题强调文字、链接 |
| **链接色（暗色）** | `#d8b9ff` | 216, 185, 255 | `text-purple-300` | 暗色主题可点击元素 |
| **背景色（暗色）** | `#24292f` | 36, 41, 47 | `bg-gray-900` | 暗色主题主背景 |
| **背景色（浅色）** | `#ffffff` | 255, 255, 255 | `bg-white` | 浅色主题主背景 |
| **文字色（暗色）** | `#ffffff` | 255, 255, 255 | `text-white` | 暗色主题主文字 |
| **文字色（浅色）** | `#1f2328` | 31, 35, 40 | `text-gray-900` | 浅色主题主文字 |
| **边框色（暗色）** | `#d8b9ff` | 216, 185, 255 | `border-purple-300` | 暗色主题边框分隔线 |

### 2.2 语义化配色

GitHub 的设计系统中，颜色被赋予了明确的语义含义，确保用户在不同场景下获得一致的视觉反馈。

```tsx
// 按钮变体示例
const buttonVariants = {
  // 主要操作按钮 - 品牌色
  primary: "bg-[#0076ff] text-white hover:bg-[#0066d6]",
  
  // 次要按钮 - 中性色
  secondary: "bg-[#32383f] text-white border border-[#eaeef2]",
  
  // 文字链接 - 强调色
  link: "text-[#d8b9ff] hover:underline",
  
  // 危险操作
  danger: "bg-red-600 text-white hover:bg-red-700",
  
  // 成功状态
  success: "bg-green-600 text-white hover:bg-green-700",
};
```

**按钮状态颜色映射**：

| 状态 | 主要按钮背景 | 次要按钮背景 | 主要按钮边框 |
|-----|-------------|-------------|-------------|
| 默认 | `#ffffff` | `#32383f` | `transparent` |
| 悬停 | `#d8b9ff` | `#24292f` | `transparent` |
| 聚焦 | `#d8b9ff` | `#32383f` | `#ffffff` (2px) |
| 禁用 | `#ffffff` (50% opacity) | - | `transparent` |

### 2.3 中性色系统

中性色在 GitHub 界面中大量使用，用于构建视觉层次和空间感。

```css
/* 暗色主题中性色参考 */
--color-bg-default: #24292f;
--color-bg-secondary: #32383f;
--color-bg-tertiary: #6e7781;
--color-border-default: #d8b9ff;
--color-border-muted: #57606a;
--color-fg-default: #ffffff;
--color-fg-muted: #8b949e;
```

**浅色主题中性色对比**：

| 角色 | 暗色主题 | 浅色主题 | Tailwind 映射 |
|-----|---------|---------|--------------|
| 主背景 | `#24292f` | `#ffffff` | `bg-gray-900 / bg-white` |
| 次级背景 | `#32383f` | `#f6f8fa` | `bg-gray-800 / bg-gray-50` |
| 三级背景 | `#6e7781` | `#d0d7de` | `bg-gray-600 / bg-gray-300` |
| 边框 | `#d8b9ff` | `#eaeef2` | `border-purple-300 / border-gray-200` |
| 主文字 | `#ffffff` | `#1f2328` | `text-white / text-gray-900` |
| 次级文字 | `#8b949e` | #57606a | `text-gray-400 / text-gray-600` |

---

## 3. 字体系统

### 3.1 字体族规范

GitHub 使用了一套精心挑选的字体栈，确保在不同操作系统上都能提供优秀的阅读体验。

```css
/* 主字体栈 - 用于界面文本 */
font-family: 
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Noto Sans",
  Helvetica,
  Arial,
  sans-serif,
  "Apple Color Emoji",
  "Segoe UI Emoji";

/* 等宽字体栈 - 用于代码 */
font-family: 
  ui-monospace,
  SFMono-Regular,
  SF Mono,
  Menlo,
  Consolas,
  "Liberation Mono",
  monospace;
```

**Tailwind CSS 配置建议**：

```tsx
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        '"Noto Sans"',
        'Helvetica',
        'Arial',
        'sans-serif',
      ],
      mono: [
        'ui-monospace',
        'SFMono-Regular',
        'SF Mono',
        'Menlo',
        'Consolas',
        '"Liberation Mono"',
        'monospace',
      ],
    },
  },
}
```

### 3.2 排版层级

GitHub 的排版系统采用了清晰的层级结构，通过字号、字重、行高的组合实现信息的有序传达。

| 层级 | 字号 | 字重 | 行高 | 用途 | Tailwind 类名 |
|-----|-----|-----|-----|-----|-------------|
| **页面标题** | 32-48px | 600 | 1.2 | 页主标题 | `text-4xl font-semibold leading-tight` |
| **分节标题** | 24-28px | 600 | 1.3 | 区块标题 | `text-2xl font-semibold leading-snug` |
| **副标题** | 18-20px | 600 | 1.4 | 小节标题 | `text-xl font-semibold leading-normal` |
| **正文大** | 16px | 400 | 1.5 | 重要正文 | `text-base font-normal leading-relaxed` |
| **正文** | 15px | 400 | 1.5 | 标准正文 | `text-[15px] font-normal leading-relaxed` |
| **正文小** | 14px | 400 | 1.5 | 次要信息 | `text-sm font-normal leading-relaxed` |
| **最小文字** | 13px | 400 | 1.5 | 辅助说明 | `text-sm font-normal leading-normal` |

### 3.3 字体样式代码示例

```tsx
// Typography组件示例
const Typography = {
  // 页面主标题 - 用于 Landing Page Hero 区域
  pageTitle: "text-[32px] md:text-[48px] font-semibold tracking-tight text-white",
  
  // 分节标题 - 用于内容区块标题
  sectionTitle: "text-[24px] md:text-[28px] font-semibold text-white",
  
  // 卡片标题
  cardTitle: "text-[18px] font-semibold text-white",
  
  // 正文主体
  bodyLarge: "text-base font-normal text-[#8b949e]",
  
  // 标准正文
  body: "text-[15px] font-normal text-[#8b949e] leading-[20px]",
  
  // 次要文字
  bodySmall: "text-sm font-normal text-[#8b949e]",
  
  // 代码文本
  code: "font-mono text-sm text-[#d8b9ff]",
};

// 使用示例
const HeroSection = () => (
  <section className="text-center py-20">
    <h1 className={Typography.pageTitle}>
      Change is constant.
    </h1>
    <p className={`mt-4 ${Typography.body}`}>
      GitHub keeps you ahead.
    </p>
  </section>
);
```

---

## 4. 布局与间距系统

### 4.1 容器与视口

GitHub 的布局系统遵循桌面优先的原则，同时确保移动端的响应式体验。

```tsx
// 布局容器组件
const Container = {
  // 全宽容器 - 适合导航栏、全局横幅
  fullWidth: "w-full max-w-none",
  
  // 标准容器 - 主要内容区域
  standard: "w-full max-w-[1280px] mx-auto px-4 md:px-8",
  
  // 紧凑容器 - 适合卡片内部内容
  compact: "w-full max-w-[960px] mx-auto px-6",
  
  // 居中内容块 - 适合登录/注册页面
  centered: "w-full max-w-[640px] mx-auto px-4",
};
```

**响应式断点设置**：

| 断点名称 | 视口宽度 | Tailwind 前缀 | 用途说明 |
|---------|---------|--------------|---------|
| sm | ≥640px | `sm:` | 小型平板 |
| md | ≥768px | `md:` | 平板横屏 |
| lg | ≥1024px | `lg:` | 桌面显示器 |
| xl | ≥1280px | `xl:` | 大型桌面 |
| 2xl | ≥1536px | `2xl:` | 超大屏幕 |

### 4.2 间距系统

GitHub 的间距系统采用 4px 基础单位，所有间距值都是 4px 的倍数。

```tsx
// 间距令牌
const spacing = {
  // 紧凑间距 - 用于组件内部元素
  tight: {
    gap: "gap-1",      // 4px
    gapSm: "gap-2",    // 8px
    gapMd: "gap-3",    // 12px
  },
  
  // 标准间距 - 用于相邻组件
  normal: {
    gap: "gap-4",      // 16px
    gapLg: "gap-6",    // 24px
    gapXl: "gap-8",    // 32px
  },
  
  // 宽松间距 - 用于区块之间
  relaxed: {
    gap: "gap-12",     // 48px
    gapXxl: "gap-16",  // 64px
    gapXxxl: "gap-24", // 96px
  },
  
  // 边距
  padding: {
    container: "px-4 md:px-8 lg:px-12",
    section: "py-12 lg:py-24",
    inline: "px-6",
  },
};
```

### 4.3 栅格系统

GitHub 使用灵活的 CSS Grid 和 Flexbox 布局，未采用传统的 12 列栅格。

```tsx
// 栅格布局示例
const GridLayouts = {
  // 双列布局 - 适合特性并排展示
  twoColumn: "grid grid-cols-1 md:grid-cols-2 gap-8",
  
  // 三列布局 - 适合功能卡片
  threeColumn: "grid grid-cols-1 md:grid-cols-3 gap-6",
  
  // 四列布局 - 适合统计信息
  fourColumn: "grid grid-cols-2 md:grid-cols-4 gap-4",
  
  // 自适应布局 - 适合响应式内容
  autoFit: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
};
```

---

## 5. 组件风格规范

### 5.1 导航栏组件

导航栏是 GitHub 界面的核心组件，承载着全局导航和用户操作入口的功能。

```tsx
// Header 导航组件
interface HeaderProps {
  logo?: React.ReactNode;
  navigation?: { label: string; href: string }[];
  actions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  logo = (
    <svg height="32" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="32" data-view-component="true" className="fill-white">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
    </svg>
  ),
  navigation = [
    { label: "Features", href: "/features" },
    { label: "Solutions", href: "/solutions" },
    { label: "Pricing", href: "/pricing" },
  ],
  actions,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#24292f] border-b border-[#32383f]">
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
        {/* Logo 区域 */}
        <a href="/" className="flex items-center gap-2">
          {logo}
        </a>
        
        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-6">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-[#8b949e] hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        
        {/* 操作按钮区域 */}
        <div className="flex items-center gap-4">
          {actions || (
            <>
              <a href="/login" className="text-sm text-[#8b949e] hover:text-white">
                Sign in
              </a>
              <a
                href="/signup"
                className="px-4 py-1.5 text-sm font-medium text-[#1f2328] bg-white rounded-md hover:bg-[#d8b9ff] transition-colors"
              >
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
```

### 5.2 按钮组件

按钮是用户完成操作的主要触点，GitHub 的按钮设计强调清晰的状态反馈。

```tsx
// Button 组件完整实现
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const buttonStyles = {
  // 主要按钮 - 品牌色填充
  primary: `
    bg-[#ffffff] text-[#1f2328]
    hover:bg-[#d8b9ff]
    focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#24292f]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  
  // 次要按钮 - 暗色背景
  secondary: `
    bg-[#32383f] text-white
    border border-[#eaeef2]
    hover:bg-[#24292f] hover:border-white
    focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#24292f]
  `,
  
  // 轮廓按钮 - 透明背景带边框
  outline: `
    bg-transparent text-[#d8b9ff]
    border border-[#d8b9ff]
    hover:bg-[#d8b9ff] hover:text-[#1f2328]
    focus:ring-2 focus:ring-[#d8b9ff] focus:ring-offset-2 focus:ring-offset-[#24292f]
  `,
  
  // 幽灵按钮 - 轻量交互
  ghost: `
    bg-transparent text-[#8b949e]
    hover:bg-[#32383f] hover:text-white
    focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#24292f]
  `,
  
  // 危险按钮
  danger: `
    bg-red-600 text-white
    hover:bg-red-700
    focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-[#24292f]
  `,
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-6 py-3 text-base rounded-lg",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium transition-all duration-200
          ${buttonStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        
        {children}
        
        {rightIcon && !loading && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
```

**按钮使用示例**：

```tsx
// 按钮组合示例
const ButtonExamples = () => (
  <div className="flex flex-wrap gap-4 p-6 bg-[#24292f]">
    {/* 主要操作 */}
    <Button variant="primary" onClick={() => console.log('primary')}>
      Sign up for free
    </Button>
    
    {/* 次要操作 */}
    <Button variant="secondary">
      Learn more
    </Button>
    
    {/* 轮廓按钮 */}
    <Button variant="outline" leftIcon={<StarIcon />}>
      Star us
    </Button>
    
    {/* 危险操作 */}
    <Button variant="danger">
      Delete repository
    </Button>
    
    {/* 加载状态 */}
    <Button variant="primary" loading>
      Signing in...
    </Button>
    
    {/* 禁用状态 */}
    <Button variant="primary" disabled>
      Sign up (Disabled)
    </Button>
  </div>
);
```

### 5.3 卡片组件

卡片用于承载相关信息的聚合展示，是内容布局的基础单元。

```tsx
// Card 组件设计
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const cardStyles = {
  base: "bg-[#24292f] rounded-xl overflow-hidden",
  bordered: "border border-[#32383f]",
  hoverable: "transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/10",
  padding: {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  },
};

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverable = false,
  bordered = true,
  padding = 'md',
}) => {
  return (
    <div
      className={`
        ${cardStyles.base}
        ${bordered ? cardStyles.bordered : ''}
        ${hoverable ? cardStyles.hoverable : ''}
        ${cardStyles.padding[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Card Header
interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  action,
}) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div className="flex-1">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[#8b949e]">{description}</p>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

// Feature Card 示例
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  href,
}) => {
  const content = (
    <Card hoverable className="h-full">
      <div className="flex flex-col h-full">
        <div className="mb-4 text-[#d8b9ff]">{icon}</div>
        <CardHeader title={title} description={description} />
        <div className="mt-auto pt-4">
          <span className="text-sm text-[#d8b9ff] group-hover:underline">
            Learn more →
          </span>
        </div>
      </div>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
};

// 使用示例
const FeatureCards = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <FeatureCard
      icon={
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      }
      title="Code reviews"
      description="Easy and effective code reviews with proven workflows."
    />
    <FeatureCard
      icon={
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title="Access control"
      description="Fine-grained permissions to keep your work secure."
    />
    <FeatureCard
      icon={
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      }
      title="Automation"
      description="CI/CD automation built into every pull request."
    />
  </div>
);
```

### 5.4 表单输入组件

表单输入组件需要支持多种状态和清晰的标签提示。

```tsx
// Input 输入框组件
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftElement,
      rightElement,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#8b949e] mb-1.5"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftElement && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
              {leftElement}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-4 py-2
              bg-[#32383f] border border-[#6e7781] rounded-md
              text-white placeholder:text-[#8b949e]
              focus:outline-none focus:border-[#d8b9ff] focus:ring-1 focus:ring-[#d8b9ff]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
              ${leftElement ? 'pl-10' : ''}
              ${rightElement ? 'pr-10' : ''}
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
              ${className}
            `}
            {...props}
          />
          
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
              {rightElement}
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
        
        {hint && !error && (
          <p className="mt-1.5 text-sm text-[#8b949e]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Checkbox 复选框组件
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={`
            mt-1 w-4 h-4
            rounded border-[#6e7781]
            bg-[#32383f]
            text-[#d8b9ff]
            focus:ring-2 focus:ring-[#d8b9ff] focus:ring-offset-0
            cursor-pointer
            transition-colors duration-200
            ${className}
          `}
          {...props}
        />
        <label
          htmlFor={checkboxId}
          className="text-sm text-[#8b949e] cursor-pointer select-none"
        >
          {label}
        </label>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// 表单组合示例
const LoginForm = () => (
  <form className="space-y-6 max-w-md mx-auto p-8 bg-[#24292f] rounded-xl border border-[#32383f]">
    <div>
      <h2 className="text-xl font-semibold text-white mb-2">Sign in to GitHub</h2>
      <p className="text-sm text-[#8b949e]">
        Enter your username or email to continue
      </p>
    </div>
    
    <Input
      label="Username or email"
      type="email"
      placeholder="you@example.com"
      required
    />
    
    <Input
      label="Password"
      type="password"
      placeholder="••••••••"
      rightElement={
        <button type="button" className="text-xs text-[#d8b9ff] hover:underline">
          Forgot?
        </button>
      }
    />
    
    <div className="flex items-center justify-between">
      <Checkbox label="Remember me" />
      <a href="/login" className="text-sm text-[#d8b9ff] hover:underline">
        Need help?
      </a>
    </div>
    
    <Button variant="primary" className="w-full">
      Sign in
    </Button>
    
    <p className="text-center text-sm text-[#8b949e]">
      New to GitHub?{' '}
      <a href="/signup" className="text-[#d8b9ff] hover:underline font-medium">
        Create an account
      </a>
    </p>
  </form>
);
```

### 5.5 徽章/标签组件

徽章用于标识状态、分类或元信息。

```tsx
// Badge 徽章组件
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  rounded?: boolean;
  outline?: boolean;
}

const badgeVariants = {
  default: {
    bg: "bg-[#32383f]",
    text: "text-[#8b949e]",
    border: "border-[#6e7781]",
  },
  success: {
    bg

---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/9 18:47:54*