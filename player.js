// Global variables
const canvas = document.getElementById("decoyVideo");
const ctx = canvas.getContext("2d");
const video = document.getElementById("mainVideo");
const stats = document.getElementById("playerStats");
let currentPlayer = null;
let statsInterval = null;
let controlsTimeout;
let isLocked = false;
let currentQuality = 'auto';
let isAmbientEnabled = true; // Add this near other global variables

// Lock functionality
function toggleLock() {
    const ambientPlayer = document.querySelector(".ambient-player");
    const lockBtn = document.querySelector(".lock-btn");
    const lockIcon = lockBtn.querySelector("i");
    isLocked = !isLocked;

    if (isLocked) {
        ambientPlayer.classList.add("interface-locked");
        lockBtn.classList.add("locked");
        lockIcon.className = "fas fa-lock"; // Changed to lock icon
    } else {
        ambientPlayer.classList.remove("interface-locked");
        lockBtn.classList.remove("locked");
        lockIcon.className = "fas fa-lock-open"; // Changed to unlock icon
    }
}

// Maximize functionality
function toggleMaximize() {
    const ambientPlayer = document.querySelector(".ambient-player");
    const maximizeBtn = document.querySelector(".maximize-btn");
    const maximizeIcon = maximizeBtn.querySelector("i");

    if (ambientPlayer.classList.contains("maximized")) {
        ambientPlayer.classList.remove("maximized");
        document.body.style.overflow = "";
        maximizeIcon.className = "fas fa-up-right-and-down-left-from-center";
    } else {
        ambientPlayer.classList.add("maximized");
        document.body.style.overflow = "hidden";
        maximizeIcon.className = "fas fa-down-left-and-up-right-to-center";
    }
    setCanvasDimension();
    if (video.paused) paintStaticVideo();
}

// Main functions
async function loadVideoUrl() {
    const url = document.getElementById("videoUrl").value.trim();
    if (!url) {
        showError("Please enter a URL");
        return;
    }
    try {
        destroyCurrentPlayer();
        const formatText = document.getElementById("formatView").querySelector("span").textContent;
        const format = formatText.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Show the ambient player
        document.getElementById("ambientPlayer").classList.add("active");

        if (format === "autodetect") {
            await autoDetectAndPlay(url);
        } else {
            await playByFormat(url, format);
        }
        startStatsUpdate();
        updatePlayButtonIcon(); // Add this line
    } catch (error) {
        showError(error.message);
        // Hide the ambient player on error
        document.getElementById("ambientPlayer").classList.remove("active");
    }
}

async function playByFormat(url, format) {
    switch (format) {
        case "youtube":
            await playYouTube(url);
            break;
        case "vimeo":
            await playVimeo(url);
            break;
        case "dailymotion":
            await playDailymotion(url);
            break;
        case "hls":
            await playHLS(url);
            break;
        case "dash":
            await playDASH(url);
            break;
        case "torrent":
            await playTorrent(url);
            break;
        case "webm":
            await playDirect(url, "video/webm");
            break;
        case "mp4":
            await playDirect(url, "video/mp4");
            break;
        default:
            throw new Error("Unsupported format");
    }
}

// Player functions
async function playYouTube(url) {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    return new Promise((resolve, reject) => {
        if (!window.YT) {
            reject(new Error("YouTube Player API not loaded"));
            return;
        }

        destroyCurrentPlayer();
        document.querySelector(".main").classList.add("show");
        document.querySelector(".decoy").classList.add("show");

        const player = new YT.Player("mainVideo", {
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 1,
                modestbranding: 1,
                rel: 0
            },
            events: {
                onReady: resolve,
                onError: reject
            }
        });
        currentPlayer = player;
    });
}

async function playVimeo(url) {
    const videoId = extractVimeoId(url);
    if (!videoId) throw new Error("Invalid Vimeo URL");

    return new Promise((resolve, reject) => {
        destroyCurrentPlayer();
        document.querySelector(".main").classList.add("show");
        document.querySelector(".decoy").classList.add("show");

        const player = new Vimeo.Player("mainVideo", {
            id: videoId,
            autoplay: true,
            width: video.offsetWidth,
            height: video.offsetHeight
        });

        player.on("play", resolve);
        player.on("error", reject);
        currentPlayer = player;
    });
}

async function playDailymotion(url) {
    const videoId = extractDailymotionId(url);
    if (!videoId) throw new Error("Invalid Dailymotion URL");

    return new Promise((resolve, reject) => {
        destroyCurrentPlayer();
        const player = DM.player("mainVideo", {
            video: videoId,
            params: {
                autoplay: true,
                controls: true
            }
        });

        player.addEventListener("playing", resolve);
        player.addEventListener("error", reject);
        currentPlayer = player;
    });
}

function extractYouTubeId(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return match && 11 === match[2].length ? match[2] : null;
}

function extractVimeoId(url) {
    const match = url.match(/vimeo.com\/(?:video\/)?([0-9]+)/);
    return match ? match[1] : null;
}

function extractDailymotionId(url) {
    const match = url.match(/^.+dailymotion.com\/(video|hub)\/([^_]+)[^#]*(#video=([^_&]+))?/);
    return match ? match[2] : null;
}

function destroyCurrentPlayer() {
    if (currentPlayer) {
        if (currentPlayer.destroy) currentPlayer.destroy();
        if (currentPlayer.detachMedia) currentPlayer.detachMedia();
        if (currentPlayer.dispose) currentPlayer.dispose();
        currentPlayer = null;
    }
    const ambientPlayer = document.querySelector(".ambient-player");
    const mainVideo = document.getElementById("mainVideo");
    if (!mainVideo || mainVideo.tagName !== "VIDEO") {
        const newVideo = document.createElement("video");
        newVideo.id = "mainVideo";
        newVideo.className = "main";
        newVideo.controls = true;
        newVideo.preload = "auto";
        if (mainVideo) {
            mainVideo.replaceWith(newVideo);
        } else {
            ambientPlayer.appendChild(newVideo);
        }
    }
    // Hide the ambient player when destroying the current player
    document.getElementById("ambientPlayer").classList.remove("active");
}

async function playDirect(url, type) {
    return new Promise((resolve, reject) => {
        document.querySelector(".main").classList.add("show");
        document.querySelector(".decoy").classList.add("show");

        video.src = url;
        video.type = type;

        video.onloadeddata = () => {
            updatePlayerStats({
                quality: getVideoQuality(video.videoWidth)
            });
            resolve();
        };

        video.onerror = () => reject(new Error(`Failed to load video: ${video.error.message}`));
        video.load();
        video.play().catch(reject);
    });
}

async function playHLS(url) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60000000,
            startLevel: -1,
            abrEwmaDefaultEstimate: 5e5,
            abrMaxWithRealBitrate: true
        });
        return new Promise((resolve, reject) => {
            currentPlayer = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                const qualities = data.levels.map(level => ({
                    bitrate: level.bitrate,
                    resolution: `${level.width}x${level.height}`,
                    label: `${level.height}p`
                }));
                updatePlayerStats({ qualities });
                video.play().then(resolve).catch(reject);
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    reject(new Error(`HLS error: ${data.type} - ${data.details}`));
                }
            });
            hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
                updatePlayerStats({
                    bandwidth: data.stats.bandwidth,
                    loading: data.stats.loading
                });
            });
        });
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        return video.play();
    }
    throw new Error("HLS not supported in this browser");
}

async function playDASH(url) {
    const dashPlayer = dashjs.MediaPlayer().create();
    currentPlayer = dashPlayer;
    return new Promise((resolve, reject) => {
        dashPlayer.initialize(video, url, true);
        dashPlayer.updateSettings({
            streaming: {
                lowLatencyEnabled: true,
                abr: {
                    useDefaultABRRules: true,
                    initialBitrate: { video: 2000 },
                    maxBitrate: { video: 8000 },
                    minBitrate: { video: 500 }
                },
                buffer: {
                    fastSwitchEnabled: true,
                    bufferTimeAtTopQuality: 30,
                    bufferToKeep: 20
                }
            },
            debug: {
                logLevel: dashjs.Debug.LOG_LEVEL_WARNING
            }
        });
        dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (event) => {
            const qualityInfo = dashPlayer.getBitrateInfoListFor("video");
            const quality = qualityInfo[event.newQuality];
            updatePlayerStats({
                currentQuality: `${quality.height}p`,
                bitrate: quality.bitrate
            });
        });
        dashPlayer.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, resolve);
        dashPlayer.on(dashjs.MediaPlayer.events.ERROR, reject);
    });
}

async function playTorrent(url) {
    const webtorrent = new WebTorrent({
        maxConns: 100,
        uploadRatio: 2,
        tracker: {
            announce: ["wss://tracker.openwebtorrent.com", "wss://tracker.btorrent.xyz"]
        }
    });
    return new Promise((resolve, reject) => {
        currentPlayer = webtorrent;
        webtorrent.add(url, {
            path: "/tmp/webtorrent",
            announce: ["wss://tracker.openwebtorrent.com", "wss://tracker.btorrent.xyz"]
        }, (torrent) => {
            const videoFile = torrent.files.find(file => /\.(mp4|webm|mkv|m4v|mov)$/i.test(file.name));
            if (videoFile) {
                videoFile.renderTo(video);
                const intervalId = setInterval(() => {
                    updatePlayerStats({
                        progress: (100 * torrent.progress).toFixed(1) + "%",
                        downloadSpeed: formatBytes(torrent.downloadSpeed) + "/s",
                        peers: torrent.numPeers
                    });
                }, 1000);
                torrent.on('done', () => clearInterval(intervalId));
                resolve();
            } else {
                reject(new Error("No compatible video file found in torrent"));
            }
        });
        webtorrent.on("error", reject);
        webtorrent.on("warning", console.warn);
    });
}

// Utility functions
function getVideoQuality(width) {
    const qualities = [
        { width: 3840, label: "4K" },
        { width: 1920, label: "1080p" },
        { width: 1280, label: "720p" },
        { width: 854, label: "480p" }
    ];
    return qualities.find(q => width >= q.width)?.label || "Auto";
}

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${hours ? hours + ":" : ""}${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function showError(message) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setTimeout(() => {
        errorElement.style.display = "none";
    }, 5000);
}

function updatePlayerStats(stats) {
    const playerStats = document.getElementById("playerStats");
    if (playerStats) {
        const currentStats = {
            ...JSON.parse(playerStats.dataset.stats || "{}"),
            ...stats
        };
        playerStats.dataset.stats = JSON.stringify(currentStats);
        playerStats.innerHTML = Object.entries(currentStats).map(([key, value]) => `${key}: ${value}`).join("<br>");
    }
}

function startStatsUpdate() {
    clearInterval(statsInterval);
    stats.style.display = "block";
    statsInterval = setInterval(() => {
        const duration = video.duration || 0;
        const currentTime = video.currentTime || 0;
        const bufferedPercent = video.buffered.length ? 100 * (video.buffered.end(video.buffered.length - 1) / duration) : 0;
        stats.textContent = `
                Resolution: ${video.videoWidth}x${video.videoHeight}
                Time: ${formatTime(currentTime)}/${formatTime(duration)}
                Buffered: ${bufferedPercent.toFixed(1)}%
            `;
    }, 1000);
}

function setCanvasDimension() {
    canvas.height = video.offsetHeight;
    canvas.width = video.offsetWidth;
}

function paintStaticVideo() {
    ctx.drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
}

function startVideoLoop() {
    if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
        requestAnimationFrame(startVideoLoop);
    }
}

async function autoDetectAndPlay(url) {
    try {
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            await playYouTube(url);
        } else if (url.includes("vimeo.com")) {
            await playVimeo(url);
        } else if (url.includes("dailymotion.com") || url.includes("dai.ly")) {
            await playDailymotion(url);
        } else if (url.includes(".m3u8")) {
            await playHLS(url);
        } else if (url.includes(".mpd")) {
            await playDASH(url);
        } else if (url.startsWith("magnet:") || url.includes(".torrent")) {
            await playTorrent(url);
        } else if (url.includes(".webm")) {
            await playDirect(url, "video/webm");
        } else {
            await playDirect(url, "video/mp4");
        }
    } catch (error) {
        throw new Error(`Playback error: ${error.message}`);
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    const controlsContainer = document.querySelector(".controls-container");
    const ambientPlayer = document.querySelector(".ambient-player");
    const urlInput = document.getElementById("videoUrl");
    const clearInput = document.getElementById("clearInput");

    // Add auto-select functionality to URL input
    urlInput.addEventListener("focus", function () {
        this.select();
    });

    // Show/hide clear button based on input content
    urlInput.addEventListener("input", function () {
        clearInput.style.display = this.value ? "block" : "none";
    });

    // Show controls on mouse move
    function showControls() {
        const controlsContainer = document.querySelector('.controls-container');

        if (!controlsContainer.classList.contains('hidden')) {
            controlsContainer.classList.remove('hidden');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(hideControls, 5000);
        }
    }

    // Hide controls after delay
    function hideControls() {
        if (!video.paused) {
            controlsContainer.classList.add("hidden");
            const toggleBtn = document.querySelector('.toggle-controls-btn');
            const icon = toggleBtn.querySelector('span');
            icon.innerHTML = '<span class="material-symbols-outlined">rate_review</span>';
        }
    }

    // Show controls on hover
    ambientPlayer.addEventListener("mouseenter", showControls);
    ambientPlayer.addEventListener("mousemove", showControls);

    // Show controls when video is paused
    video.addEventListener("pause", showControls);

    // Hide controls when video starts playing
    video.addEventListener("play", () => {
        if (!ambientPlayer.matches(":hover")) {
            hideControls();
        }
    });

    // Show controls when video ends
    video.addEventListener("ended", showControls);

    // Show controls when seeking
    video.addEventListener("seeking", showControls);
    video.addEventListener("seeked", () => {
        if (!ambientPlayer.matches(":hover") && !video.paused) {
            hideControls();
        }
    });

    // Show controls when volume changes
    video.addEventListener("volumechange", showControls);

    // Show controls when fullscreen changes
    document.addEventListener("fullscreenchange", showControls);
    document.addEventListener("webkitfullscreenchange", showControls);
    document.addEventListener("mozfullscreenchange", showControls);
    document.addEventListener("MSFullscreenChange", showControls);

    // Handle window resize
    window.addEventListener("resize", () => {
        setCanvasDimension();
        if (video.paused) paintStaticVideo();
    });

    // Handle escape key for maximize and lock
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (ambientPlayer.classList.contains("maximized")) {
                toggleMaximize();
            } else if (isLocked) {
                toggleLock();
            }
        }
    });

    // Existing event listeners
    video.addEventListener("loadedmetadata", () => {
        setCanvasDimension();
        paintStaticVideo();
    });

    video.addEventListener("play", startVideoLoop);
    video.addEventListener("seeked", paintStaticVideo);

    document.getElementById("videoFile").addEventListener("change", function (event) {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const url = URL.createObjectURL(file);
            document.getElementById("videoUrl").value = url;
            loadVideoUrl();
        }
    });
});

// Settings Panel functionality
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const settingsBtn = document.querySelector('.settings-btn');
    const settingsIcon = settingsBtn.querySelector('i');

    panel.classList.toggle('open');

    // Update settings button icon
    if (panel.classList.contains('open')) {
        settingsIcon.className = 'fas fa-sliders-h';
        settingsBtn.classList.add('active');
    } else {
        settingsIcon.className = 'fas fa-sliders';
        settingsBtn.classList.remove('active');
    }
}

function selectFormat(format) {
    const formatView = document.getElementById('formatView');
    const formatOption = document.querySelector(`.format-option[data-value="${format}"]`);

    // Update format view
    const icon = formatOption.querySelector('i').className;
    const text = formatOption.querySelector('span').textContent;
    formatView.innerHTML = `<i class="${icon}"></i><span>${text}</span>`;
    formatView.classList.add('active');
    setTimeout(() => formatView.classList.remove('active'), 500);

    // Update visual selection in settings panel
    document.querySelectorAll('.format-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.value === format) {
            option.classList.add('selected');
        }
    });

    // Close panel on mobile
    if (window.innerWidth <= 768) {
        toggleSettings();
    }
}

// Initialize format view
document.addEventListener('DOMContentLoaded', () => {
    const formatView = document.getElementById('formatView');
    formatView.innerHTML = `<i class="fas fa-magic"></i><span>Auto-detect</span>`;
});

// Add this function to your JavaScript section
function clearUrlInput() {
    const urlInput = document.getElementById("videoUrl");
    urlInput.value = "";
    urlInput.focus();
}

function selectQuality(quality) {
    currentQuality = quality;

    // Update visual selection
    document.querySelectorAll('.quality-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.quality === quality) {
            option.classList.add('selected');
        }
    });

    // Apply quality settings based on player type
    if (currentPlayer) {
        if (currentPlayer.setQuality) {
            currentPlayer.setQuality(quality);
        } else if (currentPlayer.setPlaybackQuality) {
            currentPlayer.setPlaybackQuality(quality);
        } else if (currentPlayer.setVideoQuality) {
            currentPlayer.setVideoQuality(quality);
        }
    }

    // Update video element quality if using native player
    if (video.tagName === 'VIDEO') {
        const currentTime = video.currentTime;
        const wasPlaying = !video.paused;

        // Store current playback state
        const currentVolume = video.volume;

        // Update video source with quality parameter if available
        if (video.src.includes('?')) {
            video.src = video.src.split('?')[0] + '?quality=' + quality;
        }

        // Restore playback state
        video.volume = currentVolume;
        if (wasPlaying) {
            video.play();
        }
        video.currentTime = currentTime;
    }
}

// Initialize quality settings
document.addEventListener('DOMContentLoaded', () => {
    selectQuality('auto');
});

// Left Panel functionality
function toggleLeftPanel() {
    const panel = document.getElementById('leftPanel');
    panel.classList.toggle('open');
}

// Playlist functionality
let playlist = JSON.parse(localStorage.getItem('videoPlaylist') || '[]');
let currentPlaylistIndex = -1;
let playlistSortOrder = 'dateAdded'; // 'dateAdded', 'title', 'duration'

function addToPlaylist() {
    const url = document.getElementById('videoUrl').value.trim();
    if (!url) {
        toastr.error('Wprowadź link do filmu');
        return;
    }

    const title = prompt('Podaj tytuł filmu:', 'Bez tytułu') || 'Bez tytułu';

    // Check if URL already exists
    if (playlist.some(item => item.url === url)) {
        toastr.warning('Ten film jest już w playliście');
        return;
    }

    const newItem = {
        url,
        title,
        dateAdded: new Date().toISOString(),
        duration: '0:00',
        lastPlayed: null,
        playCount: 0
    };

    playlist.push(newItem);
    savePlaylist();
    renderPlaylist();
    updatePlaylistStats();
    toastr.success('Film dodany do playlisty');
}

function removeFromPlaylist(index) {
    if (confirm('Czy na pewno chcesz usunąć ten film z playlisty?')) {
        playlist.splice(index, 1);
        if (currentPlaylistIndex === index) {
            currentPlaylistIndex = -1;
        } else if (currentPlaylistIndex > index) {
            currentPlaylistIndex--;
        }
        savePlaylist();
        renderPlaylist();
        updatePlaylistStats();
        toastr.info('Film usunięty z playlisty');
    }
}

function playPlaylistItem(index) {
    if (index >= 0 && index < playlist.length) {
        currentPlaylistIndex = index;
        document.getElementById('videoUrl').value = playlist[index].url;
        playlist[index].lastPlayed = new Date().toISOString();
        playlist[index].playCount++;
        savePlaylist();
        loadVideoUrl();
        renderPlaylist();
        toastr.success(`Odtwarzanie: ${playlist[index].title}`);
    }
}

function clearPlaylist() {
    if (confirm('Czy na pewno chcesz wyczyścić playlistę?')) {
        playlist = [];
        currentPlaylistIndex = -1;
        savePlaylist();
        renderPlaylist();
        updatePlaylistStats();
        toastr.info('Playlista wyczyszczona');
    }
}

function savePlaylist() {
    localStorage.setItem('videoPlaylist', JSON.stringify(playlist));
}

function sortPlaylist(order) {
    playlistSortOrder = order;
    switch (order) {
        case 'dateAdded':
            playlist.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
        case 'title':
            playlist.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'duration':
            playlist.sort((a, b) => {
                const timeA = a.duration.split(':').map(Number);
                const timeB = b.duration.split(':').map(Number);
                return (timeB[0] * 60 + timeB[1]) - (timeA[0] * 60 + timeA[1]);
            });
            break;
        case 'lastPlayed':
            playlist.sort((a, b) => {
                if (!a.lastPlayed && !b.lastPlayed) return 0;
                if (!a.lastPlayed) return 1;
                if (!b.lastPlayed) return -1;
                return new Date(b.lastPlayed) - new Date(a.lastPlayed);
            });
            break;
    }
    renderPlaylist();
}

function renderPlaylist() {
    const playlistItems = document.getElementById('playlistItems');

    if (playlist.length === 0) {
        playlistItems.innerHTML = '<div class="no-favorites">Playlista jest pusta</div>';
        return;
    }

    // Render playlist items
    playlistItems.innerHTML = playlist.map((item, index) => `
            <div class="playlist-item ${index === currentPlaylistIndex ? 'active' : ''}" 
                 onclick="playPlaylistItem(${index})">
                <div class="playlist-item-info">
                    <i class="fas fa-play"></i>
                    <div class="playlist-item-title" title="${item.title}">${item.title}</div>
                    <div class="playlist-item-meta">
                        <span class="duration">${item.duration}</span>
                        <span class="play-count">${item.playCount} odtworzeń</span>
                    </div>
                </div>
                <div class="playlist-item-actions">
                    <button class="control-btn" onclick="event.stopPropagation(); movePlaylistItem(${index}, -1)" 
                            title="Przesuń w górę" ${index === 0 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="control-btn" onclick="event.stopPropagation(); movePlaylistItem(${index}, 1)" 
                            title="Przesuń w dół" ${index === playlist.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="control-btn" onclick="event.stopPropagation(); removeFromPlaylist(${index})" 
                            title="Usuń">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
}

// Initialize playlist controls
function initializePlaylistControls() {
    const playlistControls = document.querySelector('.playlist-controls');
    playlistControls.innerHTML = `
            <button onclick="addToPlaylist()" class="control-btn">
                <i class="fas fa-plus"></i> 
            </button>
            <button onclick="clearPlaylist()" class="control-btn">
                <i class="fas fa-trash"></i> 
            </button>
            <select onchange="sortPlaylist(this.value)" class="form-select">
                <option value="dateAdded" ${playlistSortOrder === 'dateAdded' ? 'selected' : ''}>Data dodania</option>
                <option value="title" ${playlistSortOrder === 'title' ? 'selected' : ''}>Tytuł</option>
                <option value="duration" ${playlistSortOrder === 'duration' ? 'selected' : ''}>Czas trwania</option>
                <option value="lastPlayed" ${playlistSortOrder === 'lastPlayed' ? 'selected' : ''}>Ostatnio odtwarzane</option>
            </select>
        `;
}

// Initialize playlist on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePlaylistControls();
    renderPlaylist();
    updatePlaylistStats();

    // Initialize toastr
    toastr.options = {
        "closeButton": true,
        "progressBar": true,
        "positionClass": "toast-top-right",
        "timeOut": "3000"
    };
});

function movePlaylistItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < playlist.length) {
        const item = playlist[index];
        playlist.splice(index, 1);
        playlist.splice(newIndex, 0, item);
        if (currentPlaylistIndex === index) {
            currentPlaylistIndex = newIndex;
        }
        savePlaylist();
        renderPlaylist();
    }
}

function updatePlaylistStats() {
    const playlistCount = document.getElementById('playlistCount');
    const totalDuration = document.getElementById('totalDuration');
    const currentPlayback = document.getElementById('currentPlayback');

    playlistCount.textContent = playlist.length;

    // Calculate total duration
    const totalSeconds = playlist.reduce((acc, item) => {
        const [minutes, seconds] = item.duration.split(':').map(Number);
        return acc + (minutes * 60 + seconds);
    }, 0);

    totalDuration.textContent = formatTime(totalSeconds);
    currentPlayback.textContent = `${currentPlaylistIndex + 1}/${playlist.length}`;

    // Update playlist info
    const playlistInfo = document.querySelector('.playlist-info');
    const totalPlays = playlist.reduce((acc, item) => acc + (item.playCount || 0), 0);
    playlistInfo.innerHTML = `
            <div>Liczba filmów: <span id="playlistCount">${playlist.length}</span></div>
            <div class="playlist-stats">
                <span>Całkowity czas: <span id="totalDuration">${formatTime(totalSeconds)}</span></span>
                <span>Odtwarzanie: <span id="currentPlayback">${currentPlaylistIndex + 1}/${playlist.length}</span></span>
                <span>Łączna liczba odtworzeń: ${totalPlays}</span>
            </div>
        `;
}

// Update video duration in playlist when video loads
video.addEventListener('loadedmetadata', () => {
    if (currentPlaylistIndex >= 0) {
        playlist[currentPlaylistIndex].duration = formatTime(video.duration);
        savePlaylist();
        renderPlaylist();
        updatePlaylistStats();
    }
});

// Links functionality
let links = JSON.parse(localStorage.getItem('links')) || [];

function addLink() {
    const nameInput = document.getElementById('linkName');
    const urlInput = document.getElementById('linkUrl');

    if (nameInput.value && urlInput.value) {
        links.push({
            name: nameInput.value,
            url: urlInput.value
        });

        saveLinks();
        renderLinks();

        // Clear inputs
        nameInput.value = '';
        urlInput.value = '';
    }
}

function deleteLink(index) {
    links.splice(index, 1);
    saveLinks();
    renderLinks();
}

function saveLinks() {
    localStorage.setItem('links', JSON.stringify(links));
}

function renderLinks() {
    const linksList = document.getElementById('linksList');
    linksList.innerHTML = '';

    if (links.length === 0) {
        linksList.innerHTML = '<div class="no-favorites">Brak zapisanych linków</div>';
        return;
    }

    links.forEach((link, index) => {
        const linkElement = document.createElement('div');
        linkElement.className = 'link-item';
        linkElement.innerHTML = `
                <a href="#" onclick="playLink('${link.url}'); return false;">${link.name}</a>
                <button onclick="deleteLink(${index})" title="Usuń">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        linksList.appendChild(linkElement);
    });
}

function playLink(url) {
    document.getElementById('videoUrl').value = url;
    loadVideoUrl();
    toggleLeftPanel(); // Zamyka panel po wybraniu linku
}

// Initialize links on page load
document.addEventListener('DOMContentLoaded', () => {
    renderLinks();
});

// Mega.nz functionality
function toggleMegaModal() {
    const modal = document.getElementById('megaModal');
    modal.classList.toggle('open');
}




// Initialize image settings on page load
document.addEventListener('DOMContentLoaded', () => {
    loadImageSettings();
});

// Add this function to your JavaScript section
function toggleControls() {
    const controlsContainer = document.querySelector('.controls-container');
    const toggleBtn = document.querySelector('.toggle-controls-btn');

    controlsContainer.classList.toggle('hidden');
    toggleBtn.classList.toggle('active');

    // Update button icon
    const icon = toggleBtn.querySelector('i');
    if (controlsContainer.classList.contains('hidden')) {
        icon.className = 'fas fa-th-large'; // Changed to toggle off icon

    } else {
        icon.className = 'fas fa-list-alt'; // Changed to toggle on icon

    }
}

function toggleFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');

    if (document.fullscreenElement) {
        document.exitFullscreen();
        fullscreenIcon.className = 'fas fa-expand';
    } else {
        document.documentElement.requestFullscreen();
        fullscreenIcon.className = 'fas fa-compress';
    }
}

// Add event listeners for fullscreen changes
document.addEventListener('fullscreenchange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');

    if (document.fullscreenElement) {
        fullscreenIcon.className = 'fas fa-compress';
    } else {
        fullscreenIcon.className = 'fas fa-expand';
    }
});

document.addEventListener('webkitfullscreenchange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');

    if (document.webkitFullscreenElement) {
        fullscreenIcon.className = 'fas fa-compress';
    } else {
        fullscreenIcon.className = 'fas fa-expand';
    }
});

document.addEventListener('mozfullscreenchange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');

    if (document.mozFullScreenElement) {
        fullscreenIcon.className = 'fas fa-compress';
    } else {
        fullscreenIcon.className = 'fas fa-expand';
    }
});

document.addEventListener('MSFullscreenChange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');

    if (document.msFullscreenElement) {
        fullscreenIcon.className = 'fas fa-compress';
    } else {
        fullscreenIcon.className = 'fas fa-expand';
    }
});

// Add this to your JavaScript section
function updatePlayButtonIcon() {
    const playBtn = document.getElementById('playBtn');
    const playIcon = playBtn.querySelector('i');

    if (video.paused) {
        playIcon.className = 'fas fa-circle-play';
    } else {
        playIcon.className = 'fas fa-circle-pause';
    }
}

// Add these event listeners to your DOMContentLoaded event listener
video.addEventListener('play', updatePlayButtonIcon);
video.addEventListener('pause', updatePlayButtonIcon);

function toggleAmbient() {
    const decoyVideo = document.getElementById('decoyVideo');
    const toggleBtn = document.querySelector('.toggle-image-btn');
    isAmbientEnabled = !isAmbientEnabled;

    if (!isAmbientEnabled) {
        decoyVideo.classList.add('ambient-disabled');
        toggleBtn.classList.remove('active');
        toggleBtn.querySelector('i').style.color = '';
    } else {
        decoyVideo.classList.remove('ambient-disabled');
        toggleBtn.classList.add('active');
        toggleBtn.querySelector('i').style.color = 'rgb(208, 255, 0)';
    }

    // Save ambient state to localStorage
    localStorage.setItem('ambientEnabled', isAmbientEnabled);
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // Load ambient state from localStorage
    const savedAmbientState = localStorage.getItem('ambientEnabled');
    if (savedAmbientState !== null) {
        isAmbientEnabled = savedAmbientState === 'true';
        if (!isAmbientEnabled) {
            const decoyVideo = document.getElementById('decoyVideo');
            const toggleBtn = document.querySelector('.toggle-image-btn');
            decoyVideo.classList.add('ambient-disabled');
            toggleBtn.classList.remove('active');
        } else {
            const toggleBtn = document.querySelector('.toggle-image-btn');
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('i').style.color = 'rgb(208, 255, 0)';
        }
    }
});
