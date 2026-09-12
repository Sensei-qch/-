# 🛏️ 躺平发育 - 网页版

一个用纯 HTML/CSS/JS + Node.js 开发的网页版塔防养成游戏。玩家躺平赚钱、建造防御塔、升级门和床，抵御一波又一波猛鬼的进攻。

## 🎮 游戏玩法

- **WASD / 方向键** — 移动角色
- **E 键** — 靠近床时躺平（开始产金币）/ 起床
- **B 键** — 打开建造菜单
- **U 键** — 打开升级面板（门、床、选中的建筑）
- **鼠标点击** — 放置建筑 / 选中已有建筑
- **P / 空格** — 暂停游戏
- **Esc** — 关闭菜单

### 核心循环
1. 走到床边按 `E` 躺平，每秒自动产金币
2. 用金币建造炮塔（自动攻击猛鬼）、矿机（额外产金）、维修器（修门）
3. 升级门（增加血量）和床（增加产金速度）
4. 抵御每波猛鬼，坚持越久分数越高

## 📁 项目结构

```
tangping-game/
├── public/              # 前端静态文件
│   ├── index.html       # 游戏页面
│   ├── style.css        # 样式
│   └── game.js          # 游戏核心逻辑
├── server.js            # 后端服务（Express + Socket.IO + Turso）
├── package.json         # 项目依赖
├── .env.example         # 环境变量模板
└── README.md            # 本文件
```

## 🚀 本地运行

### 前置要求
- Node.js >= 18（[下载地址](https://nodejs.org/)）

### 步骤

```bash
# 1. 进入项目目录
cd tangping-game

# 2. 安装依赖
npm install

# 3. （可选）复制环境变量文件，配置 Turso 数据库
cp .env.example .env
# 编辑 .env 填入你的 Turso 配置（不配置也能玩，只是没有排行榜）

# 4. 启动服务器
npm start
```

启动后浏览器访问 **http://localhost:3000** 即可开始游戏。

开发模式（代码修改自动重启）：
```bash
npm run dev
```

---

## 🗄️ Turso 数据库配置教程

Turso 是基于 SQLite 的边缘数据库，**免费额度非常慷慨**（9GB 存储 + 10亿次读取/月），适合个人项目。

### 第一步：注册账号

1. 打开 [https://turso.tech](https://turso.tech)
2. 点击 **Sign Up**，用 GitHub 账号登录最方便

### 第二步：安装 Turso CLI

**Windows（PowerShell）：**
```powershell
irm "https://github.com/tursodatabase/turso-cli/releases/latest/download/turso-x86_64-pc-windows-msvc.zip" -OutFile turso.zip
Expand-Archive turso.zip -DestinationPath .
# 把解压出的 turso.exe 放到 PATH 目录下
```

**Mac：**
```bash
brew install tursodatabase/tap/turso
```

**Linux：**
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

### 第三步：登录并创建数据库

```bash
# 登录（会打开浏览器授权）
turso auth login

# 创建数据库（名字自己取，比如 tangping）
turso db create tangping

# 查看数据库信息（记下 URL，格式是 libsql://xxx.turso.io）
turso db show tangping
```

### 第四步：创建认证令牌

```bash
# 生成一个只读+读写的令牌（用于服务器连接）
turso db tokens create tangping

# 会输出一长串字符串，复制保存好（只显示一次！）
```

### 第五步：配置到项目

编辑项目根目录下的 `.env` 文件：

```env
TURSO_DATABASE_URL=libsql://tangping-你的用户名.turso.io
TURSO_AUTH_TOKEN=刚才复制的那串令牌
```

> 数据库 URL 可以用 `turso db show tangping` 命令查看。

### 第六步：验证

重启服务器 `npm start`，如果看到：
```
✅ Turso 数据库连接成功
```
就说明配置成功了！游戏结束后会自动保存记录，排行榜也会有数据。

> 表会在服务器启动时自动创建，不需要手动建表。

---

## ☁️ 免费服务器部署教程（Render）

[Render](https://render.com) 提供免费的 Web Service 托管，支持 Node.js，适合部署这个游戏。

> 免费版实例在 15 分钟无请求后会休眠，再次访问需要等约 30 秒启动。个人使用完全够用。

### 准备工作：把代码上传到 GitHub

1. 在 [GitHub](https://github.com) 新建一个仓库（比如叫 `tangping-game`）
2. 把项目代码推上去：

```bash
cd tangping-game
git init
git add .
git commit -m "躺平发育初始版本"
git branch -M main
git remote add origin https://github.com/你的用户名/tangping-game.git
git push -u origin main
```

### 第一步：注册 Render

1. 打开 [https://render.com](https://render.com)
2. 点击 **Get Started**，用 GitHub 账号登录
3. 授权 Render 访问你的 GitHub 仓库

### 第二步：创建 Web Service

1. 登录后点击右上角 **+ New** → **Web Service**
2. 选择你刚才上传的 `tangping-game` 仓库，点击 **Connect**

### 第三步：配置服务

填写以下信息：

| 配置项 | 填写内容 |
|---|---|
| **Name** | `tangping-game`（自己取，会成为子域名） |
| **Region** | 选 Singapore（新加坡，离国内近） |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | 选 **Free**（免费） |

### 第四步：配置环境变量（Turso）

在同一页面下方找到 **Environment Variables**，点击 **Add Environment Variable**：

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://你的数据库.turso.io` |
| `TURSO_AUTH_TOKEN` | 你的 Turso 令牌 |

> 如果暂时不想配数据库，可以跳过这步，游戏仍能正常运行（单机模式）。

### 第五步：部署

点击页面底部的 **Create Web Service** 按钮。

Render 会自动拉取代码、安装依赖、启动服务。部署过程大约 2-3 分钟，日志面板会实时显示进度。

看到日志里出现：
```
🎮 躺平发育服务器已启动
   本地访问: http://localhost:10000
```
就说明部署成功了！

### 第六步：访问游戏

部署成功后，Render 会给你一个域名，格式是：
```
https://tangping-game.onrender.com
```

在浏览器打开这个地址就能玩了！把链接发给朋友，大家都能一起玩（排行榜是共享的）。

---

## ☁️ 方案二：Railway 部署（推荐联机用，不休眠）

[Railway](https://railway.app) 是比 Render 更稳定的选择，**不会休眠**，WebSocket 长连接更可靠，特别适合联机游戏。新用户送 $5 免费额度（约可用 1-2 个月），之后每月仍有 $5 免费额度（需绑定信用卡，不超支不扣费）。

### 对比：Render vs Railway

| 对比项 | Render 免费版 | Railway |
|---|---|---|
| 价格 | 完全免费 | 新用户送 $5，之后每月 $5 额度 |
| 休眠 | 15 分钟无访问休眠 | **不会休眠** |
| WebSocket | 支持，但休眠会断 | **稳定支持** |
| 联机体验 | 需配 UptimeRobot 防休眠 | 开箱即用 |
| 部署难度 | 简单 | 简单 |
| 适合场景 | 单机/偶尔玩 | **联机游戏/长期运行** |

### 第一步：注册 Railway

1. 打开 [https://railway.app](https://railway.app)
2. 点击 **Start a New Project** 或 **Login**
3. 选择 **Continue with GitHub**，用 GitHub 账号登录
4. 授权 Railway 访问你的 GitHub 仓库

### 第二步：从 GitHub 部署

1. 登录后，点击 **New Project**（或首页的 **Deploy from GitHub repo**）
2. 搜索并选择你的 `tangping-game` 仓库
3. Railway 会自动检测到这是一个 Node.js 项目

### 第三步：配置项目

Railway 会自动填充大部分配置，你只需要确认/修改：

| 配置项 | 值 |
|---|---|
| **Root Directory** | `/`（根目录） |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Node Version** | 18 或更高 |

> 如果 Railway 没有自动识别，在项目的 **Settings** → **Service** 里手动填写。

### 第四步：配置环境变量（Turso，可选）

1. 进入项目 → 点击 **Variables** 标签
2. 点击 **New Variable**，依次添加：

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://你的数据库.turso.io` |
| `TURSO_AUTH_TOKEN` | 你的 Turso 令牌 |
| `PORT` | `3000`（Railway 会自动注入，一般不用手动加） |

> 不配数据库也能玩，只是没有排行榜功能。

### 第五步：部署

1. 点击 **Deploy** 按钮（或推送代码到 GitHub 会自动触发部署）
2. 等待 1-2 分钟，日志面板显示 `🎮 躺平发育服务器已启动` 即成功

### 第六步：生成访问域名

Railway 默认不会自动生成公网域名，需要手动开启：

1. 进入项目 → **Settings** → **Networking**
2. 点击 **Generate Domain**（生成域名）
3. 会得到一个类似 `https://tangping-game-production.up.railway.app` 的地址
4. 也可以点 **Custom Domain** 绑定自己的域名（可选）

### 第七步：访问游戏

浏览器打开生成的域名，就能玩了！把链接发给朋友，联机房间号互通。

### 费用说明

- Railway 按实际使用量计费，一个这个规模的小游戏约 **$2-3/月**
- 新用户赠送 $5 额度，约可用 1-2 个月
- 之后每月有 $5 免费额度（需绑定信用卡，只要用量不超过 $5 就不会扣费）
- 想省钱可以在不玩的时候到 **Settings** → **Service** 里把服务停掉，用的时候再开

---

## 🔧 其他免费部署选项

| 平台 | 免费额度 | 适合场景 |
|---|---|---|
| **Railway** | 新用户送 $5 + 每月 $5 额度，不休眠 | **联机游戏首选**，稳定 |
| **Render** | 750小时/月，休眠后冷启动 | 单机/偶尔玩，配置简单 |
| **Fly.io** | 3个共享CPU实例免费 | 需要信用卡验证 |
| **Vercel** | 静态托管免费，但不支持长连接 WebSocket | 只适合前端静态部分 |
| **Glitch** | 项目5分钟无访问休眠 | 适合快速原型 |

> 注意：因为游戏用了 Socket.IO（WebSocket），Vercel 这类 Serverless 平台不适合，需要选支持长连接的平台（Render/Railway/Fly）。

---

## 👥 联机合作模式

游戏支持最多 4 人联机合作防守。采用**房主权威架构**：房主的浏览器运行完整游戏逻辑，每 80ms 广播一次游戏快照，其他玩家接收快照并渲染，同时把自己的按键和动作发给房主。

### 联机玩法

1. 开始界面输入名字，点击 **联机合作**
2. **创建房间**：输入自定义房间号或留空自动生成，点击创建
3. 把房间号发给朋友，朋友选 **加入房间** 输入房间号
4. 所有人点 **准备**，房主点 **开始游戏**
5. 游戏中：
   - 多人可以**同时躺平**，产金速度叠加（人多产金快）
   - 只有**房主**可以建造和升级（避免冲突），客户端可以躺平和移动
   - 猛鬼数量随人数增加，合作更有挑战
   - 右上角显示所有玩家状态（💤躺平 / 🏃移动）

### 联机对服务器的要求

联机模式使用 **WebSocket 长连接**，对服务器有特殊要求：

| 要求 | 说明 |
|---|---|
| 支持 WebSocket | 必须是长连接服务器，不能用 Serverless（Vercel/Netlify 函数不行） |
| 持续运行 | 免费版休眠会导致连接断开，需要防休眠或可接受冷启动 |
| 带宽 | 快照每 80ms 广播一次，4 人房间约 50-100KB/s，免费额度够用 |

### 推荐：Render 免费版（最省心）

Render 免费 Web Service 原生支持 WebSocket，部署步骤和上面单机版完全一样，**不需要额外配置**。

**唯一注意事项**：免费版 15 分钟无 HTTP 请求会休眠，休眠后 WebSocket 连接会断。解决方法：

1. **UptimeRobot 防休眠**（推荐）：
   - 去 [uptimerobot.com](https://uptimerobot.com) 免费注册
   - 添加 Monitor：类型选 HTTP(s)，URL 填你的 Render 地址 `https://你的项目.onrender.com/api/health`
   - 监控间隔选 5 分钟
   - 这样每 5 分钟 ping 一次，服务器永远不会休眠

2. **可接受冷启动**：如果朋友不多、不常玩，可以不管休眠，打开页面等 30 秒唤醒后再创建房间即可。

### 备选：Railway（更稳定）

[Railway](https://railway.app) 每月有 $5 免费额度，一个小项目约 $2-3/月，**不会休眠**，WebSocket 连接更稳定。

部署步骤：
1. 用 GitHub 登录 Railway
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择你的仓库
4. Railway 自动检测 Node.js，Build Command 填 `npm install`，Start Command 填 `npm start`
5. 在 **Variables** 里加 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`（可选）
6. 点击 **Deploy**，等 1 分钟即可

### 联机常见问题

**Q: 为什么只有房主能建造？**
A: 为了避免多人同时操作导致状态冲突。房主建造后通过快照同步给所有人，大家都能看到和享受效果。客户端可以自由移动、躺平产金。

**Q: 房主掉线了怎么办？**
A: 服务器会自动把房主转让给房间里第一个人，但当前游戏局会结束，需要重新开一局。建议网络好的人当房主。

**Q: 延迟高怎么办？**
A: 房主权威架构下，客户端的移动有轻微延迟（约 80-150ms），属于正常现象。建议房主和玩家在同一地区，Render 选 Singapore 节点。

**Q: 最多支持几人？**
A: 代码限制 4 人。想改的话编辑 `public/game.js` 里的 `CONFIG.MAX_PLAYERS`。

---

## ❓ 常见问题

**Q: 不配置 Turso 数据库能玩吗？**
A: 能。游戏核心逻辑完全在前端运行，不配置数据库只是没有排行榜和历史记录功能，单机和联机都能正常玩。

**Q: 联机需要额外付费吗？**
A: 不需要。Render 免费版 + UptimeRobot 防休眠就够 4 人联机玩了。Turso 免费额度也完全够用。

**Q: 怎么调整游戏难度？**
A: 编辑 `public/game.js` 顶部的配置对象：
- `GHOST.baseHp` / `GHOST.hpPerWave` — 猛鬼血量
- `GHOST.baseDamage` — 猛鬼攻击力
- `CONFIG.WAVE_INTERVAL` — 波次间隔（毫秒）
- `BED.baseIncome` — 初始产金速度

**Q: 怎么加新建筑？**
A: 在 `public/game.js` 的 `BUILDINGS` 对象里添加新类型，然后在 `index.html` 的建造菜单里加对应的 `.build-item` 即可。

**Q: Render 免费版休眠了怎么办？**
A: 正常现象，访问后等 30 秒左右会自动唤醒。可以用 [UptimeRobot](https://uptimerobot.com) 免费版每 5 分钟 ping 一次你的网站，防止休眠。

---

## 📝 技术栈

- **前端**：原生 HTML5 Canvas + CSS3 + JavaScript（无框架，零构建）
- **后端**：Node.js + Express + Socket.IO（WebSocket 实时通信）
- **联机架构**：房主权威（Host Authority），80ms 快照同步
- **数据库**：Turso（SQLite 兼容，边缘部署）
- **部署**：Render / Railway（免费层，支持 WebSocket 长连接）

## 📄 License

MIT - 随便用，随便改。
