# 百度一下，你就知道 - 设计风格分析报告

> **分析时间**: 2026/1/21 14:16:23
> **页面 URL**: https://www.baidu.com/
> **采集时间**: 2026/1/21 14:15:33
> **视口尺寸**: 1280 x 720

---

<think>
用户要求我分析百度首页的设计系统，并输出一份详尽的设计风格指南（STYLEGUIDE.md）。

让我分析提供的HTML和CSS内容，提取设计规范：

## 1. 配色系统

### 品牌主色调
- 蓝色 #4E6EF2 - 主要品牌色，用于搜索框焦点边框、下拉菜单边框等
- 浅蓝色 #38f - 用于导航菜单悬停背景色
- 深蓝色 #2b99ff - 用于搜索建议中的图标背景

### 中性色
- 白色 #fff - 主要背景色
- 浅灰 #f0f0f0 - hover状态背景
- 灰色 #ccc - 边框颜色
- 深灰 #666 - 次要文本
- 黑色 #000 - 主要文本

### 语义色
- 红色 #EE0333 - 强调色
- 橙色 #F60 - 热标签背景
- 紫色 #7A77C8 - 商店相关

## 2. 字体系统
- 主要字体: Arial, sans-serif
- 字号: 12px, 13px, 14px, 16px
- 行高: 25px, 34px, 28px

## 3. 布局与间距
- 下拉菜单宽度: 535px / 544px / 545px
- 圆角: 9px, 10px, 12px

## 4. 组件风格

### 搜索框


搜索框设计体现了精准的交互细节。输入框具有轻微的圆角，焦点状态下呈现蓝色边框，创造出清晰的视觉反馈。占位符采用柔和的灰色调，引导用户输入。搜索建议下拉菜单通过微妙的阴影和圆角，营造出优雅的浮动效果。

下拉菜单采用纯白色背景，底部圆角为10-12px，配合细微的1像素边框。悬停时背景变为浅灰蓝，文字和图标同步高亮为品牌蓝色。菜单项高度固定为28-34px，垂直居中显示，保证良好的可读性和交互性。

导航菜单延续了简洁的设计语言。背景为纯白，文字使用深灰 (#333)，悬停时背景变为品牌蓝 (#38f)，文字转为白色。图标和箭头设计精细，箭头使用虚线边框，营造出微妙的层次感。

圆角设计追求极致的平滑感，下拉菜单和标签采用9-12px的圆角，标签使用4px的小圆角，搜索框则为10px的大圆角。阴影效果十分微妙，通过1-2px的柔和阴影增加界面的立体感。
</think>

# 百度搜索设计风格指南

## 1. 设计概览

百度搜索作为中国最大的中文搜索引擎，其设计语言体现了简洁、高效、用户友好的核心理念。本风格指南基于百度首页的HTML和CSS源码分析，提炼出可复用的设计令牌和组件规范，帮助开发团队保持设计一致性。

百度采用扁平化设计风格，以白色为主背景，蓝色为品牌强调色，通过细微的圆角、柔和的阴影和清晰的层级划分来构建视觉层次。设计系统强调内容的可读性和操作的便捷性，在搜索这一核心场景中追求极致的交互体验。

**设计理念关键词**：简洁、高效、友好、专注

---

## 2. 配色系统

### 2.1 品牌色板

百度搜索的蓝色品牌色经过精心设计，在保持品牌识别度的同时确保足够的对比度和可访问性。品牌色主要应用于交互焦点状态、链接文字和重要操作按钮。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| 品牌主色 | `#4E6EF2` | `border-blue-600` | 搜索框焦点边框、下拉菜单边框 |
| 品牌悬停色 | `#315EFB` | `text-blue-600` | 链接悬停、文字高亮 |
| 品牌浅色 | `#38f` | `bg-blue-500` | 导航菜单悬停背景 |
| 图标背景色 | `#2b99ff` | `bg-blue-400` | 搜索建议标签背景 |
| 浅蓝背景 | `#F1F3FD` | `bg-blue-50` | 选中项背景（深色主题适配） |

### 2.2 中性色系统

中性色用于构建页面的基础框架，包括背景、边框和文本。百度采用暖灰色调，避免纯黑色的生硬感，同时保持足够的对比度。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| 纯白 | `#FFFFFF` | `bg-white` | 卡片和下拉菜单背景 |
| 浅灰背景 | `#F5F5F6` | `bg-gray-100` | 分隔线区域、选中背景 |
| 更浅灰背景 | `#F0F0F0` | `bg-gray-200` | hover 状态背景 |
| 边框灰 | `#D1D1D1` | `border-gray-300` | 下拉菜单边框 |
| 次级边框 | `#DBDCE0` | `border-gray-200` | 搜索建议框边框 |
| 占位符灰 | `#AAAAAA` | `text-gray-400` | 输入框占位符 |
| 次级文本 | `#626675` | `text-gray-500` | 辅助说明文字 |
| 常规文本 | `#9195A3` | `text-gray-400` | 下拉菜单常规项 |
| 主要文本 | `#333333` | `text-gray-700` | 导航链接、主要文字 |
| 深黑 | `#000000` | `text-black` | 特定场景文字 |

### 2.3 语义色

语义色用于传达特定状态或信息类型，如热门标签、警告和新功能标记。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| 热门橙色 | `#F60` | `bg-orange-500` | 热门标签背景 |
| 新标签蓝 | `#36F` | `text-blue-500` | 新功能蓝色标签 |
| 新标签灰 | `#858585` | `text-gray-500` | 普通新标签 |
| 警告红 | `#EE0333` | `text-red-600` | 强调、警示信息 |
| 紫色强调 | `#7A77C8` | `text-purple-500` | 商店相关标识 |

### 2.4 暗色模式适配参考

虽然当前源码以浅色主题为主，但设计系统应预留暗色模式扩展。暗色模式下需调整的核心色值映射如下：

```tsx
// 暗色模式配色映射建议
const darkModeTokens = {
  background: {
    primary: '#1a1a1a',      // 替代 #FFFFFF
    secondary: '#2d2d2d',    // 替代 #F5F5F6
    hover: '#3d3d3d',        // 替代 #F0F0F0
  },
  text: {
    primary: '#ffffff',      // 替代 #333333
    secondary: '#b0b0b0',    // 替代 #626675
    muted: '#808080',        // 替代 #9195A3
  },
  border: {
    default: '#404040',      // 替代 #D1D1D1
    focus: '#4E6EF2',        // 保持品牌色
  }
};
```

---

## 3. 字体系统

### 3.1 字体栈

百度搜索采用系统字体栈，优先使用各平台的默认无衬线字体，确保在所有设备上的一致显示和最佳可读性。

```css
/* 字体栈定义 */
font-family: Arial, Helvetica, sans-serif;

/* Tailwind 配置建议 */
font-sans: ['Arial', 'Helvetica', 'sans-serif'];
```

Arial 作为首选字体因其广泛的系统覆盖率和清晰的字形表现。在中文环境下，系统会自动回退到对应的中文字体。

### 3.2 字号层级

字号系统采用四档基础规格，通过行高配合实现良好的阅读节奏。

| 层级 | 字号 | 行高 | Tailwind 类名 | 使用场景 |
|------|------|------|---------------|----------|
| 小字 | 12px | 22px | `text-xs` | 标签、辅助信息、版权 |
| 正文小 | 13px | 40px（垂直居中）| `text-sm` | 输入框占位符、面包屑 |
| 正文 | 14px | 25px | `text-base` | 下拉菜单项、按钮文字 |
| 标题 | 16px | 34px | `text-lg` | 下拉菜单选中项、主要导航 |
| 大标题 | 18px+ | - | `text-xl` | 页面主标题 |

### 3.3 字重规范

百度设计系统采用适中的字重策略，避免过粗或过细的字体带来的视觉负担。

| 字重 | 值 | 使用场景 |
|------|-----|----------|
| 常规 | 400 | 大部分正文、下拉菜单项 |
| 中等 | 500 | 选中项、hover 状态、强调文字 |
| 加粗 | 700 | 关键信息、标题、部分标签 |

```css
/* 字重应用示例 */
font-weight: 400;  /* 常规 - 默认状态 */
font-weight: 500;  /* 中等 - hover/selected */
font-weight: 700;  /* 加粗 - 重要信息 */
```

### 3.4 字母间距

特定场景下使用字母间距增强可读性和视觉节奏。

```css
/* 特殊标签字母间距 */
letter-spacing: 2px;   /* 新功能图标标签 */
letter-spacing: 0;     /* 恢复正常间距 */
```

---

## 4. 布局与间距系统

### 4.1 容器尺寸

搜索相关组件采用固定宽度设计，确保在不同屏幕尺寸下的一致体验。

| 组件 | 宽度 | 备注 |
|------|------|------|
| 搜索建议下拉框 | 535px / 544px | 根据场景适配 |
| 头部搜索区域 | 545px | 导航栏搜索框 |
| 菜单面板 | 70px / 105px | 设置和用户菜单 |

### 4.2 内边距规范

组件内部采用统一的内边距规范，确保内容呼吸感充足。

| 场景 | 上下 padding | 左右 padding | Tailwind |
|------|--------------|--------------|----------|
| 下拉菜单项 | 0 | 8px | `px-2` |
| 下拉菜单项（悬停） | 0 | 14px | `px-3.5` |
| 菜单项 | 0 | 9px | `px-2.25` |
| 下拉框内边距 | 10px | 10px | `p-2.5` |
| 搜索建议列表 | 7px 14px | - | `py-1.5 px-3.5` |

### 4.3 间距原子

组件间距遵循 4px 基础单位的倍数系统。

```tsx
// 常用间距 Tailwind 类名映射
const spacing = {
  xs: 'gap-1',      // 4px
  sm: 'gap-2',      // 8px
  md: 'gap-3',      // 12px
  lg: 'gap-4',      // 16px
  xl: 'gap-6',      // 24px
};
```

### 4.4 响应式断点

百度搜索主要针对桌面端优化，但设计系统应预留移动端适配能力。

```css
/* 响应式断点参考 */
@media (max-width: 768px) {
  /* 平板及以下 */
}
@media (max-width: 480px) {
  /* 手机端 */
}
```

---

## 5. 组件风格规范

### 5.1 搜索输入框

搜索输入框是百度最核心的交互组件，其设计需要在美观和功能性之间取得平衡。输入框采用圆角矩形设计，焦点状态下通过品牌蓝色边框明确当前焦点，配合占位符引导用户操作。

**设计要点：**
- 高度固定约 40px，确保点击区域足够大
- 圆角 10px，营造友好的视觉感受
- 焦点边框使用 #4E6EF2 品牌色
- 占位符使用 #aaa 灰色，提示文字清晰可见

```tsx
/**
 * 搜索输入框组件
 * 展示百度风格的搜索框实现
 */
import React, { useState } from 'react';

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = '百度一下，你就知道',
  onSearch,
  className = '',
}) => {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 搜索图标 */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      </span>

      {/* 输入框 */}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`
          w-[544px] h-[40px] pl-10 pr-4
          text-base text-gray-700 placeholder-gray-400
          bg-white
          outline-none
          rounded-[10px]
          transition-all duration-200
          ${focused 
            ? 'border-2 border-[#4E6EF2] border-t-0 border-b-2' 
            : 'border border-gray-300 hover:border-gray-400'
          }
        `}
      />

      {/* 搜索按钮 */}
      <button
        onClick={() => onSearch?.(value)}
        className={`
          absolute right-1 top-1 bottom-1
          px-6
          bg-[#4E6EF2] hover:bg-[#315EFB]
          text-white font-medium text-base
          rounded-[10px]
          transition-colors duration-200
        `}
      >
        百度一下
      </button>
    </div>
  );
};

export default SearchInput;
```

### 5.2 搜索建议下拉菜单

搜索建议下拉菜单是提升用户搜索效率的关键组件。其设计采用卡片式布局，通过分隔线和视觉层次组织不同类型的内容。

**设计要点：**
- 圆角底部 10-12px，与输入框形成视觉关联
- 悬停背景 #F1F3FD，品牌蓝色文字
- 列表项高度 28-34px，行距充足
- 支持键盘导航选中状态

```tsx
/**
 * 搜索建议下拉菜单
 * 包含历史记录、搜索建议等功能项
 */
import React, { useState } from 'react';

interface SuggestionItem {
  text: string;
  type?: 'history' | 'suggestion' | 'hot' | 'direct';
  icon?: React.ReactNode;
  isSelected?: boolean;
}

interface SearchSuggestionProps {
  items: SuggestionItem[];
  visible: boolean;
  onSelect: (item: SuggestionItem) => void;
  onDelete?: (item: SuggestionItem) => void;
}

export const SearchSuggestion: React.FC<SearchSuggestionProps> = ({
  items,
  visible,
  onSelect,
  onDelete,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  if (!visible) return null;

  return (
    <div 
      className="
        absolute top-full left-0 right-0
        mt-[-2px]
        bg-white
        border border-[#dbdce0]
        rounded-b-[12px]
        shadow-[0_2px_12px_0_rgba(51,91,255,0.08)]
        overflow-hidden
        z-50
        animate-fadeIn
      "
    >
      {/* 分隔线 */}
      <div className="mx-3.5 my-0 py-2 border-t border-gray-100">
        {items.map((item, index) => (
          <div
            key={index}
            className={`
              relative
              flex items-center
              px-3.5
              h-[34px]
              text-[#626675] text-[16px]
              cursor-pointer
              rounded-[9px]
              transition-all duration-150
              ${selectedIndex === index 
                ? 'bg-[#F5F6F9] font-medium' 
                : 'hover:bg-gray-50'
              }
              ${selectedIndex === index 
                ? 'text-[#315EFB]' 
                : ''
              }
            `}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => onSelect(item)}
          >
            {/* 左侧图标 */}
            {item.icon && (
              <span className="mr-1 text-[#222]">
                {item.icon}
              </span>
            )}

            {/* 文字内容 */}
            <span className={selected

---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/21 14:16:23*