# Eason Chan Music Cup

滚动式演唱会档案，按 Get A Life、Moving On Stage、DUO、Eason’s LIFE 和 FEAR and DREAMS 五章浏览。

## 公开网站与开源代码

项目源代码按 [MIT License](LICENSE) 开源；演唱会视频、视频截帧、唱片封面、歌词及第三方标识不适用此代码许可证。访客访问公开网址即可浏览网站，不需要注册账号。

网站可用 GitHub Pages 部署：推送到 `main` 后，`.github/workflows/pages.yml` 会构建并发布 `dist`。首次部署需在仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。项目网址通常是 `https://<GitHub 用户名>.github.io/<仓库名>/`。源码中的图片、歌词数据和站内链接支持项目子路径，不依赖原电脑的 `127.0.0.1` 地址。`127.0.0.1` 仅供本机开发服务器运行期间使用。

演唱会原片没有放进 Git 仓库或 GitHub Pages。GitHub Pages 不适合直接托管这些大型影片。若要在公开网站播放逐曲影像，需先确认有公开传播许可，再把 `gal-concert.mp4`、`mos-concert.mp4`、`duo-concert.mp4`、`fnds-concert.mp4` 上传到支持 MP4 Range 请求的媒体主机的 `media/` 目录，并在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 添加 `MEDIA_BASE_URL`，值为媒体主机根网址，例如 `https://media.example.com/`。此变量未设置时，公开版会标示影像暂未提供；本机开发版仍读取 D 盘原片。媒体主机应允许公开读取、跨域播放及 `Range` 请求。

每章开头有一段约 11 秒的原创管弦氛围序曲。访客点击“播放序曲 · 进入本章”后才播放，结束时进入章节；也可直接跳过。五段音乐由 `scripts/generate-intros.py` 生成，没有采样第三方录音。章节主图、整场影片海报和逐曲影片海报均使用对应现场专辑封面；封面来自 Apple Music，不属于源码的 MIT 许可证。

键盘快捷键：在档案主页按 **← / →** 切换上一个／下一个巡演章节；打开歌曲页后，同样按 **← / →** 切换同一章内的前后曲，按 **Esc** 返回档案。快捷键不会覆盖文字输入、视频进度条或浏览器组合键。

## 本地运行

Windows 可直接双击 `Open-Website.cmd`：脚本会启动本机网站并在默认浏览器打开，重新开机后也可再次双击。首次运行会安装依赖；本地影片路径仍读取不提交到 Git 的 `.env.local`。

```powershell
npm install
npm run dev
```

`npm run build` 生成网页，`npm run preview` 预览构建版本。

## 单曲歌词页

五章的 161 条曲目各有可分享的网址，例如 `?song=duo-d2-t3#duo`。点击曲目可打开单曲阅读页，支持前后曲切换、浏览器前进后退及键盘左右方向键。歌词按原始空行分段，以每章的色彩和舞台图像排版。

歌词数据放在 `public/lyrics/lyrics.json`。在项目持有人确认拥有公开展示许可后，使用 lyrics-organizer 技能从 MusicBrainz 和 LRCLIB 严格匹配，已为 75 个不同歌名导入文本，覆盖 161 个曲目入口中的 99 个。歌词来源是相应的录音室版本；现场演出可能改词、换段或省略，因此每页均标注版本差异，网页没有把录音室 LRC 时间码当作现场字幕。其余 26 个入口需要核对多个版本，36 个入口尚无安全匹配的文本；逐曲状态见 [`audit/lyrics.json`](audit/lyrics.json)。公开接口可读取不等于自动取得再发布权，新增文本也应先确认使用许可。

原始歌词和技能导出的网页 JSON 保存在用户的私人目录；仓库只保存经授权用于本网站展示的 `public/lyrics/lyrics.json`，以及不含歌词正文的核对报告。`scripts/publish-lyrics.py` 可将技能的目录、导出 JSON、处理报告与本网站 161 个歌曲编号对应；先运行默认预演，确认计数后再加 `--write`。网页当前以纯文本分段展示，不按 LRC 时间轴与现场影像逐句同步。

```json
{
  "bySong": {
    "duo-d2-t3": {
      "text": "第一段第一行\n第一段第二行\n\n第二段第一行",
      "sourceLabel": "经授权的歌词资料",
      "sourceUrl": "https://example.com/source",
      "editionNote": "如与现场版本有差异，在此注明"
    }
  },
  "byTitle": {}
}
```

`bySong` 优先，适合区分重唱、串烧及不同现场版本；`byTitle` 可供确实相同的歌词在多章复用。`sourceUrl` 和 `editionNote` 可不填。没有文本的曲目会显示待补来源提示。

若有成批的 LRC/TXT 文件，可以先运行 `node scripts/import-lyrics.mjs 'D:\歌词目录'` 查看匹配报告，确认后加上 `--write` 写入。文件名可以是单曲编号（如 `duo-d2-t3.lrc`）或与曲目表完全相同的歌名；多章重名歌曲需用单曲编号，以免误配。脚本不会解读 QQ 音乐专用的 `.qrc` 缓存。

## 四部演唱会影片与逐曲片段

Get A Life、Moving On Stage、DUO Disc 1 和 FEAR and DREAMS 的影片均从用户提供的本地文件按需读取，避免复制大型影片。把 `.env.example` 复制为 `.env.local`，在其中设置四条本机影片路径；`.env.local` 已被 Git 忽略。也可在启动前设置环境变量：

```powershell
$env:GAL_VIDEO_PATH='D:\新的目录\Get A Life.mp4'
$env:FNDS_VIDEO_PATH='D:\新的目录\演唱会.mp4'
$env:MOS_VIDEO_PATH='D:\新的目录\Moving On Stage.mp4'
$env:DUO_VIDEO_PATH='D:\新的目录\DUO Disc 1.mp4'
npm run dev
```

Vite 的开发和预览服务器分别通过 `/media/gal-concert.mp4`、`/media/fnds-concert.mp4`、`/media/mos-concert.mp4` 和 `/media/duo-concert.mp4` 提供支持 Range 请求的视频流。各章可播放整部原片；歌曲页依据 `src/video-cues.js` 的起止时间在同一原片内播放对应段落，到下一首的起点自动停止。这是无重复文件的时间切片，不会输出 130 个独立 MP4。原片只在本机读取，公开传播权须另行确认。

Get A Life 的 38 首、MOS 的 33 首和 FNDS 的 31 首均有对应影片时间段；DUO Disc 1 覆盖前 28 首，其余 10 首显示影像缺口，共 130 个可播放片段。Get A Life 的 38 段官方试听均在用户提供的影片中定位，见 `audit/gal.json`。MOS 和 DUO 的切点参考公开完整影片章节，并以官方现场专辑试听片段核对：MOS 数码版 27 首均匹配，DUO Disc 1 的 28 首中有 26 首高度匹配；《破曉》未取得可靠的音轨匹配，详见 `audit/README.md`。FNDS 的官方专辑音轨从原片第 77.805 秒起顺序接合，因此 31 首的起止点按官方发行时长累计计算，31 段官方试听均落在对应切片内。逐曲边界是本站针对四部影片的编辑切点，不能替代发行方正式章节标记；原片与唱片可能包含不同长度的串场和掌声。核对数据见 `audit/`。

若将静态构建文件发布到其他服务器，需将获公开传播许可的影片置于同名 `/media/` 路径，并配置 MP4 的 Range 请求；单独搬走 `dist` 不会携带 D 盘原片。

五章曲目是对应现场唱片的发行曲序，不等同于每晚演出歌单。MOS 采用 3CD 的 33 首实体发行曲序；DUO 采用 3CD 的 38 首实体发行曲序，包含部分数字版本未列出的《單車》《明年今日》。

曲序来源：[MOS 3CD](https://www.yesasia.com/global/easons-moving-on-stage-1-3cd/1005163950-0-0-0-en/info.html)、[DUO 3CD](https://www.yesasia.com/us/duo-eason-chan-concert-live-2010-3cd/1022885926-0-0-0-en/info.html)、[FNDS 官方 2CD](https://www.umusic.com.tw/album.php?q=N2j0Q226M-Q0E9AE9E9AE-)。本地影片切点的参考章节：[MOS 完整影片](https://www.youtube.com/watch?v=oRJBlyV7AH0)、[DUO 完整影片](https://www.youtube.com/watch?v=xL2rN2diFos)。
