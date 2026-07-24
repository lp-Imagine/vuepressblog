---
title: Chrome Extension（扩展程序）开发
date: 2022-09-06
tags:
  - Chrome
section: computer
---

# Chrome Extension（扩展程序）开发

<p class="article-meta"><time datetime="2022-09-06">2022-09-06</time><span class="article-tag">Chrome</span></p>

## 基本概念

### chrome 扩展是什么？

一个应用（扩展）其实是压缩（`.crx` 后缀）在一起的一组文件，包括 `HTML，CSS，Javascript` 脚本，图片文件，还有其它任何需要的文件。 应用（扩展）本质上来说就是 `web` 页面，它们可以使用所有的浏览器提供的 `API`，从 `XMLHttpRequest` 到 `JSON` 到 `HTML5` 全都有。

应用（扩展）可以与 `Web` 页面交互，或者通过 `content script` 或 `cross-origin XMLHttpRequests` 与服务器交互。应用（扩展）还可以访问浏览器提供的内部功能，例如标签或书签等。




### chrome 扩展用处

增强浏览器的功能，可以向页面注入 `js` 脚本作一些操作，实现属于自己的“定制版”浏览器。
提供了很多 `API` 供我们来使用：

- [标签](http://open.chrome.360.cn/extension_dev/tabs.html)
- [书签](http://open.chrome.360.cn/extension_dev/bookmarks.html)
- [Cookies](http://open.chrome.360.cn/extension_dev/cookies.html)
- [Events](http://open.chrome.360.cn/extension_dev/evnets.html)
- [开发者工具](http://open.chrome.360.cn/extension_dev/devtools.html)
- [历史记录](http://open.chrome.360.cn/extension_dev/history.html)
- [插件管理](http://open.chrome.360.cn/extension_dev/management.html)
- [视窗](http://open.chrome.360.cn/extension_dev/windows.html)
  等等...

---

## 开发与调试

`Chrome` 插件没有严格的项目结构要求，只要保证本目录有一个 `manifest.json` 即可，也不需要专门的 `IDE`，普通的 `web` 开发工具即可。
从右上角菜单->更多工具->扩展程序可以进入插件管理页面，也可以直接在地址栏输入 `chrome://extensions` 访问。
::: tip
勾选开发者模式即可以文件夹的形式直接加载插件，否则只能安装`.crx` 格式的文件。`Chrome` 要求插件必须从它的 `Chrome` 应用商店安装，其它任何网站下载的都无法直接安装，所以，其实我们可以把 `crx` 文件解压，然后通过开发者模式直接加载。

开发中，代码有任何改动都必须重新加载插件，只需要在插件管理页按下 `Ctrl+R` 即可，以防万一最好还把页面刷新一下。
:::

### 核心结构

> `manifest.json`：这是一个 `Chrome` 插件最重要也是必不可少的文件，用来配置所有和插件相关的配置，必须放在根目录。
> 字段说明：

```json
{
  "manifest_version": 2, // 清单文件的版本，这个必须写，而且必须是2

  "name": "demo", // 插件的名称
  "version": "1.0.0", // 插件的版本
  "description": "Chrome扩展demo", // 插件描述
  // 图标，一般偷懒全部用一个尺寸的也没问题
  "icons": {
    "16": "img/icon.png",
    "48": "img/icon.png",
    "128": "img/icon.png"
  },
  // 会一直常驻的后台JS或后台页面
  "background": {
    // 2种指定方式，如果指定JS，那么会自动生成一个背景页
    "page": "background.html" //"scripts": ["js/background.js"]
  },
  // 浏览器右上角图标设置，browser_action、page_action、app必须三选一
  "browser_action": {
    "default_icon": "img/icon.png",
    "default_title": "这是一个Chrome插件", // 图标悬停时的标题，可选
    "default_popup": "popup.html"
  },
  /*"page_action": 
 {
  "default_icon": "img/icon.png", // 当某些特定页面打开才显示的图标
  "default_title": "我是pageAction",
  "default_popup": "popup.html"
 },*/ // 需要直接注入页面的JS
  "content_scripts": [
    {
      //"matches": ["http://*/*", "https://*/*"],
      // "&lt;all_urls&gt;" 表示匹配所有地址
      "matches": ["&lt;all_urls&gt;"], // 多个JS按顺序注入
      "js": ["js/jquery-1.8.3.js", "js/content-script.js"], // JS的注入可以随便一点，但是CSS的注意就要千万小心了，因为一不小心就可能影响全局样式
      "css": ["css/custom.css"], // 代码注入的时间，可选值： "document_start", "document_end", or "document_idle"，最后一个表示页面空闲时，默认document_idle
      "run_at": "document_start"
    },
    // 这里仅仅是为了演示content-script可以配置多个规则
    {
      "matches": ["*://*/*.png", "*://*/*.jpg", "*://*/*.gif", "*://*/*.bmp"],
      "js": ["js/show-image-content-size.js"]
    }
  ],
  // 权限申请
  "permissions": [
    "contextMenus", // 右键菜单
    "tabs", // 标签
    "notifications", // 通知
    "webRequest", // web请求
    "webRequestBlocking",
    "storage", // 插件本地存储
    "http://*/*", // 可以通过executeScript或者insertCSS访问的网站
    "https://*/*" // 可以通过executeScript或者insertCSS访问的网站
  ],
  // 普通页面能够直接访问的插件资源列表，如果不设置是无法直接访问的
  "web_accessible_resources": ["js/inject.js"], // 插件主页，这个很重要，不要浪费了这个免费广告位
  "homepage_url": "https://www.baidu.com", // 覆盖浏览器默认页面
  "chrome_url_overrides": {
    // 覆盖浏览器默认的新标签页
    "newtab": "newtab.html"
  },
  // Chrome40以前的插件配置页写法
  "options_page": "options.html",
  // Chrome40以后的插件配置页写法，如果2个都写，新版Chrome只认后面这一个
  "options_ui": {
    "page": "options.html",
    "chrome_style": true // 添加一些默认的样式，推荐使用
  },
  "omnibox": { "keyword": "go" }, // 向地址栏注册一个关键字以提供搜索建议，只能设置一个关键字
  "default_locale": "zh_CN", // 默认语言
  // devtools页面入口，注意只能指向一个HTML文件，不能是JS文件
  "devtools_page": "devtools.html"
}
```

> `content-scripts`：是 `Chrome` 插件中向页面注入脚本的一种形式（虽然名为 `script`，其实还可以包括 `css` 的），借助 `content-scripts` 我们可以实现通过配置的方式轻松向指定页面注入 `JS` 和 `CSS`，最常见的比如：广告屏蔽、页面 `CSS` 定制，等等。

配置 🌰：

```json
{
  // 需要直接注入页面的JS
  "content_scripts": [
    {
      //"matches": ["http://*/*", "https://*/*"],
      // "&lt;all_urls&gt;" 表示匹配所有地址
      "matches": ["&lt;all_urls&gt;"], // 多个JS按顺序注入
      "js": ["js/jquery-1.8.3.js", "js/content-script.js"], // JS的注入可以随便一点，但是CSS的注意就要千万小心了，因为一不小心就可能影响全局样式
      "css": ["css/custom.css"], // 代码注入的时间，可选值： "document_start", "document_end", or "document_idle"，最后一个表示页面空闲时，默认document_idle
      "run_at": "document_start"
    }
  ]
}
```

`content-scripts` 和原始页面共享 `DOM`，但是不共享`JS`，如要访问页面 `JS`（例如某个 `JS` 变量），只能通过 `injected js` 来实现。`content-scripts` 不能访问绝大部分 `chrome.xxx.api`，除了下面这 4 种：

- `chrome.extension(getURL , inIncognitoContext , lastError , onRequest , sendRequest)`
- `chrome.i18n`
- `chrome.runtime(connect , getManifest , getURL , id , onConnect , onMessage , sendMessage)`
- `chrome.storage`

> `backgroud`：背景页，是一个常驻的页面，它的生命周期是插件中所有类型页面中最长的，它随着浏览器的打开而打开，随着浏览器的关闭而关闭，所以通常把需要一直运行的、启动就运行的、全局的代码放在 `background` 里面。

`background` 的权限非常高，几乎可以调用所有的 `Chrome` 扩展 `API`（除了 `devtools`），而且它可以无限制跨域，也就是可以跨域访问任何网站而无需要求对方设置 `CORS`。不止是 `background`，所有的直接通过 `chrome-extension://id/xx.html` 这种方式打开的网页都可以无限制跨域。

```json
{
  // 会一直常驻的后台JS或后台页面
  "background": {
    // 2种指定方式，如果指定JS，那么会自动生成一个背景页
    "page": "background.html" //"scripts": ["js/background.js"]
  }
}
```

::: tip
需要特别说明的是，虽然可以通过 `chrome-extension://xxx/background.html` 直接打开后台页，但是打开的后台页和真正一直在后台运行的那个页面不是同一个，换句话说，可以打开无数个 `background.html`，但是真正在后台常驻的只有一个，而且永远看不到它的界面，只能调试它的代码。
:::

- `event-pages`
  鉴于 `background` 生命周期太长，长时间挂载后台可能会影响性能，所以 `Google` 又弄一个 `event-pages`，在配置文件上，它与 `background` 的唯一区别就是多了一个 `persistent` 参数。

```json
{
  "background": {
    "scripts": ["event-page.js"],
    "persistent": false
  }
}
```

它的生命周期是：在被需要时加载，在空闲时被关闭，什么叫被需要时呢？比如第一次安装、插件更新、有 `content-script` 向它发送消息，等等。
除了配置文件的变化，代码上也有一些细微变化，这个简单了解一下就行了，一般情况下 background 也不会很消耗性能的。

> `popup`： 是点击 `browser_action` 或者 `page_action` 图标时打开的一个小窗口网页，焦点离开网页就立即关闭，一般用来做一些临时性的交互。

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/popup.png)

`popup` 可以包含任意你想要的 `HTML` 内容，并且会自适应大小。可以通过 `default_popup` 字段来指定 `popup` 页面，也可以调用 `setPopup()`方法。
配置 🌰：

```json
{
  "browser_action": {
    "default_icon": "img/icon.png", // 图标悬停时的标题，可选
    "default_title": "这是一个Chrome插件",
    "default_popup": "popup.html"
  }
}
```

::: warning
需要特别注意的是，由于单击图标打开 `popup`，焦点离开又立即关闭，所以 `popup` 页面的生命周期一般很短，需要长时间运行的代码千万不要写在 `popup` 里面。

在权限上，它和 `background` 非常类似，它们之间最大的不同是生命周期的不同，`popup` 中可以直接通过 `chrome.extension.getBackgroundPage()`获取 `background`的 `window` 对象。
:::

> `inject-script`：指的是通过 `DOM` 操作的方式向页面注入的一种 `JS`。为什么要把这种 `JS` 单独拿出来讨论呢？又或者说为什么需要通过这种方式注入 `JS` 呢？
> 这是因为 `c`ontent-script`有一个很大的“缺陷”，也就是无法访问页面中的`JS`，虽然它可以操作 `DOM`，但是 `DOM`却不能调用它，也就是无法在`DOM`中通过绑定事件的方式调用`content-script`中的代码（包括直接写`onclick`和`addEventListener`两种方式都不行），但是，“在页面上添加一个按钮并调用插件的扩展`API`”是一个很常见的需求，那该怎么办呢？其实这就是本小节要讲的。

在 `content-script` 中通过 `DOM` 方式向页面注入 `inject-script` 代码示例：

```javascript
// 向页面注入JS
function injectCustomJs(jsPath) {
  jsPath = jsPath || "js/inject.js";
  var temp = document.createElement("script");
  temp.setAttribute("type", "text/javascript"); // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
  temp.src = chrome.extension.getURL(jsPath);
  temp.onload = function () {
    // 放在页面不好看，执行完后移除掉
    this.parentNode.removeChild(this);
  };
  document.head.appendChild(temp);
}
```

在 `web` 中直接访问插件中的资源的话必须显示声明才行，配置文件中增加如下

```json
{
  // 普通页面能够直接访问的插件资源列表，如果不设置是无法直接访问的
  "web_accessible_resources": ["js/inject.js"]
}
```

### 展现形式

> `tab browserAction`：通过配置 `browser_action` 可以在浏览器的右上角增加一个图标，一个 `browser_action` 可以拥有一个图标，一个 `tooltip`，一个 `badge` 和一个 `popup`。

- `icon`(图标)
  `browser_action`图标推荐使用宽高都为 `19 像素`的图片，更大的图标会被缩小，格式随意，一般推荐 `png`，可以通过 `manifest` 中 `default_icon` 字段配置，也可以调用 `setIcon()`方法。
- `tooltip`
  修改 `browser_action` 的 `manifest` 中 `default_title` 字段，或者调用 `setTitle()`方法。

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/tooltip.png)

- `badge`
  所谓 `badge`就是在图标上显示一些文本，可以用来更新一些小的扩展状态提示信息。因为 `badge` 空间有限，所以只支持 4 个以下的字符（英文 4 个，中文 2 个）。`badge` 无法通过配置文件来指定，必须通过代码实现，设置 `badge` 文字和颜色可以分别使用 `setBadgeText()`和 `setBadgeBackgroundColor()`。

```javascript
chrome.browserAction.setBadgeText({ text: "new" });
chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
```

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/badge.png)

> `pageAction`：所谓 pageAction，指的是只有当某些特定页面打开才显示的图标，它和 `browserAction` 最大的区别是一个始终都显示，一个只在特定情况才显示。

> `右键菜单`：通过开发 `Chrome` 插件可以自定义浏览器的右键菜单，主要是通过 `chrome.contextMenusAPI` 实现，右键菜单可以出现在不同的上下文，比如普通页面、选中的文字、图片、链接，等等，如果有同一个插件里面定义了多个菜单，`Chrome`会自动组合放到以插件名字命名的二级菜单里，如下：

```javascript
// manifest.json
{"permissions": ["contextMenus"]}

// background.js
chrome.contextMenus.create({
 title: "测试右键菜单",
 onclick: function(){alert('您点击了右键菜单！');}
});
```

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/click.png)

> `override`：使用 `override` 页可以将 `Chrome` 默认的一些特定页面替换掉，改为使用扩展提供的页面。
> 扩展可以替代如下页面：

- 历史记录：从工具菜单上点击历史记录时访问的页面，或者从地址栏直接输入 `chrome://history`
- 新标签页：当创建新标签的时候访问的页面，或者从地址栏直接输入 `c`hrome://newtab`
- 书签：浏览器的书签，或者直接输入 `chrome://bookmarks`
  ::: warning
- 一个扩展只能替代一个页面；
- 不能替代隐身窗口的新标签页；
- 网页必须设置 `title`，否则用户可能会看到网页的 `URL`，造成困扰；
  :::

```json
"chrome_url_overrides":
{
 "newtab": "newtab.html",
 "history": "history.html",
 "bookmarks": "bookmarks.html"
}
```

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/override.png)

> `devtools`：`Chrome` 允许插件在开发者工具(`devtools`)上动手脚，主要表现在：

- 自定义一个和多个和 `Elements、Console、Sources` 等同级别的面板；
- 自定义侧边栏(`sidebar`)，目前只能自定义 `Elements` 面板的侧边栏；
- `devtools` 扩展介绍
  ![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/vue.png)
  ![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/devtools.png)

- 每打开一个开发者工具窗口，都会创建 `devtools` 页面的实例，`F12` 窗口关闭，页面也随着关闭，所以 `devtools` 页面的生命周期和 `devtools` 窗口是一致的。`devtools` 页面可以访问一组特有的 `DevTools API` 以及有限的扩展 `API`，这组特有的 `DevTools API` 只有 `devtools` 页面才可以访问，`background` 都无权访问，这些 `API` 包括：
- `chrome.devtools.panels`：面板相关；
- `chrome.devtools.inspectedWindow`：获取被审查窗口的有关信息；
- `chrome.devtools.network`：获取有关网络请求的信息；
  `options` 页，就是插件的设置页面，有 2 个入口，一个是右键图标有一个“选项”菜单，还有一个在插件管理页面：
  > 大部分扩展 `API` 都无法直接被 `DevTools` 页面调用，但它可以像 `content-script` 一样直接调用 `chrome.extension` 和 `chrome.runtimeAPI`，同时它也可以像 `content-script` 一样使用 `Message` 交互的方式与 `background` 页面进行通信。

> `option`：

```json
{
  "options_ui": {
    "page": "options.html", // 添加一些默认的样式，推荐使用
    "chrome_style": true
  }
}
```

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/option.png)

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/option1.png)

> `omnibox`： 是向用户提供搜索建议的一种方式。

> `omnibox` 应用程序界面允许向 `Google Chrome` 的地址栏注册一个关键字，地址栏也叫 `omnibox`。
> 当用户输入你的扩展关键字，用户开始与你的扩展交互。每个击键都会发送给你的扩展，扩展提供建议作为相应的响应。
> 建议可以被格式化多种方式。当用户接受建议，你的扩展被通知可以执行动作。

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/go.gif)

> 配置字段：

```json
{
  // 向地址栏注册一个关键字以提供搜索建议，只能设置一个关键字
  "omnibox": { "keyword": "go" }
}
```

在 `background.js` 注册监听事件：

```javascript
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  console.log("inputChanged: " + text);
  if (!text) return;
  if (text == "微博") {
    suggest([
      { content: "新浪" + text, description: "新浪" + text },
      { content: "腾讯" + text, description: "腾讯" + text },
      { content: "搜狐" + text, description: "搜索" + text },
    ]);
  } else {
    suggest([
      { content: "百度搜索 " + text, description: "百度搜索 " + text },
      { content: "谷歌搜索 " + text, description: "谷歌搜索 " + text },
    ]);
  }
});

// 当用户接收关键字建议时触发
chrome.omnibox.onInputEntered.addListener((text) => {
  console.log("inputEntered: " + text);
  if (!text) return;
  var href = "";
  if (text.endsWith("微博"))
    href =
      "http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word=" + text;
  else if (text.startsWith("百度搜索"))
    href =
      "https://www.baidu.com/s?ie=UTF-8&wd=" + text.replace("百度搜索 ", "");
  else if (text.startsWith("谷歌搜索"))
    href =
      "https://www.google.com.tw/search?q=" + text.replace("谷歌搜索 ", "");
  else href = "https://www.baidu.com/s?ie=UTF-8&wd=" + text;
  openUrlCurrentTab(href);
});
// 获取当前选项卡ID
function getCurrentTabId(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (callback) callback(tabs.length ? tabs[0].id : null);
  });
}

// 当前标签打开某个链接
function openUrlCurrentTab(url) {
  getCurrentTabId((tabId) => {
    chrome.tabs.update(tabId, { url: url });
  });
}
```

> `notification`：通知用户发生了一些重要的事情。桌面通知会显示在浏览器窗口之外。
> `Chrome` 提供了一个 `chrome.notificationsAPI` 以便插件推送桌面通知，暂未找到 `chrome.notifications` 和 `HTML5` 自带的 `Notification` 的显著区别及优势。

在后台 `JS` 中，无论是使用 `chrome.notifications` 还是 `Notification` 都不需要申请权限（`HTML5` 方式需要申请权限），直接使用即可。

## 五类 JS 文件区别

| js 类型         | 可访问的 API                                     | DOM 访问情况   | js 访问情况 | 跨域 | 调试方式                                                                                                              |
| --------------- | ------------------------------------------------ | -------------- | ----------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| content script  | 只能访问 extension、runtime 等部分 API           | ✔              | ×           | ×    | 打开 Console,如图切换![tiaoshi.png](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/tiaoshi.png)        |
| popup js        | 可访问绝大部分 API，除了 devtools 系列           | 不可以直接访问 | ×           | ✔    | popup 页面右键选择“审查弹出内容”                                                                                      |
| background js   | 可访问绝大部分 API，除了 devtools 系列           | 不可以直接访问 | ×           | ✔    | 插件管理页面点击背景页![background.png](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/background.png) |
| devtools js     | 只能访问 devtools、extension、runtime 等部分 API | ✔              | ✔           | ×    | 暂时没有找到有效的调试方法                                                                                            |
| injected script | 和普通 JS 无任何差别，不能访问任何扩展 API       | ✔              | ✔           | ×    | 直接普通的 F12 即可                                                                                                   |

---

## 消息通信

### 通信方式概览

| -               | injected-script                       | content-script                              | popup-js                                          | background-js                                     |
| --------------- | ------------------------------------- | ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| injected-script | --                                    | window.postMessage                          | --                                                | --                                                |
| content-script  | window.postMessage                    | --                                          | chrome.runtime.sendMessage chrome.runtime.connect | chrome.runtime.sendMessage chrome.runtime.connect |
| popup-js        | --                                    | chrome.tabs.sendMessage chrome.tabs.connect | --                                                | chrome.extension.getBackgroundPage()              |
| background-js   | --                                    | chrome.tabs.sendMessage chrome.tabs.connect | chrome.extension.getViews                         | --                                                |
| devtools-js     | chrome.devtools. inspectedWindow.eval | --                                          | chrome.runtime.sendMessage                        | chrome.runtime.sendMessage                        |

### popup&&background

- `popup` 访问 `background`
  > `popup` 可以直接调用 `background` 的 JS 方法，并且可以直接访问 `background` 的 DOM

```javascript
// background.js
function test() {
  alert("我是background！");
}

// popup.js
var bg = chrome.extension.getBackgroundPage();
bg.test(); // 访问bg的函数
alert(bg.document.body.innerHTML); // 访问bg的DOM
```

- `background` 访问 `popup`
  ::: warning
  前提是 `popup` 已经打开时
  :::

```javascript
var views = chrome.extension.getViews({ type: "popup" });
if (views.length > 0) {
  console.log(views[0].location.href);
}
```

### (popup/background)&&content-script

- `popup.js/background.js`

```javascript
function sendMessageToContentScript(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, message, function (response) {
      if (callback) callback(response);
    });
  });
}
sendMessageToContentScript(
  { cmd: "test", value: "你好，我是popup！" },
  function (response) {
    console.log("来自content的回复：" + response);
  }
);
```

- `content-script` 接收消息

```javascript
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // console.log(sender.tab ?"from a content script:" + sender.tab.url :"from the extension");
  if (request.cmd == "test") alert(request.value);
  sendResponse("我收到了你的消息！");
});
```

> 双方通信直接发送的都是 `JSON` 对象，不是 `JSON` 字符串，所以无需解析，很方便（当然也可以直接发送字符串）。

### content-script&&(background/popup)

- `content-script.js`

```javascript
chrome.runtime.sendMessage(
  { greeting: "你好，我是content-script，主动发消息给后台！" },
  function (response) {
    console.log("收到来自后台的回复：" + response);
  }
);
```

- `background.js/popup.js` 接收消息

```javascript
// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("收到来自content-script的消息：");
  console.log(request, sender, sendResponse);
  sendResponse("我是后台，我已收到你的消息：" + JSON.stringify(request));
});
```

::: warning

- `content_script` 向 `popup` 主动发消息的前提是 `popup` 必须打开！否则需要利用 `background` 作中转。
- 如果 `background` 和 `popup` 同时监听，那么它们都可以同时收到消息，但是只有一个可以 `sendResponse`，一个先发送了，那么另外一个再发送就无效。
  :::

### inject-script&&content-script

`content-script` 和页面内的脚本（`injected-script` 自然也属于页面内的脚本）之间唯一共享的东西就是页面的 DOM 元素，有 2 种方法可以实现二者通讯：

- 1.可以通过 `window.postMessage` 和 `window.addEventListener` 来实现二者消息通讯(推荐)
- `inject-script`:

```javascript
window.postMessage({ test: "Hello,Content" }, "*");
```

- `content-script`:

```javascript
window.addEventListener(
  "message",
  function (e) {
    console.log(e.data);
  },
  false
);
```

- 2.通过自定义 DOM 事件来实现
- `inject-script`:

```javascript
var customEvent = document.createEvent("Event");
customEvent.initEvent("myCustomEvent", true, true);
function fireCustomEvent(data) {
  hiddenDiv = document.getElementById("myCustomEventDiv");
  hiddenDiv.innerText = data;
  hiddenDiv.dispatchEvent(customEvent);
}
fireCustomEvent("Hello! I’m Injected");
```

- `content-script`:

```javascript
var hiddenDiv = document.getElementById("myCustomEventDiv");
if (!hiddenDiv) {
  hiddenDiv = document.createElement("div");
  hiddenDiv.style.display = "none";
  document.body.appendChild(hiddenDiv);
}
hiddenDiv.addEventListener("myCustomEvent", function () {
  var eventData = document.getElementById("myCustomEventDiv").innerText;
  console.log("收到自定义事件消息：" + eventData);
});
```

---

## 补充

### 动态注入 JS、CSS

> 虽然在 `background` 和 `popup` 中无法直接访问页面 DOM，但是可以通过 `chrome.tabs.executeScript` 来执行脚本，从而实现访问 web 页面的 DOM（注意，这种方式也不能直接访问页面 JS）。

`manifest.json` 配置 🌰：

```json
{
 "name": "动态注入JS/CSS",
 ...
 "permissions": [
  "tabs", "http://*/*", "https://*/*"
 ],
 ...
}
```

```javascript
// 动态执行JS代码
chrome.tabs.executeScript(tabId, {
  code: 'document.body.style.backgroundColor="red"',
});
// 动态执行JS文件
chrome.tabs.executeScript(tabId, { file: "some-script.js" });

// 动态执行CSS代码
chrome.tabs.insertCSS(tabId, { code: "xxx" });
// 动态执行CSS文件
chrome.tabs.insertCSS(tabId, { file: "some-style.css" });
```

### 获取当前窗口 ID

```javascript
chrome.windows.getCurrent(function (currentWindow) {
  console.log("当前窗口ID：" + currentWindow.id);
});
```

### 获取当前标签页 ID

```javascript
// 获取当前选项卡ID
function getCurrentTabId(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (callback) callback(tabs.length ? tabs[0].id : null);
  });
}
```

### 本地存储

本地存储建议用 `chrome.storage` 而不是普通的 `localStorage`，区别有好几点，最重要的 2 点区别是：

- `chrome.storage` 是针对插件全局的，即使你在 `background` 中保存的数据，在 `content-script` 也能获取到。
- `chrome.storage.sync` 可以跟随当前登录用户自动同步，这台电脑修改的设置会自动同步到其它电脑，很方便，如果没有登录或者未联网则先保存到本地，等登录了再同步至网络。

> 需要声明 `storage` 权限，有 `chrome.storage.sync` 和 `chrome.storage.local`2 种方式可供选择，使用示例 🌰 如下：

```javascript
// 读取数据，第一个参数是指定要读取的key以及设置默认值
chrome.storage.sync.get({ color: "red", age: 18 }, function (items) {
  console.log(items.color, items.age);
});
// 保存数据
chrome.storage.sync.set({ color: "blue" }, function () {
  console.log("保存成功！");
});
```

### webRequest

通过 `webRequest` 系列 API 可以对 HTTP 请求进行任性地修改、定制。
生命周期图：

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/webRequest.png)

```javascript
//manifest.json
{
 // 权限申请
 "permissions":
 [
  "webRequest", // web请求
  "webRequestBlocking", // 阻塞式web请求
  "storage", // 插件本地存储
  "http://*/*", // 可以通过executeScript或者insertCSS访问的网站
  "https://*/*" // 可以通过executeScript或者insertCSS访问的网站
 ],
}


// background.js
// 是否显示图片
var showImage;
chrome.storage.sync.get({showImage: true}, function(items) {
 showImage = items.showImage;
});
// web请求监听，最后一个参数表示阻塞式，需单独声明权限：webRequestBlocking
chrome.webRequest.onBeforeRequest.addListener(details => {
 // cancel 表示取消本次请求
 if(!showImage && details.type == 'image') return {cancel: true};
 // 简单的音视频检测
 // 大部分网站视频的type并不是media，且视频做了防下载处理，所以这里仅仅是为了演示效果，无实际意义
 if(details.type == 'media') {
  chrome.notifications.create(null, {
   type: 'basic',
   iconUrl: 'img/icon48.png',
   title: '检测到音视频',
   message: '音视频地址：' + details.url,
  });
 }
}, {urls: ["&lt;all_urls&gt;"]}, ["blocking"]);
```

示例 🌰：

```javascript
// 每次请求前触发，可以拿到 requestBody 数据，同时可以对本次请求作出干预修改
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log("onBeforeRequest", details);
  },
  { urls: ["&lt;all_urls&gt;"] },
  ["blocking", "extraHeaders", "requestBody"]
);

// 发送header之前触发，可以拿到请求headers，也可以添加、修改、删除headers
// 但使用有一定限制，一些特殊头部可能拿不到或者存在特殊情况，详见官网文档
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    console.log("onBeforeSendHeaders", details);
  },
  { urls: ["&lt;all_urls&gt;"] },
  ["blocking", "extraHeaders", "requestHeaders"]
);

// 开始响应触发，可以拿到服务端返回的headers
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    console.log("onResponseStarted", details);
  },
  { urls: ["&lt;all_urls&gt;"] },
  ["extraHeaders", "responseHeaders"]
);

// 请求完成触发，能拿到的数据和onResponseStarted一样，注意无法拿到responseBody
chrome.webRequest.onCompleted.addListener(
  (details) => {
    console.log("onCompleted", details);
  },
  { urls: ["&lt;all_urls&gt;"] },
  ["extraHeaders", "responseHeaders"]
);
```

上面示例中提到，使用 `webRequestAPI` 是无法拿到 `responseBody` 的，想要拿到的话只能采取一些变通方法，例如：

- 重写 `XmlHttpRequest` 和 `fetch`，增加自定义拦截事件，缺点是实现方式可能有点脏，重写不好的话可能影响正常页面。
- `devtools` 的 `chrome.devtools.network.onRequestFinishedAPI` 可以拿到返回的 body，缺点是必须打开开发者面板。
- 使用 `chrome.debugger.sendCommand` 发送 `Network.getResponseBody` 命令来获取 body 内容，缺点也很明显，会有一个恼人的提示。

> 具体的实现方式可以查看[https://stackoverflow.com/questions/18534771/chrome-extension-how-to-get-http-response-body](https://stackoverflow.com/questions/18534771/chrome-extension-how-to-get-http-response-body)

### 国际化

插件根目录新建一个名为`locales` 的文件夹，再在下面新建一些语言的文件夹，如 `en、zh_CN、zh_TW`，然后再在每个文件夹放入一个 `messages.json`，同时必须在清单文件中设置 `default_locale`。

- `\locales\en\messages.json`：

```json
{
  "pluginDesc": { "message": "A chrome extension demo" },
  "helloWorld": { "message": "Hello World!" }
}
```

- `\locales\zh_CN\messages.json`:

```json
{
  "pluginDesc": { "message": "一个Chrome插件demo" },
  "helloWorld": { "message": "你好，世界！" }
}
```

- 在 `manifest.json` 和 CSS 文件中通过**MSG_messagename**引入，如：

```json
{
  "description": "__MSG_pluginDesc__",
  // 默认语言
  "default_locale": "zh_CN"
}
```

- 在 JS 中则直接 `chrome.i18n.getMessage("helloWorld")`。
- 测试时，通过给 chrome 建立一个不同的快捷方式 `chrome.exe --lang=en` 来切换语言

![](https://cdn.jsdelivr.net/gh/lp-Imagine/lp-Imagine@main/images/i18n.png)

## 常见的 API

所有的 `Chrome API` 都是以 `chrome` 对象开头，🌰 如：`chrome.tabs`

- `bookmarks`操纵书签的 API
- `browserAction` 获取扩展图标、标题、文字、弹出页等
- `browsingData`控制浏览器的浏览数据，从本地文件
- `commands` 给扩展添加快捷键
- `contextMenus` 添加选项到右键弹出菜单
- `cookies`控制 `cookies`
- `desktopCapture` 捕获屏幕、个人窗口或标签内容
- `downloads` 下载控制
- `events` 事件相关 API
- `extension` 获取扩展的各部分，也能与各部分交换信息
- `extensionTypes` 扩展的类型声明
- `gcm` 启用 google 云消息服务，收发消息
- `history` 历史记录控制
- `i18n`多语言国际化支持
- `idle` 取得机器闲置状态
- `management` 管理扩展与应用
- `notifications` 通知控制
- `pageAction` 具体的页面下控制扩展图标、标题、文字、弹出页等相关内容
- `permissions` 获取拥有的权限
- `power` 请求系统常亮
- `runtime` 获取运行时相关信息，包括后台页、`manifest` 等等
- `sessions` 查询或恢复浏览会话
- `storage` 存储相关
- `tabs` 与标签页交互
- `vpnProvider` 实现 `vpn` 客户端需要使用的东西
- `webRequest` 拦截、修改、阻塞请求
- `windows` 创建、修改、重排窗口

## 踩坑

### 查看已安装插件路径

查看本地已安装的插件源码路径 `C:\Users\用户名\AppData\Local\Google\Chrome\User Data\Default\Extensions`，每一个插件被放在以插件 ID 为名的文件夹里面，想要学习某个插件的某个功能是如何实现的，看人家的源码是最好的方法了。

> `Mac` 系统插件本地缓存位于：`/Users/用户名/Library/Application Support/Google/Chrome/Default/Extensions` 文件夹

如何查看某个插件的 ID 进入 `chrome://extensions` ，然后勾选开发者模式即可看到了。

### background 的报错

很多时候你发现你的代码会莫名其妙的失效，找来找去又找不到原因，这时打开 `background` 的控制台才发现原来某个地方写错了导致代码没生效，这是由于 `background`报错的隐蔽性(需要主动打开对应的控制台才能看到错误)

### 如何让 popup 页面不关闭

在对 `popup` 页面审查元素的时候 `popup` 会被强制打开无法关闭，只有控制台关闭了才可以关闭 `popup`，原因很简单：如果 `popup` 关闭了控制台就没用了。这种方法在某些情况下很实用！

### 不支持内联 JavaScript 的执行

就是不支持将 js 直接写在 html 中，例如 🌰：

```html
<input id="btn" type="button" value="按钮" onclick="handleBtn()" />

// 报错 // Refused to execute inline event handler because it violates the
following Content Security Policy directive: "script-src 'self' blob:
filesystem: chrome-extension-resource:". Either the 'unsafe-inline' keyword, a
hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline
execution.
```

只能通过 js 绑定事件：

```javascript
$("#btn").on("click", function () {
  alert("测试");
});
```

另外，对于 A 标签，这样写 `href="javascript:;"`然后用 JS 绑定事件虽然控制台会报错，但是不受影响，当然强迫症患者受不了的话只能写成 `href="#"`了。

```html
<a href="javascript:;" id="get_res">请求</a>

// 报错 // Refused to execute JavaScript URL because it violates the following
Content Security Policy directive: "script-src 'self' blob: filesystem:
chrome-extension-resource:". Either the 'unsafe-inline' keyword, a hash
('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution.
```

### 注入 CSS

由于通过 `content_scripts` 注入的 CSS 优先级非常高，几乎仅次于浏览器默认样式，稍不注意可能就会影响一些网站的展示效果，所以尽量不要写一些影响全局的样式。

> 之所以强调这个，是因为这个带来的问题非常隐蔽，不太容易找到，可能你正在写某个网页，昨天样式还是好好的，怎么今天就突然不行了？然后你辛辛苦苦找来找去，找了半天才发现竟然是因为插件里面的一个样式影响的！

---

原文：[http://blog.haoji.me/chrome-plugin-develop.html#dong-tai-zhu-ru-huo-zhi-xing-JS](http://blog.haoji.me/chrome-plugin-develop.html#dong-tai-zhu-ru-huo-zhi-xing-JS)

## 相关资料：

::: cardList 2

```yaml
- name: 360安全浏览器开发文档（推荐）
  desc: ""
  bgColor: "#F0DFB1"
  textColor: "#242A38"
  link: http://open.se.360.cn/open/extension_dev/overview.html
- name: 360极速浏览器Chrome扩展开发文档
  desc: ""
  link: http://open.chrome.360.cn/extension_dev/overview.html
  bgColor: "#DFEEE7"
  textColor: "#2A3344"
- name: Chrome扩展开发极客
  desc: ""
  link: https://www.cnblogs.com/champagne/p/
  bgColor: "#2bc2d6"
  textColor: "#2A3344"
- name: chrome扩展开发官方文档（需要翻墙
  desc: ""
  link: https://developer.chrome.com/extensions
  bgColor: "#2bd64d"
  textColor: "#2A3344"
- name: chrome API支持（需要翻墙）
  desc: ""
  link: https://developer.chrome.com/extensions/api_index
  bgColor: "#b8b823"
  textColor: "#2A3344"
```

:::
