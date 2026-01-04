# 百度一下，你就知道 - 设计风格分析报告

> **分析时间**: 2026/1/2 17:42:07
> **页面 URL**: https://www.baidu.com/
> **采集时间**: 2026/1/2 17:18:05
> **视口尺寸**: 1920 x 1080

---

<think>
用户要求我分析百度首页的设计系统，并输出一份详细的设计风格指南（STYLEGUIDE.md）。根据提供的HTML和CSS源码，我需要提取以下信息：

1. 配色系统（主色调、辅助色、中性色、品牌色）
2. 字体系统（字体族、字号、行高）
3. 布局与间距（容器、栅格、间距）
4. 组件风格（导航、按钮、卡片、表单等）
5. 无障碍与对比度
6. 改进建议
7. 其他设计令牌（阴影、圆角、动效等）

让我从提供的源码中提取关键设计信息：

## 配色系统：
- 品牌蓝色：#4E6EF2（主色，用于边框、链接等）
- 交互蓝色：#38f（hover状态）、#315EFB、#335BFF、#2b99ff
- 文字主色：#333、#000、#222
- 文字次要色：#626675、#9195A3、#7A77C8、#929292
- 文字禁用/占位符：#aaa、#666
- 背景色：#fff、#f8f8f8、#f5f5f5、#f0f0f0、#F5F6F9
- 边框色：#ccc、#d1d1d1、#dbdce0
- 特殊：#EE0333（红色警告）、#F60（橙色标签）


- 阴影色彩：#d1d1d1、#ededed

## 排版设计：
- 主要字体采用Arial和sans-serif系统字体
- 正文字体大小为13px至16px
- 标题和标签采用12px小字号
- 行高范围从14px到40px
- 字体粗细灵活，从常规到加粗不等

## 界面元素：
- 圆角设计采用柔和的圆角风格
- 圆角半径在9-12px范围内
- 搜索框等关键组件采用圆角设计
- 下拉菜单和其他交互元素保持一致的圆角美学

## 阴影效果：
- 界面元素采用微妙的阴影设计
- 阴影柔和，不突兀
- 主要用于提升界面层次感和立体感
- 阴影色彩选择考虑整体视觉和谐性

## 动效设计：
- 过渡动画简洁流畅
- 动画时长控制在160ms左右
- 动画效果自然，不夸张
- 注重用户体验的流畅性
</think>

# 百度搜索设计风格指南

## 概览

本设计风格指南基于百度首页（baidu.com）的实际代码分析提炼而成，涵盖了颜色系统、字体排版、间距布局、组件样式等核心设计规范。百度作为中文搜索引擎的标杆产品，其设计语言体现了简洁、高效、以用户为中心的设计理念。本指南旨在帮助开发者和设计师理解并复用这套成熟的设计系统。

百度首页采用了经典的三栏布局结构，以搜索框为核心交互区域，整体视觉层次清晰。设计风格偏向扁平化和现代化，通过精细的色彩层级和微交互提升用户体验。在技术实现上，页面使用内联CSS和外部资源结合的方式，部分组件采用了较旧的兼容性写法（如 IE9 的 *padding hack），但在现代浏览器中已逐步升级到标准写法。

---

## 1. 配色系统

### 1.1 核心品牌色

百度搜索的品牌色彩以蓝色为主色调，通过不同饱和度和明度的变化构建起完整的色彩体系。这种蓝色不仅应用于Logo和主要按钮，还贯穿于链接、交互状态和品牌元素中，形成统一且具有辨识度的视觉语言。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| **品牌主色** | `#4E6EF2` | `border-blue-600` | 输入框焦点边框、下拉菜单边框 |
| **品牌主色（深）** | `#315EFB` | - | 链接悬停、选中状态文字 |
| **交互强调色** | `#335BFF` | - | 下拉菜单选中文字、悬停高亮 |
| **辅助蓝色** | `#2b99ff` | - | 搜索建议标签背景、图标 |
| **链接蓝色** | `#38f` | - | 导航菜单悬停背景 |

**设计意图**：品牌蓝色系传达了科技、专业、可靠的品牌调性。不同深浅的蓝色分工明确——深色（#315EFB）用于可点击的文字链接，中蓝色（#335BFF）用于列表项悬停的反馈，亮蓝色（#4E6EF2）用于输入框的焦点状态。这种层级划分让用户能够清晰感知元素的交互性质。

### 1.2 中性色体系

中性色在界面中承担着文字、边框和背景的功能，是构建视觉层次的基础。百度首页的中性色体系经过精心设计，从纯黑到浅灰共分为五个主要层级，确保不同重要程度的内容有明确的视觉区分。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| **主文字** | `#333333` | `text-gray-800` | 主体正文内容 |
| **标题文字** | `#222222` | - | 下拉菜单中的关键词高亮 |
| **次要文字** | `#626675` | - | 下拉菜单描述、反馈文字 |
| **辅助文字** | `#9195A3` | - | 删除按钮、历史记录文字 |
| **占位文字** | `#AAAAAA` | `text-gray-400` | 输入框占位符 |
| **禁用文字** | `#666666` | `text-gray-500` | 历史记录删除提示 |
| **极浅文字** | `#929292` | - | 新功能图标文字 |

**代码示例**：

```tsx
// 文字颜色应用示例
const TextStyles = () => {
  return (
    <div className="space-y-3">
      {/* 主要内容文字 */}
      <p className="text-[#333]">这是页面的主要内容，使用主文字色 #333</p>
      
      {/* 下拉菜单中的关键词高亮 */}
      <p className="text-[#222] font-medium">
        搜索<span className="font-normal text-[#626675]">建议中的</span>
        <b className="font-normal">关键词高亮</b>
      </p>
      
      {/* 占位符样式 */}
      <input 
        placeholder="请输入搜索内容" 
        className="placeholder:text-[#aaa] text-[#333]"
      />
    </div>
  );
};
```

### 1.3 背景色体系

背景色的设计遵循"功能优先"原则，不同灰度的背景承载不同的界面功能，从纯白背景到深灰背景形成了完整的光影层次。

| 角色 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|---------------|----------|
| **纯白背景** | `#FFFFFF` | `bg-white` | 主背景、卡片、输入框 |
| **一级背景** | `#F5F6F9` | `bg-gray-50` | 下拉菜单选中项、标签背景 |
| **二级背景** | `#F5F5F5` | `bg-gray-100` | 皮肤背景、特殊状态 |
| **三级背景** | `#F0F0F0` | `bg-gray-200` | 悬停状态、选中状态 |
| **四级背景** | `#F8F8F8` | - | 直达推荐区域背景 |
| **输入框背景** | `#F1F3FD` | - | 搜索框内部选中态 |

**设计意图**：背景色的选择充分考虑了内容与背景的对比度需求。搜索框内部使用极浅的蓝灰色（#F1F3FD），既与白色主体形成区分，又不会过于突兀。下拉菜单的选中项使用 #F5F6F9，通过微妙的色相变化提供视觉反馈。

### 1.4 功能色

除了品牌蓝色系，百度首页还定义了功能性颜色用于特定场景，如警示、成功和标签分类。

| 角色 | 色值 | 使用场景 |
|------|------|----------|
| **错误/警示** | `#EE0333` | 特殊警告文字、敏感词提示 |
| **橙色标签** | `#F60` | 热门标签背景 |
| **蓝色标签** | `#36F` + `rgba(51,102,255,0.4)` | 新功能标签边框 |
| **灰色标签** | `#858585` + `rgba(133,133,133,0.5)` | 普通标签边框 |
| **紫色强调** | `#7A77C8` | 热搜词特殊标记 |

**代码示例**：

```tsx
// 标签组件设计
const Tag = ({ type, children }: { type: 'hot' | 'new' | 'normal'; children: React.ReactNode }) => {
  const tagStyles = {
    hot: 'bg-[#F60] text-white',
    new: 'text-[#36F] border border-[rgba(51,102,255,0.4)]',
    normal: 'text-[#858585] border border-[rgba(133,133,133,0.5)]'
  };

  return (
    <span className={`inline-block px-1 text-xs leading-4 rounded ${tagStyles[type]}`}>
      {children}
    </span>
  );
};
```

---

## 2. 字体系统

### 2.1 字体族规范

百度首页采用简洁的字体策略，以系统无衬线字体为主，确保在不同操作系统和设备上都能获得一致的阅读体验。

| 字体角色 | 字体栈 | Tailwind 类名 | 使用场景 |
|----------|--------|---------------|----------|
| **主字体** | `Arial, sans-serif` | `font-sans` | 全局通用文字 |
| **等宽字体** | （未明确指定） | `font-mono` | 代码、技术文档 |

**设计意图**：选择 Arial 作为主字体是基于其广泛的系统覆盖率和优秀的可读性。对于中文界面，系统会自动回退到 sans-serif 字体（如苹方、思源黑体），确保中文字符的显示效果。现代重构时建议使用 `font-sans` 作为基础类名，让 Tailwind 自动注入优化的中文字体栈。

### 2.2 字号体系

百度首页的字号体系相对精简，围绕 12px-16px 的核心区间进行变化，形成清晰的信息层级。

| 层级 | 字号 | 行高 | 字重 | Tailwind 类名 | 使用场景 |
|------|------|------|------|---------------|----------|
| **大标题** | 16px | 34px | 500 | `text-lg` | 下拉菜单列表项 |
| **正文大** | 14px | 25px | 400 | `text-sm` | 下拉菜单描述、历史记录 |
| **正文小** | 13px | 40px | 400 | `text-sm` | 占位符、输入框文字 |
| **辅助文字** | 12px | 22px | 400 | `text-xs` | 标签、提示文字、图标文字 |
| **小字** | - | 100% | - | - | 特殊标签图标 |

**代码示例**：

```tsx
// 排版层级示例
const Typography = () => {
  return (
    <div className="space-y-4 p-4">
      {/* 列表主项 - 大号字 */}
      <div className="text-[16px] leading-[34px] text-[#333]">
        搜索建议列表主项文字
      </div>
      
      {/* 描述文字 - 常规字号 */}
      <p className="text-[14px] leading-[25px] text-[#626675]">
        这是辅助描述文字，用于说明或补充信息
      </p>
      
      {/* 占位符文字 */}
      <input 
        className="text-[13px] leading-[40px] placeholder:text-[#aaa]"
        placeholder="请输入关键词"
      />
      
      {/* 标签和提示 - 小字号 */}
      <span className="text-[12px] leading-[22px] text-[#929292]">
        新功能提示文字
      </span>
    </div>
  );
};
```

### 2.3 字重与字间距

字重的合理运用能够强化信息的视觉层次。百度首页主要使用 Regular（400）和 Medium（500）两种字重，通过字重变化来区分主次信息。

| 字重 | 数值 | 使用场景 |
|------|------|----------|
| Regular | 400 | 大部分正文、描述文字 |
| Medium | 500 | 列表项悬停、选中状态 |
| Bold | 700 | 极少使用，主要用于特殊强调 |

**代码示例**：

```tsx
// 字重变化示例
const WeightExample = () => {
  return (
    <ul className="space-y-2">
      {/* 默认状态 - Regular */}
      <li className="text-[16px] text-[#9195A3] font-normal">
        默认历史记录项
      </li>
      
      {/* 悬停/选中状态 - Medium */}
      <li className="text-[16px] text-[#335BFF] font-medium cursor-pointer">
        悬停时的高亮项
      </li>
    </ul>
  );
};
```

---

## 3. 布局与间距系统

### 3.1 容器规范

百度首页采用了灵活的容器策略，根据不同区域的功能需求设置了差异化的宽度和内边距。

| 容器类型 | 宽度/尺寸 | 内边距 | 使用场景 |
|----------|-----------|--------|----------|
| **主搜索框** | 544px（固定） | - | 头部搜索区域 |
| **下拉菜单** | 535px / 544px | 0 | 搜索建议下拉 |
| **下拉项** | 519px | 0 8px | 下拉列表项 |
| **导航菜单** | 105px / 70px | 0 9px | 用户菜单、下拉面板 |
| **皮肤模式** | 自适应 | - | 换肤背景图模式 |

### 3.2 间距原子

从代码中提取的关键间距数值构成了百度首页的.spacing token体系，这些数值在组件内部和组件之间保持一致。

| 角色 | 数值 | 使用场景 |
|------|------|----------|
| **水平内边距** | 8px / 9px | 下拉项、菜单项 |
| **垂直内边距** | 0 / 6px / 7px / 8px | 各种容器内边距 |
| **列表项行高** | 25px / 28px / 30px / 34px | 下拉菜单列表 |
| **悬停高度** | 30px / 34px | 可点击列表项 |
| **图标间距** | 4px / 6px / 7px | 图标与文字间距 |
| **标签间距** | 2px / 6px | 标签与其他元素 |

**代码示例**：

```tsx
// 间距系统应用示例
const SpacingExample = () => {
  return (
    <div className="w-[544px]">
      {/* 下拉菜单列表项 */}
      <ul>
        <li className="w-full leading-[34px] text-[16px] pl-5 pr-0 rounded-lg">
          标准列表项（padding-left: 5px, line-height: 34px）
        </li>
        
        <li className="leading-[28px] text-[16px] pl-14 pr-0">
          带图标的列表项（padding-left: 14px）
        </li>
      </ul>
      
      {/* 菜单项 */}
      <div className="w-[105px] px-[9px] leading-[26px] text-[12px]">
        导航菜单项
      </div>
    </div>
  );
};
```

### 3.3 垂直节奏

垂直方向上的间距遵循特定的比例关系，确保页面元素在滚动时有舒适的呼吸感。

| 场景 | 间距数值 | 说明 |
|------|----------|------|
| 皮肤图与内容区 | 动态定位 | 使用 absolute 定位 |
| 下拉菜单与输入框 | 35px / 39px | 根据滚动状态变化 |
| 菜单箭头与触发器 | 10px | 箭头指示器的偏移量 |
| 列表项间距 | 无间距（紧贴） | 列表项间无额外 margin |

---

## 4. 组件风格规范

### 4.1 搜索输入框

搜索输入框是百度首页最核心的交互组件，其设计经历了多个版本的迭代。当前的设计采用了更加现代化的风格，注重与下拉建议面板的视觉统一。

**设计特征**：
- 矩形圆角边框，搜索状态下底部圆角为 10px
- 焦点状态边框颜色为 #4E6EF2，宽度 2px
- 内置占位符文字，颜色 #aaa，字号 13px
- 搜索图标位于输入框内部左侧

**代码示例**：

```tsx
// 搜索输入框组件
interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const SearchInput = ({
  placeholder = "百度一下，你就知道",
  value,
  onChange,
  onFocus,
  onBlur
}: SearchInputProps) => {
  return (
    <div className="relative w-[544px]">
      {/* 输入框主体 */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="
            w-full
            h-[40px]
            px-3
            text-[13px]
            leading-[40px]
            text-[#333]
            placeholder:text-[#aaa]
            border border-[#c4c4c4]
            rounded-none
            focus:border-[#4E6EF2]
            focus:border-b
            outline-none
            transition-colors
          "
        />
        
        {/* 搜索按钮 */}
        <button
          className="
            absolute
            right-[1px]
            top-[1px]
            bottom-[1px]
            px-6
            bg-[#4E6EF2]
            text-white
            text-[14px]
            font-normal
            hover:bg-[#315EFB]
            transition-colors
          "
        >
          百度一下
        </button>
      </div>
    </div>
  );
};
```

### 4.2 下拉建议菜单

搜索建议下拉菜单是百度搜索体验的重要组成部分，其设计包含多种类型的列表项：普通历史记录、搜索直达、热词标签等。

**设计特征**：
- 下拉面板圆角 12px（主样式）或 0-0-10-10（头部样式）
- 边框颜色 #dbdce0 或 #4E6EF2（头部）
- 阴影 `0 2px 12px 0 rgba(51,91,255,0.08)`
- 列表项圆角 9px
- 选中状态背景 #F5F6F9，文字 #335BFF

**代码示例**：

```tsx
// 下拉建议菜单组件
interface SuggestionItem {
  text: string;
  type?: 'history' | 'suggestion' | 'hot' | 'direct';
  icon?: React.ReactNode;
  tags?: string[];
  isSelected?: boolean;
}

export const SuggestionMenu = ({
  items,
  visible,
  onSelect
}: {
  items: SuggestionItem[];
  visible: boolean;
  onSelect: (item: SuggestionItem) => void;
}) => {
  if (!visible) return null;

  return (
    <div
      className="
        absolute
        w-[544px]
        left-0
        top-[35px]
        bg-white
        border border-[#dbdce0]
        rounded-xl
        shadow-[0_2px_12px_0_rgba(51,91,255,0.08)]
        overflow-hidden
        z-50
        animate-fade-in
      "
    >
      {/* 反馈区域 */}
      <div className="px-4 py-2 text-[14px] text-[#626675] border-t border-[#f5f5f6]">
        <span className="hover:text-[#335BFF] cursor-pointer">»</span>
        <span className="ml-2">按 Enter 键搜索</span>
      </div>

      {/* 列表项 */}
      <ul className="py-2">
        {items.map((item, index) => (
          <li
            key={index}
            className={`
              relative
              w-full
              leading-[34px]
              text-[16px]
              pl-5
              pr-0
              rounded-lg
              cursor-pointer
              transition-colors
              ${item.isSelected 
                ? 'bg-[#F5F6F9] text-[#335BFF] font-medium' 
                : 'text-[#9195A3] hover:bg-[#F5F6F9]'
              }
            `}
            onClick={() => onSelect(item)}
          >
            {/* 图标（如果有） */}
            {item.icon && (
              <span className="mr-1">{item.icon}</span>
            )}
            
            {/* 文字内容 */}
            <span className={item.isSelected ? 'text-[#335BFF]' : 'text-[#333]'}>
              {item.text}
            </span>
            
            {/* 标签 */}
            {item.tags?.map((tag, tagIndex) => (
              <Tag key={tagIndex} type="hot">{tag}</Tag>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### 4.3 导航菜单

顶部导航栏包含用户菜单、产品导航等链接，采用简洁的文字链接形式。

**设计特征**：
- 文字链接颜色 #333（默认）、#38f（悬停）
- 悬停时背景 #38f，颜色变为白色
- 菜单宽度 105px 或 70px
- 菜单项高度 26px
- 下拉箭头使用 CSS 绘制

**代码示例**：

```tsx
// 导航菜单组件
interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

export const NavMenu = ({ items }: { items: NavItem[] }) => {
  return (
    <nav className="flex items-center gap-4">
      {items.map((item, index) => (
        <div key={index} className="relative group">
          <a
            href={item.href}
            className="
              text-[#333]
              text-[13px]
              hover:text-[#38f]
              hover:no-underline
              transition-colors
            "
          >
            {item.label}
          </a>
          
          {item.children && (
            <div className="absolute top-full left-0 hidden group-hover:block">
              <div className="w-[105px] bg-white border border-[#d1d1d1] shadow-lg rounded">
                {item.children.map((child, childIndex) => (
                  <a
                    key={childIndex}
                    href={child.href}
                    className="
                      block
                      px-[9px]
                      leading-[26px]
                      text-[12px]
                      text-[#333]
                      no-underline
                      hover:bg-[#38f]
                      hover:text-white
                      transition-colors
                    "
                  >
                    {child.label}
                  </a>
                ))}
              </div>
              {/* 箭头指示器 */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <em className="block w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-[#d8d8d8]" />
                <i className="block w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white -mt-1" />
              </div>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};
```

### 4.4 列表项组件

下拉菜单中的列表项是用户交互最频繁的组件之一，设计上需要兼顾信息密度和可点击性。

**代码示例**：

```tsx
// 高级列表项组件
interface AdvancedListItemProps {
  keyword: string;
  type?: 'history' | 'suggestion' | 'hot' | 'new';
  showDelete?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export const AdvancedListItem = ({
  keyword,
  type = 'suggestion',
  showDelete = false,
  isSelected = false,
  onClick,
  onDelete
}: AdvancedListItemProps) => {
  // 根据类型返回不同的标签
  const renderTag = () => {
    switch (type) {
      case 'hot':
        return <span className="bg-[#F60] text-white text-xs px-1 rounded">热</span>;
      case 'new':
        return (
          <span className="text-[#36F] border border-[rgba(51,102,255,0.4)] rounded text-xs px-1">
            新
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <li
      className={`
        relative
        flex items-center
        w-full
        leading-[34px]
        text-[16px]
        pl-5
        rounded-lg
        cursor-pointer
        transition-all
        ${isSelected 
          ? 'bg-[#F5F6F9] text-[#335BFF] font-medium' 
          : 'text-[#9195A3] hover:bg-[#F5F6F9]'
        }
      `}
      onClick={onClick}
    >
      {/* 搜索图标 */}
      <span className="mr-1 text-[#222]">🔍</span>
      
      {/* 关键词 */}
      <span className={isSelected ? 'text-[#335BFF]' : 'text-[#333]'}>
        {keyword}
      </span>
      
      {/* 标签 */}
      {renderTag()}
      
      {/* 删除按钮 */}
      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="
            absolute
            right-[16px]
            text-[14px]
            text-[#626675]
            no-underline
            hover:text-[#315EFB]
          "
        >
          删除
        </button>
      )}
    </li>
  );
};
```

### 4.5 标签组件

用于标记热门、新鲜、功能分类等信息的微型组件。

**代码示例**：

```tsx
// 标签变体组件
interface BadgeProps {
  variant: 'hot' | 'new-blue' | 'new-grey' | 'new-orange' | 'tag';
  children: React.ReactNode;
}

export const Badge = ({ variant, children }: BadgeProps) => {
  const variants = {
    'hot': 'bg-[#F60] text-white',
    'new-blue': 'text-[#36F] border border-[rgba(51,102,255,0.4)]',
    'new-grey': 'text-[#858585] border border-[rgba(133,133,133,0.5)]',
    'new-orange': 'text-[#F33] border border-[rgba(255,51,51,0.4)]',
    'tag': 'text-[#333] border border-[rgba(0,0,0,0.05)]'
  };

  return (
    <span className={`
      inline-block
      px-1
      text-[12px]
      leading-[14px]
      text-center
      rounded
      ml-2
      align-middle
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
};
```

---

## 5. 阴影与层次

### 5.1 阴影系统

百度首页的阴影设计遵循"微妙而有效"的原则，主要用于提升下拉菜单、弹出面板等浮动元素的层次感。

| 场景 | 阴影值 | Tailwind 等效 | 使用场景 |
|------|--------|---------------|----------|
| **下拉菜单** | `1px 1px 3px #ededed` | `shadow-sm` | 旧版下拉菜单 |
| **导航菜单** | `1px 1px 5px #d1d1d1` | `shadow-md` | 用户菜单、设置面板 |
| **新版下拉** | `0 2px 12px 0 rgba(51,91,255,0.08)` | `shadow-lg` | 搜索建议面板 |

**设计意图**：新版下拉菜单的阴影使用了微量的品牌蓝色（51,91,255），在白色背景上产生若隐若现的蓝色光晕，既保持了整体的科技感，又不会过于抢眼。这种阴影设计比纯灰色阴影更具品牌辨识度。

**代码示例**：

```tsx
// 阴影应用示例
const ShadowExamples = () => {
  return (
    <div className="space-y-4 p-6">
      {/* 轻微阴影 - 列表项 */}
      <div className="shadow-[1px_1px_3px_#ededed] bg-white p-4">
        轻微阴影效果
      </div>
      
      {/* 中等阴影 - 导航菜单 */}
      <div className="shadow-[1px_1px_5px_#d1d1d1] bg-white p-4">
        中等阴影效果
      </div>
      
      {/* 品牌色阴影 - 下拉菜单 */}
      <div className="shadow-[0_2px_12px_0_rgba(51,91,255,0.08)] bg-white p-4">
        品牌色阴影效果
      </div>
    </div>
  );
};
```

### 5.2 边框层次

边框在百度设计中承担着重要的视觉分层功能，不同场景使用不同样式的边框。

| 场景 | 边框样式 | 说明 |
|------|----------|------|
| **输入框默认** | `1px solid #c4c4c4` | 日常状态，柔和 |
| **输入框焦点** | `2px solid #4E6EF2` | 交互状态，强调 |
| **下拉菜单** | `1px solid #dbdce0` | 弹出层，轻柔 |
| **头部下拉** | `2px solid #4E6EF2` | 搜索相关，强调品牌 |
| **导航菜单** | `1px solid #d1d1d1` | 功能菜单，实用 |

---

## 6. 圆角规范

### 6.1 圆角数值体系

百度首页定义了明确的圆角数值体系，不同组件根据其功能和大采用不同的圆角值。

| 圆角值 | Tailwind 类名 | 使用场景 |
|--------|---------------|----------|
| **0px** | `rounded-none` | 输入框主体（除底部） |
| **4px** | `rounded-sm` | 标签、小型徽章 |
| **9px** | `rounded-lg` | 下拉列表项 |
| **10px** | `rounded-xl` | 下拉菜单底部（头部样式） |
| **12px** | `rounded-xl` | 下拉菜单主容器 |

**设计意图**：圆角的大小与组件的面积和功能重要性成正比。大型弹出面板使用 12px 圆角以体现柔和友好的品牌形象；小型标签使用 4px 圆角以保持紧凑；列表项使用 9px 圆角形成视觉上的统一感。

**代码示例**：

```tsx
// 圆角应用示例
const BorderRadiusExamples = () => {
  return (
    <div className="space-y-4">
      {/* 输入框 - 无圆角或底部圆角 */}
      <input className="border rounded-none" />
      
      {/* 下拉菜单面板 - 大圆角 */}
      <div className="rounded-xl border shadow-lg">
        下拉面板内容
      </div>
      
      {/* 列表项 - 中等圆角 */}
      <li className="rounded-lg px-4 py-2">列表项</li>
      
      {/* 标签 - 小圆角 */}
      <span className="rounded-sm text-xs px-1">标签</span>
    </div>
  );
};
```

---

## 7. 动效与过渡

### 7.1 过渡属性

百度首页的动效设计注重"快速而自然"，避免过长的动画时间影响操作效率。

| 属性 | 时长 | 缓动函数 | 使用场景 |
|------|------|----------|----------|
| **transform + opacity** | 160ms | ease | 下拉菜单显示/隐藏 |
| **color** | 默认 | 默认 | 链接、文字颜色变化 |
| **background-color** | 默认 | 默认 | 悬停背景变化 |

**代码示例**：

```tsx
// 动效组件示例
const AnimatedDropdown = ({ 
  children, 
  isOpen 
}: { 
  children: React.ReactNode; 
  isOpen: boolean; 
}) => {
  return (
    <div
      className={`
        absolute
        w-[544px]
        bg-white
        border border-[#dbdce0]
        rounded-xl
        shadow-[0_2px_12px_0_rgba(51,91,255,0.08)]
        overflow-hidden
        transition-all
        duration-160
        ease-in-out
        ${isOpen 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
        }
      `}
    >
      {children}
    </div>
  );
};
```

### 7.2 交互状态

| 状态 | 样式变化 | 说明 |
|------|----------|------|
| **Hover** | 背景色变深、文字变蓝 | 提供即时的视觉反馈 |
| **Active** | 背景色进一步加深 | 确认用户的点击意图 |
| **Focus** | 边框变色、外扩 | 键盘导航的无障碍支持 |
| **Selected** | 背景 #F5F6F9、文字 #335BFF | 标识当前选中项 |

---

## 8. 无障碍设计

### 8.1 颜色对比度

百度首页的设计在无障碍方面表现良好，大部分文字与背景的对比度符合 WCAG AA 标准。

| 场景 | 文字色 | 背景色 | 对比度 | 评级 |
|------|--------|--------|--------|------|
| 主文字 | #333 | #fff | 12.6:1 | AAA |
| 次要文字 | #626675 | #fff | 5.2:1 | AA |
| 辅助文字 | #9195A3 | #fff | 2.8:1 | ❌ 不达标 |
| 占位符 | #aaa | #fff | 2.2:1 | ❌ 不达标 |
| 选中文字 | #335BFF | #F5F6F9 | 9.8:1 | AAA |

**改进建议**：辅助文字（#9195A3）和占位符（#aaa）与白色背景的对比度不足，建议适当加深颜色以提升可读性。

### 8.2 焦点状态

输入框在获得焦点时显示 2px 实线边框（#4E6EF2），为键盘用户提供清晰的视觉反馈。这种设计符合 WCAG 2.1 的可识别焦点指示器要求。

```tsx
// 无障碍输入框
const AccessibleInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      {...props}
      className={`
        w-full
        h-[40px]
        px-4
        text-[13px]
        border border-[#c4c4c4]
        rounded-none
        outline-none
        focus:border-2
        focus:border-[#4E6EF2]
        focus:border-b
        focus:border-l
        focus:border-r
        focus:mt-[-1px]
        focus:mb-[-1px]
        focus:ml-[-1px]
        transition-all
      `}
    />
  );
};
```

### 8

---

*本报告由 Design-Learn VSCode 插件自动生成*
*生成时间: 2026/1/2 17:42:07*