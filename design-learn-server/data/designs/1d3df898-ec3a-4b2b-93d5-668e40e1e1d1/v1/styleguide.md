# 动态首页-哔哩哔哩 - 设计风格分析报告

> **分析时间**: 2026/1/10 17:42:40
> **页面 URL**: https://t.bilibili.com/
> **采集时间**: 2026/1/10 17:40:32
> **视口尺寸**: 1280 x 720

---

<think>
这是一个关于哔哩哔哩动态首页的设计风格指南请求。用户希望我分析提供的HTML和CSS，并输出一份详尽的设计风格指南文档。

让我分析一下提供的内容：

1. HTML片段包含了：
   - 页面标题和元数据
   - 主题样式表引用（light.css, light_u.css, map.css）
   - 头部横幅样式
   - 频道图标样式
   - 弹出框样式等

2. CSS片段包含了：
   - 图片组件样式
   - 头部横幅样式
   - 频道图标样式（带悬停效果）
   - 弹出框样式
   - 响应式布局断点

从这些信息中，我可以提取以下设计令牌：

**颜色系统：**
- 品牌粉色: #ff9212 (动态), #f07775 (热门), #59ca73 (频道)
- 悬停色: #ff9e2c, #f38e8c, #6cd083
- 背景色: #e3e5e7 (横幅), #2f3238e6 (标题背景)
- 文字色: #fff, #18191c (主要文本)
- 线条色: var(--line_regular)
- 品牌粉色: var(--brand_pink)
- 背景色: var(--bg1), var(--bg1_float)

**字体：**
- 字体大小: 12px, 13px, 14px, 15px
- 行高: 18px, 20px

**间距和布局：**


响应式布局涵盖了多个屏幕尺寸，从1099px到2200px不等。内边距变化范围在56px到96px之间，提供了灵活的设计适应性。这种多尺寸策略确保了在不同设备上的一致性和可读性。

**组件样式：**
头部横幅采用全宽设计，高度通过视口宽度百分比和最大高度控制，频道图标则以圆形40-46px的样式呈现，展现了简洁而现代的UI设计理念。

**过渡和动画：**
动画过渡采用0.3秒的平滑效果，包括颜色、透明度等渐变变化。悬停状态下，头部标题会呈现淡入效果，增强用户交互体验。

我将按照专业的设计系统文档规范，系统性地整理和输出设计方案。
</think>

# 哔哩哔哩动态首页设计风格指南 (STYLEGUIDE)

本文档基于哔哩哔哩动态首页（t.bilibili.com）的源码分析，提取并整理其设计系统规范，为团队开发提供统一的设计参考。文档涵盖配色系统、字体规范、布局间距、组件风格等核心设计令牌，以及相应的 Tailwind CSS 实现方案。

---

## 1. 设计概览

### 1.1 设计语言特征

哔哩哔哩动态首页采用现代简约的设计语言，整体风格以内容为核心，通过清晰的视觉层次引导用户浏览。设计系统强调以下几点核心特征：

**层次分明的视觉结构**：页面采用"头部横幅 → 频道导航 → 内容区域"的三段式布局，每一层级都有明确的视觉区分。头部横幅使用视口百分比高度（9.375vw），既保证了大屏幕下的视觉冲击力，又通过 max-height:240px 限制了最大高度，避免在小分辨率屏幕上显得过于笨重。

**圆角与直角的平衡运用**：界面中大量使用圆角元素（如圆形图标、圆角卡片），但同时保留了部分直角元素（如分隔线、输入框边框），这种混合使用创造了既亲和又不失专业感的视觉效果。

**适度的阴影与层次**：通过 box-shadow: 0 0 30px #0000001a 这样的微妙阴影，营造出悬浮感和空间层次，避免了过于深重的阴影带来的沉重感。

### 1.2 技术栈与主题机制

从源码中可以观察到，B站采用了 CSS 变量（Custom Properties）驱动的设计令牌系统：

```css
/* 主题变量引用示例 */
:root {
  --bg1: #ffffff;
  --bg1_float: #ffffff;
  --text1: #18191c;
  --text2: #9499a0;
  --line_regular: #e3e5e7;
  --brand_pink: #ff9212;
  --graph_bg_regular: #f1f2f3;
}
```

主题切换通过动态加载不同的 CSS 文件实现：
- `light.css` / `light_u.css` — 浅色主题基础样式
- `map.css` — 语义化变量映射表

这种架构使得主题切换成本极低，只需切换 CSS 文件引用即可。深色主题只需定义一套对应的变量值，组件样式无需修改。

### 1.3 响应式断点系统

B站的响应式设计采用了 5 档断点策略，覆盖从平板到超宽显示器的全场景：

| 断点名称 | 屏幕宽度范围 | 主要内边距 | 适用场景 |
|---------|-------------|-----------|---------|
| xs | ≤1099.9px | 56px | 笔记本电脑、小尺寸显示器 |
| sm | 1100–1366.9px | 56px | 标准笔记本横屏 |
| md | 1367–1700.9px | 64px | 大屏笔记本、小型台式机 |
| lg | 1701–2199.9px | 96px | 标准台式机 |
| xl | ≥2200px | 动态（无额外padding） | 超宽显示器、大屏设备 |

值得注意的是，头部横幅内容区域采用了 max-width 限制：
- 默认最大宽度：2078px
- lg 断点下：max-width 扩展至 2270px

这确保了超大屏幕下内容不会过度拉宽，保持舒适的阅读行宽。

---

## 2. 配色系统

### 2.1 语义化颜色令牌

B站的设计系统采用语义化的颜色命名方式，每个颜色都有明确的用途定义。这种方式比纯色命名更具可维护性，因为当品牌色需要调整时，只需修改 CSS 变量值，所有使用该变量的组件都会自动更新。

#### 核心背景色

```css
/* 背景色变量定义 */
:root {
  /* 页面主背景 */
  --bg1: #ffffff;
  
  /* 悬浮层背景（如下拉菜单、弹出框） */
  --bg1_float: #ffffff;
  
  /* 图表/图片容器默认背景 */
  --graph_bg_regular: #f1f2f3;
  
  /* 头部横幅背景 */
  --banner_bg: #e3e5e7;
}
```

| 颜色角色 | 变量名 | 色值 | Tailwind 类名 | 使用场景 |
|---------|-------|------|--------------|---------|
| 主背景 | `--bg1` | `#ffffff` | `bg-white` | 页面主体、卡片背景 |
| 悬浮背景 | `--bg1_float` | `#ffffff` | `bg-white` | 弹出层、下拉菜单 |
| 图表占位 | `--graph_bg_regular` | `#f1f2f3` | `bg-[#f1f2f3]` | 图片加载占位、图表容器 |
| 横幅背景 | `--banner_bg` | `#e3e5e7` | `bg-[#e3e5e7]` | 头部横幅区域 |

#### 文本颜色层级

文本颜色采用三级层次，通过明度差异建立信息优先级：

```css
:root {
  --text1: #18191c;  /* 主要文本，最高对比度 */
  --text2: #9499a0;  /* 次要文本，中等对比度 */
  --text3: #798095;  /* 辅助文本，较低对比度 */
}
```

| 颜色角色 | 变量名 | 色值 | Tailwind 类名 | 对比度 | 使用场景 |
|---------|-------|------|--------------|-------|---------|
| 主要文本 | `--text1` | `#18191c` | `text-[#18191c]` | 14.8:1 | 标题、正文、关键信息 |
| 次要文本 | `--text2` | `#9499a0` | `text-[#9499a0]` | 4.5:1 | 描述文字、时间戳、标签 |
| 辅助文本 | `--text3` | `#798095` | `text-[#798095]` | 6.2:1 | 弱提示、占位文字 |

#### 边框与分隔线

```css
:root {
  /* 常规分隔线 */
  --line_regular: #e3e5e7;
  
  /* 品牌色边框（用于直播等特殊状态） */
  --brand_pink: #ff9212;
}
```

### 2.2 品牌色彩体系

B站的核心品牌色是粉色系，但在不同场景下有细微变化：

| 色彩角色 | 色值 | 用途 | Tailwind 类名 |
|---------|------|------|--------------|
| 品牌主色 | `#ff9212` | 动态频道图标、直播状态指示 | `bg-[#ff9212]` |
| 品牌主色悬停 | `#ff9e2c` | 动态图标 hover 状态 | `hover:bg-[#ff9e2c]` |
| 热门频道色 | `#f07775` | 热门入口图标 | `bg-[#f07775]` |
| 热门频道悬停 | `#f38e8c` | 热门图标 hover 状态 | `hover:bg-[#f38e8c]` |
| 频道入口色 | `#59ca73` | 频道入口图标 | `bg-[#59ca73]` |
| 频道入口悬停 | `#6cd083` | 频道图标 hover 状态 | `hover:bg-[#6cd083]` |

**使用规范建议**：
- 品牌色主要用于需要强调的交互元素和状态指示
- 纯装饰性元素可适当降低饱和度，避免视觉疲劳
- 状态色（直播中、在线等）使用品牌粉色，确保用户能够快速识别

### 2.3 组件级颜色应用示例

以下是频道图标组件的颜色应用规范：

```tsx
// 频道图标颜色规范
const channelIconColors = {
  dynamic: {
    bg: '#ff9212',
    hover: '#ff9e2c',
    text: 'var(--text1)',
  },
  popular: {
    bg: '#f07775',
    hover: '#f38e8c',
    text: 'var(--text1)',
  },
  channel: {
    bg: '#59ca73',
    hover: '#6cd083',
    text: 'var(--text1)',
  },
};

// 组件实现
const ChannelIcon = ({ type, title, isActive }: ChannelIconProps) => {
  const colors = channelIconColors[type as keyof typeof channelIconColors];
  
  return (
    <div className="channel-icons__item relative flex flex-col mr-4 sm:mr-2 md:mr-4 lg:mr-6 xl:mr-8">
      <div 
        className={`
          icon-bg flex items-center justify-center mb-1.5
          w-10 h-10 rounded-full transition-colors duration-300
          ${isActive ? '' : ''}
        `}
        style={{ backgroundColor: isActive ? colors.hover : colors.bg }}
      >
        {/* 图标内容 */}
      </div>
      <span className="icon-title text-center text-xs leading-[18px]">
        {title}
      </span>
    </div>
  );
};
```

---

## 3. 排版系统

### 3.1 字体栈与基础设置

B站采用系统字体栈作为默认字体，确保在各种操作系统上都能获得良好的渲染效果：

```css
/* 字体栈定义 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
}
```

**字体选择策略**：
- **主字体**：优先使用系统默认 UI 字体（San Francisco on macOS、Segoe UI on Windows），获得最佳的屏幕渲染清晰度和系统一致性
- **回退字体**：依次使用 Roboto、Helvetica Neue、Arial 等通用字体，确保跨平台兼容性
- **emoji 字体**：支持彩色表情符号显示

### 3.2 字号层级体系

B站采用了保守但实用的字号系统，主要围绕 12px–15px 这个区间进行变化：

| 层级 | 字号 | 行高 | 字重 | Tailwind 类名 | 使用场景 |
|-----|------|------|------|--------------|---------|
| 辅助文字 | 12px | 18px | normal | `text-xs leading-[18px]` | 标签、小提示、版权信息 |
| 频道标题（小） | 13px | 18px | normal | `text-sm leading-[18px]` | 频道入口名称 |
| 频道标题（中） | 14px | 20px | normal | `text-sm leading-[20px]` | 中等重要标题 |
| 频道标题（大） | 15px | 20px | normal | `text-base leading-[20px]` | 大屏显示的频道名 |
| 卡片标题 | 15px | 22px | medium | `text-base leading-[22px] font-medium` | 动态标题、内容标题 |
| 弹窗文字 | 14px | 20px | normal | `text-sm leading-[20px]` | 弹出框内容 |

**字号响应式调整策略**：

```css
/* 频道图标文字在不同断点的字号变化 */
@media (max-width: 1099.9px) {
  .channel-icons .icon-title {
    font-size: 12px;
    line-height: 18px;
  }
}

@media (min-width: 1367px) and (max-width: 1700.9px) {
  .channel-icons .icon-title {
    font-size: 14px;
    line-height: 20px;
  }
}

@media (min-width: 2200px) {
  .channel-icons .icon-title {
    font-size: 15px;
    line-height: 20px;
  }
}
```

### 3.3 排版组件示例

以下是综合运用排版规范的组件示例：

```tsx
// 头部标题组件 - 展示排版层次
const HeaderTitle = ({ visible }: { visible: boolean }) => {
  return (
    <div
      className={`
        absolute bottom-[25px] left-[380px]
        px-2.5 py-1.5 max-w-[350px]
        rounded-md bg-[#2f3238e6] text-white
        text-sm leading-5
        opacity-0 transition-opacity duration-300
        ${visible ? 'opacity-100' : ''}
      `}
    >
      <span className="font-normal">
        动态首页 - 哔哩哔哩
      </span>
    </div>
  );
};

// 频道入口文字 - 响应式排版
const ChannelEntry = ({ title }: { title: string }) => {
  return (
    <span className="
      channel-entry
      text-xs leading-[18px] 
      md:text-sm md:leading-[18px]
      lg:text-sm lg:leading-[20px]
      xl:text-base xl:leading-[20px]
    ">
      {title}
    </span>
  );
};
```

---

## 4. 布局与间距系统

### 4.1 容器与宽度规范

B站的布局采用居中容器策略，核心内容区域有明确的宽度限制：

```css
/* 头部横幅容器 */
.bili-header__banner .header-banner__inner {
  position: relative;
  width: 100%;
  max-width: 2078px;
  margin: 0 auto;
}

/* 频道区域容器 */
.bili-header__channel {
  position: relative;
  width: 100%;
  max-width: 2078px;
  margin: 0 auto;
}
```

**容器宽度规范表**：

| 容器类型 | 默认最大宽度 | 宽屏扩展宽度 | 居中方式 |
|---------|-------------|-------------|---------|
| 头部横幅 | 2078px | 2270px (lg) | margin: 0 auto |
| 频道导航 | 2078px | 2270px (lg) | margin: 0 auto |
| 主内容区 | 2078px | - | margin: 0 auto |

### 4.2 内边距响应式策略

页面级容器采用响应式内边距，确保在不同屏幕尺寸下都有合理的留白：

```css
/* 默认（xs, sm） */
@media (max-width: 1099.9px),
       (min-width: 1100px) and (max-width: 1366.9px) {
  .bili-header__banner .header-banner__inner,
  .bili-header__channel {
    padding: 0 56px;
  }
}

/* 中等屏幕（md） */
@media (min-width: 1367px) and (max-width: 1700.9px) {
  .bili-header__banner .header-banner__inner,
  .bili-header__channel {
    padding: 0 64px;
  }
}

/* 大屏（lg） */
@media (min-width: 1701px) and (max-width: 2199.9px) {
  .bili-header__banner .header-banner__inner,
  .bili-header__channel {
    padding: 0 96px;
  }
}

/* 超大屏（xl） */
@media (min-width: 2200px) {
  .bili-header__banner .header-banner__inner,
  .bili-header__channel {
    /* 无额外内边距 */
  }
}
```

### 4.3 间距原子值

基于分析，B站设计系统中常用的间距值如下：

| 间距量级 | 像素值 | Tailwind 类名 | 使用场景 |
|---------|-------|--------------|---------|
| xxs | 4px | `gap-1` | 图标与文字间距 |
| xs | 6px | `mb-1.5` | 图标与标题间距 |
| sm | 8px | `gap-2` | 列表项间距 |
| md | 10px | `gap-2.5` | 频道图标间距 |
| lg | 16px | `gap-4` | 区块间距 |
| xl | 20px | `gap-5` | 大区块间距 |
| 2xl | 24px | `gap-6` | 模块间距 |
| 3xl | 32px | `gap-8` | 章节间距 |

**频道图标的间距响应式变化**：

```css
/* 频道图标右侧间距 */
.bili-header .channel-icons {
  margin-right: 10px;  /* xs, sm */
}

@media (min-width: 1701px) and (max-width: 2199.9px),
       (min-width: 2200px) {
  .bili-header .channel-icons {
    margin-right: 20px;
  }
}

/* 频道图标项间距 */
.bili-header .channel-icons__item {
  margin-right: 16px;  /* 默认 */
}

@media (min-width: 2200px) {
  .bili-header .channel-icons__item {
    margin-right: 32px;
  }
}

@media (min-width: 1701px) and (max-width: 2199.9px),
       (min-width: 1367px) and (max-width: 1700.9px) {
  .bili-header .channel-icons__item {
    margin-right: 24px;
  }
}
```

### 4.4 高度规范

头部区域采用响应式高度策略：

```css
/* 频道区域高度 */
@media (max-width: 1099.9px),
       (min-width: 1100px) and (max-width: 1366.9px) {
  .bili-header__channel {
    height: 100px;
  }
}

@media (min-width: 1367px) and (max-width: 1700.9px) {
  .bili-header__channel {
    height: 110px;
  }
}

@media (min-width: 1701px) and (max-width: 2199.9px) {
  .bili-header__channel {
    height: 120px;
  }
}

@media (min-width: 2200px) {
  .bili-header__channel {
    height: 130px;
  }
}
```

**高度规范表**：

| 断点 | 频道区域高度 | 头部横幅高度 | 说明 |
|-----|-------------|-------------|------|
| xs, sm | 100px | 9.375vw (min:155px, max:240px) | 紧凑布局 |
| md | 110px | 9.375vw (min:155px, max:240px) | 标准布局 |
| lg | 120px | 9.375vw (min:155px, max:240px) | 宽松布局 |
| xl | 130px | 9.375vw (min:155px, max:240px) | 扩展布局 |

---

## 5. 组件风格规范

### 5.1 导航栏组件

导航栏是 B站 页面的核心交互区域，包含头部横幅、频道图标和导航菜单。

#### 头部横幅区域

头部横幅使用视口百分比高度，配合渐变遮罩和悬浮提示效果：

```tsx
interface HeaderBannerProps {
  backgroundImage?: string;
  title?: string;
  logoSrc?: string;
}

const HeaderBanner = ({ backgroundImage, title, logoSrc }: HeaderBannerProps) => {
  return (
    <div 
      className="
        relative z-0 flex justify-center 
        min-w-[1000px] min-h-[155px] 
        h-[9.375vw] max-h-[240px]
        bg-[#e3e5e7] bg-center bg-cover bg-no-repeat
      "
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
    >
      {/* 渐变遮罩 - 顶部渐变效果 */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="w-full h-[100px]"
          style={{ 
            background: 'linear-gradient(rgba(0,0,0,.4), transparent)' 
          }} 
        />
      </div>

      {/* 内部容器 */}
      <div className="
        header-banner__inner 
        relative w-full max-w-[2078px]
        flex items-end
        px-4 sm:px-14 md:px-16 lg:px-24
      ">
        {/* Logo */}
        <div className="
          inner-logo 
          relative z-10 mb-2.5
          inline-block min-h-[60px] w-[180px] h-1/2
        ">
          {logoSrc && (
            <img 
              src={logoSrc} 
              alt="B站Logo" 
              className="logo-img block w-full h-full object-contain"
            />
          )}
        </div>

        {/* 悬浮标题 - hover 时显示 */}
        {title && (
          <div className="
            head-title 
            absolute bottom-[25px] left-[380px]
            px-2.5 py-1.5 max-w-[350px]
            rounded-md bg-[#2f3238e6] text-white
            text-sm leading-5 opacity-0
            transition-opacity duration-300
            hover:opacity-100
          ">
            {title}
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 频道导航图标

频道图标采用圆形设计，带有悬浮动效和状态指示：

```tsx
interface ChannelIconProps {
  type: 'dynamic' | 'popular' | 'channel' | 'up';
  title: string;
  src?: string;  // 对于 up 类型，提供用户头像
  isLive?: boolean;
  notifyCount?: number;
}

const channelColorMap = {
  dynamic: { bg: '#ff9212', hover: '#ff9e2c' },
  popular: { bg: '#f07775', hover: '#f38e8c' },
  channel: { bg: '#59ca73', hover: '#6cd083' },
  up: { bg: 'transparent', hover: 'transparent' },
};

const ChannelIcon = ({ type, title, src, isLive, notifyCount }: ChannelIconProps) => {
  const colors = channelColorMap[type];
  const iconSize = 'w-10 h-10 sm:w-[46px] sm:h-[46px]';
  
  return (
    <div className="
      channel-icons__item 
      relative flex flex-col 
      mr-4 sm:mr-2.5 md:mr-4 lg:mr-6 xl:mr-8
    ">
      {/* 图标容器 */}
      <div 
        className={`
          icon-bg flex items-center justify-center 
          mb-1.5 rounded-full transition-colors duration-300
          ${iconSize}
          ${type === 'up' ? 'overflow-hidden' : ''}
        `}
        style={{ 
          backgroundColor: colors.bg,
        }}
      >
        {type === 'up' && src ? (
          <img 
            src={src} 
            alt={title}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          /* 内部图标 - 使用内联 SVG 或图标字体 */
          <span className="icon-bg--icon w-[25px] h-[25px] block" />
        )}
        
        {/* 直播状态指示点 */}
        {isLive && (
          <div className="
            absolute -bottom-px right-px z-10
            w-2.5 h-2.5 rounded-full
            bg-[#ff9212] border-2 border-white
          " />
        )}
      </div>

      {/* 标题文字 - 响应式字号 */}
      <span className="
        icon-title 
        text-center
        text-xs leading-[18px]
        sm:text-xs sm:leading-[18px]
        md:text-sm md:leading-5
        lg:text-sm lg:leading-5
        xl:text-base xl:leading-5
      ">
        {title}
      </span>

      {/* 通知红点 */}
      {notifyCount && notifyCount > 0 && (
        <div className="
          channel-notify 
          absolute -right-1 -bottom-1 z-10
        ">
          <span className="
            inline-flex items-center justify-center
            min-w-[18px] h-[18px] px-1
            text-xs text-white
            bg-[#ff9212] rounded-full
          ">
            {notifyCount > 99 ? '99+' : notifyCount}
          </span>
        </div>
      )}
    </div>
  );
};
```

### 5.2 弹出框组件

弹出框（Popover）是最常用的交互组件之一，B站的实现包含了完整的定位和动画系统：

```tsx
interface PopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  show?: boolean;
}

const Popover = ({ 
  children, 
  content, 
  placement = 'bottom',
  show = false 
}: PopoverProps) => {
  const placementClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2',
    bottom: 'top-full left-1/2 -translate-x-1/2',
    left: 'top-1/2 right-full -translate-y-1/2',
    right: 'top-1/2 left-full -translate-y-1/2',
  };

  const animationClasses = {
    top: 'translate-y-2',
    bottom: '-translate-y-2',
    left: '-translate-x-2',
    right: 'translate-x-2',
  };

  return (
    <div className="v-popover-wrap relative inline-block">
      {children}
      
      {show && (
        <div className={`
          v-popover absolute z-50
          ${placementClasses[placement]}
          transition-all duration-300
        `}>
          <div className="
            v-popover-content
            relative bg-white
            rounded-lg
            border border-[#e3e5e7]
            shadow-[0_0_30px_rgba(0,0,0,0.1)]
          ">
            {/* 箭头指示器 */}
            <div className={`
              absolute w-0 h-0 
              border-8 border-transparent
              ${placement === 'bottom' ? 'top-[-8px] left-1/2 -translate-x-1/2 border-b-white' : ''}
              ${placement === 'top' ? 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-white' : ''}
              ${placement === 'left' ? 'right-[-8px] top-1/2 -translate-y-1/2 border-l-white' : ''}
              ${placement === 'right' ? 'left-[-8px] top-1/2 -translate-y-1/2 border-r-white' : ''}
            `} />
            
            {/* 内容区域 */}
            <div className="p-4 text-[#18191c]">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 5.3 频道入口网格

频道入口采用 CSS Grid 布局，实现自适应列数和响应式显示：

```tsx
interface ChannelGridProps {
  entries: ChannelEntry[];
  maxVisible?: number;
}

const ChannelGrid = ({ entries, maxVisible = 18 }: ChannelGridProps) => {
  return (
    <div className="
      channel-items__left
      relative
      grid
      grid-flow-col
      grid-rows-2
      gap-2.5
      border-r border-[#e3e5e7]
      w-full
      /* 响应式列数 */
      grid-cols-9 xs:grid-cols-9
      sm:grid-cols-9
      md:grid-cols-11
      lg:grid-cols-12
      xl:grid-cols-14
    ">
      {entries.slice(0, maxVisible).map((entry) => (
        <a 
          key={entry.id}
          href={entry.url}
          className="
            channel-entry
            flex items-center justify-center
            px-2 py-1
            text-[#18191c]
            text-xs leading-[18px]
            md:text-sm md:leading-[18px]
            lg:text-sm lg:leading-5
            xl:text-base xl:leading-5
            transition-colors
            hover:bg-[#f1f2f3]
            rounded
          "
        >
          {entry.name}
        </a>
      ))}
      
      {/* 超出隐藏的提示 */}
      {entries.length > maxVisible && (
        <div className="flex items-center justify-center text-[#9499a0]">
          <span className="text-sm">查看更多</span>
        </div>
      )}
    </div>
  );
};
```

### 5.4 图片占位组件

图片加载时显示占位符，带有模糊效果增强视觉体验：

```tsx
interface ImagePlaceholderProps {
  src: string;
  alt: string;
  aspectRatio?: string;
}

const ImagePlaceholder = ({ 
  src, 
  alt, 
  aspectRatio = 'aspect-video' 
}: ImagePlaceholderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className={`
        v-img relative inline-block w-full h-full
        align-middle bg-[#f1f2f3]
        ${aspectRatio}
      `}
    >
      {/* 模糊预览图 - 加载过渡 */}
      <div 
        className={`
          lqip absolute inset-0 pointer-events-none
          transition-opacity duration-200
          ${isLoaded ? 'opacity-0' : 'opacity-100'}
          filter blur-[20px] scale-110
        `}
        style={{ 
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
        }}
      />
      
      {/* 实际图片 */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`
          block w-full h-full object-cover
          transition-opacity duration-200
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  );
};
```

---

## 6. 阴影与层次系统

### 6.1 阴影规范

B站采用柔和的阴影设计，主要用于悬浮层和弹出框：

| 用途 | 阴影值 | Tailwind 扩展 | 效果描述 |
|-----|--------|--------------|---------|
| 弹出框阴影 | `0 0 30px rgba(0,0,0,0.1)` | `shadow-[0_0_30px_rgba(0,0,0,0.1)]` | 柔和的扩散光晕效果 |
| 卡片悬浮 | `0 2px 8px rgba(0,0,0,0.08)` | `shadow-md` | 轻微提升感 |
| 下拉菜单 | `0 4px 12px rgba(0,0,0,0.12)` | `shadow-lg` | 明确的悬浮感 |

**自定义阴影配置**（tailwind.config.js）：

```javascript
module.exports = {
  theme: {
    extend: {
      boxShadow: {
        'bilibili': '0 0 30px rgba(0, 0, 0, 0.1)',
        'bilibili-hover': '0 4px 20px rgba(0, 0, 0, 0.15)',
        'bilibili-popover': '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
    },
  },
};
```

### 6.2 层次（z-index）规范

为了避免 z-index 混乱，B站定义了清晰的层次体系：

| 层级 | 范围 | 用途 |
|-----|------|------|
| 默认 | auto / 0 | 普通文档流元素 |
| 底部悬浮 | 1 | 基础悬浮层 |
| 装饰层 | 10 | 渐变遮罩、装饰图案 |
| 内容层 | 20 | 卡片、频道图标 |
| 交互层 | 30 | 悬浮提示、Tooltip |
| 弹窗层 | 50 | Popover、Dropdown |
| 顶部层 | 100 | 全局提示、Loading |

```tsx
// z-index 层级组件示例
const LayeredComponent = () => {
  return (
    <>
      {/* 基础内容 - z-0 */}
      <div className="relative z-0">
        文档流内容
      </div>
      
      {/* 渐变遮罩 - z-10 */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        渐变遮罩
      </div>
      
      {/* 悬浮提示 - z-30 */}
      <div className="absolute z-30">
        <Tooltip content="提示文字" />
      </div>
      
      {/* 弹出框 - z-50 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-bilibili-popover p-4">
            弹出框内容
          </div>
        </div>
      )}
    </>
  );
};
```

---

## 7. 动效与过渡系统

### 7.1 过渡时长规范

B站的过渡动画采用适中的时长，既保证响应性又不会显得突兀：

| 动效类型 | 时长 | CSS 值 | 使用场景 |
|---------|------|--------|---------|
| 快速过渡 | 200ms | `duration-200` | 图片加载过渡、透明度变化 |
| 标准过渡 | 300ms | `duration-300` | 颜色变化、悬停效果 |
| 慢速过渡 | 500ms | `duration-500` | 大区域展开/收起 |
| 弹出动画 | 300ms | `duration-300` | Popover 显示/隐藏 |

### 7.2 缓动函数

```css
/* 标准缓动 - 适用于大部分交互 */
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

/* 弹跳缓动 - 

---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/10 17:42:40*