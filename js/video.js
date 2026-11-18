/*
 * Reconnaissance et sécurisation des liens de vidéos (YouTube pour le lecteur intégré).
 *
 * parseVideoUrl(texte) renvoie :
 *   - { kind: 'youtube', id, list, start, embed, watch }  pour un lien YouTube lisible dans l'app
 *   - { kind: 'link', href, host }                        pour tout autre lien http(s) (ouverture externe seule)
 *   - null                                                si ce n'est pas une URL http(s) valide
 * Seuls les protocoles http et https sont acceptés : un lien « javascript: » ou « data: » est refusé.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MC_VIDEO = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;
  const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

  // « 90 », « 1m30s », « 1h2m3s » -> secondes
  function parseStart(v) {
    if (!v) return 0;
    if (/^\d+$/.test(v)) return Math.min(parseInt(v, 10), 86400 * 2);
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
    if (!m || (!m[1] && !m[2] && !m[3])) return 0;
    return Math.min((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0), 86400 * 2);
  }

  function parseVideoUrl(input) {
    if (typeof input !== 'string') return null;
    let text = input.trim();
    if (!text || text.length > 600) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = 'https://' + text;   // « youtu.be/xxx » sans protocole
    let u;
    try { u = new URL(text); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname || !u.hostname.includes('.')) return null;
    const host = u.hostname.toLowerCase();
    const q = u.searchParams;

    let id = null;
    let list = null;
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
    } else if (YT_HOSTS.has(host)) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'watch') id = q.get('v');
      else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1];
      if (parts[0] === 'playlist' || q.get('list')) list = q.get('list');
    } else {
      return { kind: 'link', href: u.href, host: host.replace(/^www\./, '') };
    }

    const idOk = id && ID_RE.test(id);
    const listOk = list && LIST_RE.test(list);
    if (!idOk && !listOk) return { kind: 'link', href: u.href, host: host.replace(/^www\./, '') };

    const start = idOk ? parseStart(q.get('t') || q.get('start')) : 0;
    const params = ['rel=0', 'playsinline=1'];
    if (start) params.push('start=' + start);
    let embed;
    if (idOk) {
      if (listOk) params.push('list=' + list);
      embed = `https://www.youtube-nocookie.com/embed/${id}?${params.join('&')}`;
    } else {
      embed = `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&${params.join('&')}`;
    }
    const watch = idOk
      ? `https://www.youtube.com/watch?v=${id}${listOk ? '&list=' + list : ''}${start ? '&t=' + start + 's' : ''}`
      : `https://www.youtube.com/playlist?list=${list}`;
    return { kind: 'youtube', id: idOk ? id : null, list: listOk ? list : null, start, embed, watch };
  }

  return { parseVideoUrl, parseStart };
});
