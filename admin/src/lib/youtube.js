/**
 * Reads a video's length with the YouTube IFrame API (SPEC §7). The player is loaded from the
 * privacy-enhanced domain (youtube-nocookie.com), in a hidden frame, so nothing is shown to the admin
 * except the result. The length is then saved on the lesson.
 */

let apiPromise = null;

function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('The YouTube player could not load.'));
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/**
 * @param {string} youtubeId 11-character ID already validated by the server
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<number>} duration in whole seconds
 */
export async function readVideoDuration(youtubeId, { timeoutMs = 15000 } = {}) {
  const YT = await loadIframeApi();
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
  document.body.appendChild(host);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error('The video length did not load. Try again.')),
      timeoutMs
    );
    let player;
    const finish = (result) => {
      clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        // already gone
      }
      host.remove();
      result instanceof Error ? reject(result) : resolve(result);
    };
    player = new YT.Player(host, {
      host: 'https://www.youtube-nocookie.com',
      videoId: youtubeId,
      playerVars: { modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (e) => {
          const seconds = Math.round(e.target.getDuration());
          if (seconds > 0) finish(seconds);
        },
        onError: () =>
          finish(
            new Error(
              'YouTube did not play this video. Check that it is set to Unlisted, not Private.'
            )
          ),
      },
    });
  });
}
