// Essential hero video player.
//
// Plays page-specific loop footage as the hero background. Each page declares
// its folder via `data-video-dir` on #essential-hero-bg; the player loads
//   videos/<dir>/video_1.mp4, videos/<dir>/video_2.mp4, ...
// in order. It starts the first the moment it's available and prefetches the
// next while the current one plays, so the hand-off is seamless. A single
// video loops. If the folder has no videos, the hero stays a static field —
// no animation.
//
// Drop footage into the matching folder on disk and deploy; nothing else to
// wire up. Folders: videos/home, videos/practice, videos/videos,
// videos/about, videos/contact.
//
// (Order 34 follow-up: the generative pixel-grid background was removed in
// favor of clean video playback.)
'use strict';

(function () {
  const CONTAINER_ID = 'essential-hero-bg';
  const MAX_PROBE = 50; // safety cap on how many video_N.mp4 we look for

  function HeroVideo(container, dir) {
    this.container = container;
    this.base = 'videos/' + dir + '/';
    this.playlist = [];      // discovered URLs, in order
    this.idx = -1;           // index of the currently playing clip
    this.blobByIdx = {};     // idx -> object URL for fully-prefetched clips
    this.inflight = {};      // idx -> in-progress prefetch promise
    this.video = null;
    this.start();
  }

  HeroVideo.prototype.url = function (n) {
    return this.base + 'video_' + n + '.mp4';
  };

  // HEAD probe — true if the file exists on the server.
  HeroVideo.prototype.exists = function (url) {
    return fetch(url, { method: 'HEAD' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  };

  HeroVideo.prototype.start = function () {
    var self = this;
    // Probe video_1 first so playback can begin the instant it's confirmed,
    // before we finish discovering the rest of the playlist.
    this.exists(this.url(1)).then(function (ok) {
      if (!ok) return; // no footage for this page -> static hero
      self.playlist.push(self.url(1));
      self.createVideo();
      self.playIndex(0);
      self.discoverRest(2);
    });
  };

  // Walk video_2, video_3, ... until one is missing.
  HeroVideo.prototype.discoverRest = function (n) {
    var self = this;
    if (n > MAX_PROBE) { self.finishDiscovery(); return; }
    this.exists(this.url(n)).then(function (ok) {
      if (!ok) { self.finishDiscovery(); return; }
      self.playlist.push(self.url(n));
      // As soon as we know there's a second clip, start loading it while the
      // first one plays.
      if (self.playlist.length === 2) self.prefetch(1);
      self.discoverRest(n + 1);
    });
  };

  HeroVideo.prototype.finishDiscovery = function () {
    // A lone clip just loops in place.
    if (this.playlist.length === 1 && this.video) this.video.loop = true;
  };

  HeroVideo.prototype.createVideo = function () {
    var v = document.createElement('video');
    v.className = 'hero-video';
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    v.controls = false;
    v.preload = 'auto';
    // iOS/Safari inline autoplay needs the attributes set, not just props.
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.playsInline = true;
    var self = this;
    v.addEventListener('ended', function () { self.onEnded(); });
    this.container.appendChild(v);
    this.video = v;
  };

  // Download a clip fully into a blob so the swap to it is instant.
  HeroVideo.prototype.prefetch = function (i) {
    if (i < 0 || i >= this.playlist.length) return;
    if (this.blobByIdx[i] || this.inflight[i]) return;
    var self = this;
    this.inflight[i] = fetch(this.playlist[i])
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (b) { self.blobByIdx[i] = URL.createObjectURL(b); delete self.inflight[i]; })
      .catch(function () { delete self.inflight[i]; });
  };

  HeroVideo.prototype.playIndex = function (i) {
    if (!this.video) return;
    this.idx = i;
    // Use the prefetched blob if we have it; otherwise stream from the URL
    // (fine for the very first clip, which we want playing as soon as possible).
    this.video.src = this.blobByIdx[i] || this.playlist[i];
    this.video.play().catch(function () {});
    if (this.playlist.length > 1) this.prefetch((i + 1) % this.playlist.length);
  };

  HeroVideo.prototype.onEnded = function () {
    if (this.playlist.length <= 1) {
      // loop=true normally handles this; guard for the brief pre-discovery window.
      this.video.currentTime = 0;
      this.video.play().catch(function () {});
      return;
    }
    var next = (this.idx + 1) % this.playlist.length;
    this.playIndex(next);
    this.prefetch((next + 1) % this.playlist.length);
  };

  function boot() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    var dir = container.getAttribute('data-video-dir');
    if (!dir) return; // page opted out -> static hero
    // eslint-disable-next-line no-new
    new HeroVideo(container, dir);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
