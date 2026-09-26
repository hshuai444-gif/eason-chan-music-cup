import { useEffect, useRef, useState } from 'react';
import { chapters, totalTracks } from './archive.js';
import { getAdjacentSongs, getLyricsForSong, getQqMusicSearchUrl, getSongById } from './lyrics.js';
import { films, getVideoCue } from './video-cues.js';
import { siteAsset, videoAvailable } from './paths.js';

const pad = (value) => String(value).padStart(2, '0');

function useDocumentPosition() {
  const [activeId, setActiveId] = useState('opening');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty('--document-progress', String(max > 0 ? window.scrollY / max : 0));
      setScrolled(window.scrollY > 30);
      const marker = window.innerHeight * 0.45;
      let current = 'opening';
      for (const chapter of chapters) {
        const element = document.getElementById(chapter.id);
        if (element && element.getBoundingClientRect().top <= marker) current = chapter.id;
      }
      setActiveId((previous) => previous === current ? previous : current);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return { activeId, scrolled };
}

function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.1 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function Arrow({ diagonal = false }) {
  return <span className="arrow" aria-hidden="true">{diagonal ? '↗' : '→'}</span>;
}

function Header({ activeId, scrolled, onMenu, onSources, onAudio, audioOpen }) {
  const active = chapters.find((chapter) => chapter.id === activeId);
  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <a className="site-brand" href="#opening" aria-label="Eason Chan Music Cup — 回到序幕">
        <span>EASON CHAN</span><span>MUSIC CUP</span>
      </a>
      <div className="header-center" aria-live="polite">
        {active ? <><span>{active.index}</span><i /><span>{active.title}</span></> : <span>AN INTERACTIVE CONCERT ARCHIVE</span>}
      </div>
      <nav className="header-actions" aria-label="主要功能">
        <button type="button" onClick={onMenu}>CHAPTERS <span className="button-glyph">⌄</span></button>
        <button type="button" onClick={onSources}>SOURCES <Arrow diagonal /></button>
        <button type="button" onClick={onAudio}>{audioOpen ? 'CLOSE AUDIO' : 'LISTEN'} <span className="button-glyph">♫</span></button>
      </nav>
      <button className="mobile-menu-button" type="button" onClick={onMenu} aria-label="開啟章節選單"><span /><span /></button>
    </header>
  );
}

function ChapterMenu({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={`chapter-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="menu-head"><span>CHAPTER INDEX</span><button type="button" onClick={onClose} aria-label="關閉章節選單">CLOSE ×</button></div>
      <nav aria-label="章節目錄">
        {chapters.map((chapter) => (
          <a key={chapter.id} href={`#${chapter.id}`} tabIndex={open ? 0 : -1} onClick={onClose}>
            <span className="menu-index">{chapter.index}</span>
            <span className="menu-title">{chapter.title}</span>
            <span className="menu-year">{chapter.year}</span>
            <Arrow diagonal />
          </a>
        ))}
      </nav>
      <p>五段現場，五種觀看時間的方式。</p>
    </div>
  );
}

function SourcesPanel({ chapter, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && <button className="panel-scrim" type="button" onClick={onClose} aria-label="關閉來源資料" />}
      <aside className={`source-panel${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label="資料來源">
        <div className="panel-top"><span>ARCHIVE / PROVENANCE</span><button type="button" onClick={onClose} aria-label="關閉來源資料">CLOSE ×</button></div>
        <div className="panel-body">
          <p className="panel-chapter">{chapter.index} / {chapter.year}</p>
          <h2>{chapter.title}</h2>
          <p className="panel-lead">{chapter.edition}</p>
          <dl>
            <div><dt>RELEASE</dt><dd>{chapter.label}</dd></div>
            <div><dt>TRACKS</dt><dd>{chapter.discs.flat().length} · 官方現場發行曲序</dd></div>
            <div><dt>IMAGE</dt><dd>{chapter.sourceNote}</dd></div>
            {films[chapter.id] && <div><dt>FILM</dt><dd>{films[chapter.id].source}；逐曲時間點與發行曲序分開核對。{chapter.id === 'duo' && '目前提供的影片只有 Disc 1。'}</dd></div>}
          </dl>
          <h3>PRIMARY SOURCES</h3>
          <ul>{chapter.sources.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label}<Arrow diagonal /></a></li>)}</ul>
          <p className="panel-disclaimer">此網站是獨立策展檔案。發行曲序不代表每一場演出完全相同；未取得正式網頁使用權的演出照片不會作為本站主圖。</p>
        </div>
      </aside>
    </>
  );
}

function AudioPanel({ chapter, open, onClose }) {
  const appleUrl = chapter.id === 'fear-and-dreams' ? chapter.listenUrl : chapter.albumUrl;
  const embedUrl = appleUrl.replace('https://music.apple.com/', 'https://embed.music.apple.com/');
  return (
    <aside className={`audio-panel${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label="官方音樂播放器">
      <div className="audio-head"><span>LISTEN / {chapter.title}</span><button type="button" onClick={onClose} aria-label="關閉播放器">CLOSE ×</button></div>
      <p>播放需由你手動開始。以下為 Apple Music 官方嵌入播放器。</p>
      {open && <iframe title={`${chapter.title} 官方發行播放器`} allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" src={embedUrl} />}
      <a href={appleUrl} target="_blank" rel="noreferrer">在 Apple Music 開啟 <Arrow diagonal /></a>
    </aside>
  );
}

function ProgressRail({ activeId }) {
  return <nav className="progress-rail" aria-label="巡演時間軸">
    {chapters.map((chapter) => <a key={chapter.id} className={activeId === chapter.id ? 'is-active' : ''} href={`#${chapter.id}`} aria-label={`跳至 ${chapter.title}`}><span>{chapter.index}</span><i /></a>)}
  </nav>;
}

function Opening() {
  return <section id="opening" className="opening" aria-labelledby="site-title">
    <div className="opening-image" style={{ '--opening-image': `url("${siteAsset('assets/opening.png')}")` }} aria-hidden="true" />
    <div className="opening-content">
      <div className="opening-title" data-reveal>
        <h1 id="site-title"><span>Eason Chan</span><span>Music Cup</span></h1>
        <p>An interactive concert archive</p>
        <div className="tiny-rule" />
        <span className="opening-dates">ARCHIVE / 2006—2025</span>
      </div>
      <a className="scroll-prompt" href="#get-a-life">SCROLL TO ENTER <span aria-hidden="true">↓</span></a>
      <div className="opening-timeline" aria-label="五個章節">
        {chapters.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`}><i /><strong>{chapter.title}</strong><span>{chapter.year}</span></a>)}
      </div>
      <p className="keyboard-hint"><kbd>←</kbd><kbd>→</kbd> 切換章節</p>
    </div>
  </section>;
}

function TrackList({ chapter, onSong }) {
  const [selected, setSelected] = useState(chapter.feature);
  return <div className="tracks-layout">
    <div className="tracks-main">
      <div className="tracks-heading" data-reveal><span>THE RECORD</span><h3>曲目檔案</h3><p>官方現場發行曲序 · {chapter.discs.flat().length} 首</p></div>
      {chapter.discs.map((disc, discIndex) => (
        <div className="disc" key={`${chapter.id}-${discIndex}`}>
          <div className="disc-heading"><span>DISC {pad(discIndex + 1)}</span><span>{pad(disc.length)} TRACKS</span></div>
          <ol>{disc.map((song, songIndex) => <li key={`${song}-${songIndex}`}>
            <a className={selected === song ? 'is-selected' : ''} href={`?song=${chapter.id}-d${discIndex + 1}-t${songIndex + 1}#${chapter.id}`} aria-label={`開啟 ${song} 的歌曲檔案${getVideoCue(getSongById(`${chapter.id}-d${discIndex + 1}-t${songIndex + 1}`))?.available ? '及現場片段' : ''}`} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setSelected(song);
              onSong(getSongById(`${chapter.id}-d${discIndex + 1}-t${songIndex + 1}`));
            }}>
              <span className="song-number">{pad(songIndex + 1)}</span><span className="song-name">{song}</span><span className="song-mark">{selected === song ? '●' : getVideoCue(getSongById(`${chapter.id}-d${discIndex + 1}-t${songIndex + 1}`))?.available ? '▶' : '↗'}</span>
            </a>
          </li>)}</ol>
        </div>
      ))}
      <p className="tracklist-note">曲序來自官方現場發行版本。不同場次與影音剪輯可能有所差異。</p>
    </div>
    <div className="track-focus" aria-live="polite"><span>SELECTED TRACK / {chapter.year}</span><strong>{selected}</strong><a href={chapter.albumUrl} target="_blank" rel="noreferrer">核對發行版本 <Arrow diagonal /></a></div>
  </div>;
}

function SongFilm({ entry }) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const cue = getVideoCue(entry);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  if (!cue) return entry.chapter.id === 'duo' ? <p className="song-film-unavailable">本地影片僅有 DUO Disc 1。這首歌的演出影像尚未包含在提供的原片中。</p> : null;
  if (!cue.available) return <p className="song-film-unavailable">這首歌的演出影像暫未於公開版提供。<a href={entry.chapter.mediaUrl} target="_blank" rel="noreferrer">查看發行來源 <Arrow diagonal /></a></p>;

  const length = cue.end - cue.start;
  const clock = (value) => `${Math.floor(value / 60)}:${pad(Math.floor(value % 60))}`;
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || error) return;
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime < cue.start || video.currentTime >= cue.end - 0.15) {
      video.currentTime = cue.start;
      setElapsed(0);
    }
    setStarted(true);
    video.play().catch(() => setError(true));
  };

  return <div className="song-film">
    <div className="song-film-heading"><span>THE FILM / TRACK {pad(cue.ordinal)}</span><span>{cue.label}</span></div>
    <div className="song-film-frame" ref={frameRef}>
      <video
        ref={videoRef}
        aria-label={`${entry.title} 現場演出片段`}
        playsInline
        preload="metadata"
        poster={cue.poster}
        src={cue.url}
        onLoadedMetadata={(event) => { event.currentTarget.currentTime = cue.start; setElapsed(0); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const position = event.currentTarget.currentTime;
          setElapsed(Math.max(0, Math.min(position - cue.start, length)));
          if (position >= cue.end - 0.15) event.currentTarget.pause();
        }}
        onError={() => setError(true)}
      />
      {!started && <img className="song-film-cover" src={entry.chapter.cover} alt={`${entry.chapter.edition} 專輯封面`} />}
      {!playing && <button className="song-film-overlay-play" type="button" onClick={togglePlayback} aria-label={`播放 ${entry.title} 現場片段`}>▶</button>}
      <div className="song-film-controls">
        <button type="button" onClick={togglePlayback} aria-label={playing ? '暫停片段' : '播放片段'}>{playing ? 'Ⅱ' : '▶'}</button>
        <span>{clock(elapsed)}</span>
        <input type="range" min="0" max={Math.max(1, length)} step="0.1" value={elapsed} aria-label={`${entry.title} 片段播放進度`} onChange={(event) => {
          const position = Math.min(Number(event.target.value), length - 0.2);
          videoRef.current.currentTime = cue.start + position;
          setElapsed(position);
        }} />
        <span>{clock(length)}</span>
        <button type="button" onClick={() => frameRef.current?.requestFullscreen?.()} aria-label="全屏播放片段">⛶</button>
      </div>
    </div>
    <p>{error ? '本地影片暫時無法讀取，請檢查原檔路徑。' : cue.caveat || `已定位本片中的 ${entry.title}；播放範圍 ${Math.floor(cue.start / 60)}:${pad(Math.floor(cue.start % 60))}—${Math.floor(cue.end / 60)}:${pad(Math.floor(cue.end % 60))}。`}</p>
  </div>;
}

function LyricsPage({ entry, data, onClose, onNavigate }) {
  const closeRef = useRef(null);
  const pageRef = useRef(null);
  const lyrics = getLyricsForSong(data, entry);
  const lyricsStatus = data?.statusBySong?.[entry.id];
  const { previous, next } = getAdjacentSongs(entry);

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = [...document.querySelectorAll('#root > :not(.lyrics-page)')].map((element) => [element, element.inert]);
    background.forEach(([element]) => { element.inert = true; });
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      const withinFilmControls = event.target.closest?.('.song-film-controls');
      if (event.key === 'ArrowLeft' && previous && !withinFilmControls) onNavigate(previous);
      if (event.key === 'ArrowRight' && next && !withinFilmControls) onNavigate(next);
      if (event.key === 'Tab') {
        const targets = [...pageRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')];
        const first = targets[0];
        const last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      background.forEach(([element, wasInert]) => { element.inert = wasInert; });
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [entry.id]);

  return <div ref={pageRef} className={`lyrics-page lyrics-page--${entry.chapter.theme}`} role="dialog" aria-modal="true" aria-labelledby="lyrics-title">
    <div className="lyrics-page-backdrop" style={{ '--lyrics-scene': `url("${entry.chapter.backdrop}")` }} aria-hidden="true" />
    <div className="lyrics-page-shell">
      <header className="lyrics-header">
        <button ref={closeRef} type="button" onClick={onClose}>← <span>BACK TO THE RECORD</span></button>
        <span>EASON CHAN MUSIC CUP / WORDS & FILM</span>
        <span>{entry.chapter.index} / {entry.chapter.title}</span>
      </header>
      <div className="lyrics-main">
        <div className="lyrics-identity">
          <div className="lyrics-identity-top"><span>SONG {pad(entry.songIndex + 1)}</span><span>DISC {pad(entry.discIndex + 1)}</span></div>
          <h2 id="lyrics-title">{entry.title}</h2>
          <SongFilm entry={entry} />
          <div className="lyrics-identity-bottom"><i /><p>{entry.chapter.edition}<br />{entry.chapter.year} / 官方現場發行曲序</p></div>
        </div>
        <div className="lyrics-reading">
          <div className="lyrics-reading-head"><span>THE WORDS</span><span>{lyrics ? lyrics.sourceLabel : lyricsStatus === 'review' ? 'VERSION REVIEW' : 'SOURCE PENDING'}</span></div>
          {lyrics ? <>
            <div className="lyrics-stanzas">
              {lyrics.sections.map((section, sectionIndex) => <section key={`${entry.id}-${sectionIndex}`} className="lyrics-stanza" aria-label={`歌詞段落 ${sectionIndex + 1}`}>
                <span className="lyrics-stanza-number">{pad(sectionIndex + 1)}</span>
                <div>{section.lines.map((line, lineIndex) => <p key={`${sectionIndex}-${lineIndex}`}>{line}</p>)}</div>
              </section>)}
            </div>
            {lyrics.editionNote && <p className="lyrics-edition-note">{lyrics.editionNote}</p>}
            {lyrics.sourceUrl && <a className="lyrics-source-link" href={lyrics.sourceUrl} target="_blank" rel="noreferrer">核對歌詞來源 <Arrow diagonal /></a>}
          </> : <div className="lyrics-empty">
            <span>ARCHIVE NOTE / {entry.chapter.year}</span>
            <h3>{lyricsStatus === 'review' ? <>Words<br />need review.</> : <>Words<br />await a source.</>}</h3>
            <p>{lyricsStatus === 'review' ? '現有歌詞資料對應多個錄音或文本版本，尚不能確認這場演出的用詞。核對版本後，這裡會呈現完整歌詞。' : '尚未找到與這首歌及其版本可靠對應的歌詞文本。取得可核對的資料後，這裡會以分段閱讀方式呈現。'}</p>
            <a href={getQqMusicSearchUrl(entry)} target="_blank" rel="noreferrer">在 QQ 音樂查找歌詞 <Arrow diagonal /></a>
          </div>}
        </div>
      </div>
      <footer className="lyrics-footer">
        {previous ? <button type="button" onClick={() => onNavigate(previous)}><span>← PREVIOUS SONG</span><strong>{previous.title}</strong></button> : <span />}
        {next ? <button type="button" onClick={() => onNavigate(next)}><span>NEXT SONG →</span><strong>{next.title}</strong></button> : <span />}
      </footer>
    </div>
  </div>;
}

function ConcertFilm({ chapter }) {
  const film = films[chapter.id];
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);

  const play = () => {
    setStarted(true);
    videoRef.current?.play().catch(() => {
      // The native controls remain available if the browser blocks programmatic playback.
    });
  };

  return <section className="concert-film" aria-labelledby={`${chapter.id}-film-title`}>
    <div className="film-heading" data-reveal>
      <span>THE FILM / {chapter.period}</span>
      <h3 id={`${chapter.id}-film-title`}>{chapter.title === 'FEAR AND DREAMS' ? <>Fear becomes<br /><em>Dreams.</em></> : chapter.title}</h3>
      <p>{videoAvailable ? `${film.source}。聲音與播放由你開始；曲目列表可以直接進入歌曲片段。` : '這部演唱會影像暫未於公開版提供；下方仍可閱讀完整曲目檔案。'}</p>
    </div>
    <div className={`film-screen${started ? ' is-started' : ''}`} style={{ '--film-poster': `url("${chapter.cover}")` }}>
      {videoAvailable && <video
        ref={videoRef}
        aria-label={`${chapter.title} 演唱會影像`}
        controls={started}
        playsInline
        preload="none"
        poster={chapter.cover}
        src={film.url}
        onError={() => setError(true)}
      />}
      {videoAvailable && !started && !error && <button className="film-play" type="button" onClick={play} aria-label={`播放 ${chapter.title} 演唱會`}><span aria-hidden="true">▶</span><strong>WATCH THE CONCERT</strong></button>}
      {!videoAvailable && <p className="film-unavailable">FILM / COMING TO THE PUBLIC ARCHIVE</p>}
      <div className="film-corner film-corner--top">EASON CHAN / {chapter.title}</div>
      <div className="film-corner film-corner--bottom">{Math.floor(film.duration / 3600)}:{pad(Math.floor(film.duration % 3600 / 60))}:{pad(Math.floor(film.duration % 60))} <i /> 1080P <i /> {chapter.year}</div>
    </div>
    <div className="film-footer"><span>ALBUM ART / OFFICIAL RELEASE</span><p>{!videoAvailable ? '影像公開上線前，曲目和來源資料可正常瀏覽。' : error ? '本機影片無法讀取。請確認原檔仍在 D 盤，或設定對應的 VIDEO_PATH。' : chapter.id === 'duo' ? '此影片是 DUO Disc 1，曲目 29—38 尚無本地影像。' : '下方曲目依正式發行曲序排列。逐曲播放點依這份本地影片建立。'}</p></div>
  </section>;
}

function ChapterPrelude({ chapter }) {
  const audioRef = useRef(null);
  const areaRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const enter = () => {
    audioRef.current?.pause();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    document.getElementById(`${chapter.id}-record`)?.scrollIntoView({ behavior, block: 'start' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }, { threshold: 0.1 });
    if (areaRef.current) observer.observe(areaRef.current);
    return () => { observer.disconnect(); audioRef.current?.pause(); };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); }
    catch { setAudioError(true); }
  };

  return <div className="chapter-prelude" ref={areaRef} aria-labelledby={`${chapter.id}-prelude-title`}>
    <audio ref={audioRef} src={siteAsset(`audio/${chapter.id}.m4a`)} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={enter} onError={() => setAudioError(true)} />
    <div className="prelude-art"><img src={chapter.cover} alt={`${chapter.edition} 專輯封面`} loading={chapter.index === '01' ? 'eager' : 'lazy'} /></div>
    <div className="prelude-content">
      <span className="prelude-eyebrow">PRELUDE / CHAPTER {chapter.index} / {chapter.year}</span>
      <h2 id={`${chapter.id}-prelude-title`}>{chapter.title}</h2>
      <p>一段為本章創作的管弦氛圍序曲。按下播放，讓音樂帶你進入現場。</p>
      <div className="prelude-actions">
        <button type="button" onClick={toggle} disabled={audioError}>{audioError ? '音樂暫不可用' : playing ? '暫停序曲 Ⅱ' : '播放序曲 · 進入本章 ▶'}</button>
        <button type="button" onClick={enter}>直接進入 ↗</button>
      </div>
      <span className="prelude-caption">ORIGINAL INSTRUMENTAL / 11 SECONDS</span>
    </div>
  </div>;
}

function Chapter({ chapter, onSources, onSong }) {
  return <section id={chapter.id} className={`chapter chapter--${chapter.theme}`} aria-labelledby={`${chapter.id}-title`}>
    <ChapterPrelude chapter={chapter} />
    <div className="chapter-cover" id={`${chapter.id}-record`}>
      <div className="chapter-scene" style={{ '--scene-image': `url("${chapter.backdrop}")` }}>
        <img className="chapter-scene-album" src={chapter.cover} alt="" loading="lazy" />
        <div className="chapter-scene-inner">
          <div className="chapter-number" data-reveal>{chapter.index}</div>
          <div className="chapter-type" data-reveal>
            <span className="chapter-overline">{chapter.period}</span>
            <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
            <div className="chapter-title-rule" />
            <span className="chapter-feature">{chapter.feature}</span>
            <button className="text-link" type="button" onClick={() => onSources(chapter)}>VIEW SOURCES <Arrow diagonal /></button>
          </div>
          <span className="chapter-scene-caption">ALBUM ART / {chapter.edition}</span>
          <span className="chapter-scene-scroll">SCROLL TO EXPLORE ↓</span>
        </div>
      </div>
    </div>
    <div className="chapter-body">
      <div className="chapter-statement" data-reveal><span>CHAPTER {chapter.index} / {chapter.year}</span><p>{chapter.description}</p></div>
      {films[chapter.id] && <ConcertFilm chapter={chapter} />}
      <div className="artifact" data-reveal>
        <div className="artifact-image"><a href={chapter.albumUrl} target="_blank" rel="noreferrer"><img src={chapter.cover} alt={`${chapter.edition} 官方發行封面`} loading="lazy" /></a></div>
        <div className="artifact-copy"><span>ARCHIVE OBJECT {chapter.index}</span><h3>{chapter.edition}</h3><div className="artifact-rule" /><p>{chapter.credits}</p><p>{chapter.sourceNote}</p><div className="artifact-actions"><a href={chapter.albumUrl} target="_blank" rel="noreferrer">OFFICIAL RELEASE <Arrow diagonal /></a><a href={chapter.mediaUrl} target="_blank" rel="noreferrer">{chapter.mediaLabel} <Arrow diagonal /></a></div></div>
      </div>
      <TrackList chapter={chapter} onSong={onSong} />
      <div className="chapter-end"><span>END OF CHAPTER {chapter.index}</span><span>{chapter.title}</span></div>
    </div>
  </section>;
}

function Coda({ onSources }) {
  return <footer id="coda" className="coda">
    <div className="coda-top"><span>THE ARCHIVE CONTINUES</span><span>2006—2025</span></div>
    <h2>After the<br />last song.</h2>
    <p>五段現場發行紀錄，{totalTracks} 首曲目。聲音和影像有各自的來源；每個版本都有自己的時間。</p>
    <button type="button" onClick={() => onSources(chapters[0])}>EXPLORE THE SOURCES <Arrow diagonal /></button>
    <div className="coda-line" />
    <div className="coda-bottom"><span>EASON CHAN MUSIC CUP</span><span>INDEPENDENT CURATED ARCHIVE · NOT AN OFFICIAL ARTIST SITE</span><a href="#opening">BACK TO TOP ↑</a></div>
  </footer>;
}

export default function App() {
  const { activeId, scrolled } = useDocumentPosition();
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceChapter, setSourceChapter] = useState(null);
  const [audioOpen, setAudioOpen] = useState(false);
  const [songEntry, setSongEntry] = useState(() => getSongById(new URLSearchParams(window.location.search).get('song')));
  const [lyricsData, setLyricsData] = useState(null);
  const activeChapter = chapters.find((chapter) => chapter.id === activeId) || chapters[0];
  const previousFocus = useRef(null);
  const songPreviousFocus = useRef(null);
  const shortcutTarget = useRef(null);

  useEffect(() => {
    fetch(siteAsset('lyrics/lyrics.json'), { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then(setLyricsData).catch(() => setLyricsData(null));
    const onPopState = () => setSongEntry(getSongById(new URLSearchParams(window.location.search).get('song')));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activeId === shortcutTarget.current) shortcutTarget.current = null;
  }, [activeId]);

  useEffect(() => {
    const chapterIds = ['opening', ...chapters.map((chapter) => chapter.id)];
    const onChapterKey = (event) => {
      if (songEntry || menuOpen || sourceChapter || audioOpen || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
      const current = Math.max(0, chapterIds.indexOf(shortcutTarget.current || activeId));
      const next = Math.max(0, Math.min(chapterIds.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
      if (next === current) return;
      event.preventDefault();
      const id = chapterIds[next];
      shortcutTarget.current = id;
      window.history.pushState(null, '', `#${id}`);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.addEventListener('keydown', onChapterKey);
    return () => document.removeEventListener('keydown', onChapterKey);
  }, [activeId, songEntry, menuOpen, sourceChapter, audioOpen]);

  const openSong = (entry) => {
    if (!entry) return;
    if (!songEntry) songPreviousFocus.current = document.activeElement;
    const url = new URL(window.location.href);
    url.searchParams.set('song', entry.id);
    url.hash = entry.chapter.id;
    window.history.pushState({ song: entry.id }, '', url);
    setSongEntry(entry);
    setAudioOpen(false);
  };
  const closeSong = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('song');
    window.history.replaceState(null, '', url);
    setSongEntry(null);
    if (window.scrollY < 100 && songEntry) document.getElementById(songEntry.chapter.id)?.scrollIntoView();
    window.setTimeout(() => songPreviousFocus.current?.focus?.(), 0);
  };

  const openSources = (chapter) => {
    previousFocus.current = document.activeElement;
    setSourceChapter(chapter);
  };
  const closeSources = () => {
    setSourceChapter(null);
    window.setTimeout(() => previousFocus.current?.focus?.(), 0);
  };

  return <>
    <a className="skip-link" href="#get-a-life">跳至內容</a>
    <div className="document-progress" aria-hidden="true" />
    <Header activeId={activeId} scrolled={scrolled} onMenu={() => setMenuOpen(true)} onSources={() => openSources(activeChapter)} onAudio={() => setAudioOpen((value) => !value)} audioOpen={audioOpen} />
    <ProgressRail activeId={activeId} />
    <main><Opening />{chapters.map((chapter) => <Chapter key={chapter.id} chapter={chapter} onSources={openSources} onSong={openSong} />)}</main>
    <Coda onSources={openSources} />
    <ChapterMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    <SourcesPanel chapter={sourceChapter || activeChapter} open={Boolean(sourceChapter)} onClose={closeSources} />
    <AudioPanel chapter={activeChapter} open={audioOpen} onClose={() => setAudioOpen(false)} />
    {songEntry && <LyricsPage key={songEntry.id} entry={songEntry} data={lyricsData} onClose={closeSong} onNavigate={openSong} />}
  </>;
}
