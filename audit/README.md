# 逐曲影像切点核对

`src/video-cues.js` 是网页采用的播放范围。以下三个 JSON 文件记录本地原片与 Apple Music 官方现场专辑 30 秒试听片段的音轨相关性定位结果，不包含试听音频或完整影片。

- `fnds.json`：31 首全部定位。官方专辑的歌曲时长与影片音轨按 **77.805 秒开场片段**顺序接合；试听在各曲中选取的位置并不相同，因此 FNDS 的播放起点由官方歌曲时长累计计算。最后一首在专辑音轨结束处停止，片尾继续保留在整场影片中。
- `mos.json`：数码发行的 27 首全部在本地影片中高度匹配。实体 3CD 还含六首未收录于该数码版的曲目；这些曲目的切点依据完整影片公开章节标记并以画面抽查。
- `duo.json`：Disc 1 前 28 首的数码发行试听中，26 首相关性超过 0.5。开场《今天等我來》的样本相关性为 0.498；《破曉》的试听与本地影片未取得可靠匹配，采用公开影片章节标记，影片该段可见 DUO Disc 1 标题影像。后十首没有提供本地原片，网页没有替它们标造影像。

试听定位脚本在 `scripts/align-album.py` 与 `scripts/align-preview.py`。公开章节参考：[MOS](https://www.youtube.com/watch?v=oRJBlyV7AH0)、[DUO](https://www.youtube.com/watch?v=xL2rN2diFos)。正式曲序参考：[MOS 3CD](https://www.yesasia.com/global/easons-moving-on-stage-1-3cd/1005163950-0-0-0-en/info.html)、[DUO 3CD](https://www.yesasia.com/us/duo-eason-chan-concert-live-2010-3cd/1022885926-0-0-0-en/info.html)、[FNDS 2CD](https://www.umusic.com.tw/album.php?q=N2j0Q226M-Q0E9AE9E9AE-)。
