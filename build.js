#!/usr/bin/env node
/* Builds one sales page per weekly event.

   template.html + events.json  ->  <event>/index.html  (e.g. oct-14/index.html)
                                    index.html          (sends visitors to the current event)

   Run with:  node build.js
   The "Deploy to SiteGround" workflow also runs it before every deploy, so the
   live pages always match events.json. No packages to install. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(root, 'events.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const tz = config.timezone || 'America/New_York';
/* Where visitors go once an event's offer ends: the weekly webinar
   registration page. Set once in events.json as "nextTrainingUrl". Leave it
   empty and closed pages stay up at full price instead of redirecting. */
const trainingUrl = (config.nextTrainingUrl || '').trim();
if (!trainingUrl) console.warn('build.js: events.json has no nextTrainingUrl, so closed pages will show full price instead of redirecting');

function fail(msg) { console.error('build.js: ' + msg); process.exit(1); }

/* "2026-10-19 23:59" in the events timezone -> a real instant plus its UTC
   offset, so daylight saving is handled without anyone typing -04:00/-05:00. */
function zoned(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(local || '');
  if (!m) fail('cartClose must look like "2026-10-19 23:59", got "' + local + '"');
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
    day: 'numeric', hour: 'numeric', minute: 'numeric'
  });
  for (let offsetMin = -14 * 60; offsetMin <= 14 * 60; offsetMin += 15) {
    const instant = new Date(Date.UTC(y, mo - 1, d, h, mi, 59) - offsetMin * 60000);
    const p = {};
    fmt.formatToParts(instant).forEach(x => { p[x.type] = Number(x.value); });
    if (p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi) {
      const sign = offsetMin < 0 ? '-' : '+';
      const abs = Math.abs(offsetMin);
      const pad = n => String(n).padStart(2, '0');
      const offset = sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
      return {
        instant,
        iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:59${offset}`
      };
    }
  }
  fail('could not place "' + local + '" in ' + tz);
}

function words(instant) {
  const part = opts => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: tz }, opts)).format(instant);
  const day = part({ weekday: 'long' });
  const date = day + ', ' + part({ month: 'long', day: 'numeric' });
  const time = part({ hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(/\s+/g, ' ');
  const zone = tz === 'America/New_York' ? 'ET'
    : part({ timeZoneName: 'short' }).split(' ').pop();
  return { day, date, long: `${date} at ${time} ${zone}` };
}

const banner = '<!-- GENERATED FILE - do not edit. Edit template.html or events.json, then run: node build.js -->\n';
const slugs = Object.keys(config.events || {});
if (!slugs.length) fail('events.json has no events');

const built = slugs.map(slug => {
  if (!/^[a-z0-9-]+$/.test(slug)) fail('event name "' + slug + '" should be lowercase letters, numbers and dashes, like oct-14');
  const ev = config.events[slug];
  if (!ev.checkoutUrl) fail(slug + ' is missing checkoutUrl');
  const close = zoned(ev.cartClose);
  const w = words(close.instant);
  const videoId = (ev.replayVideoId || '').trim();

  /* After the deadline the page sells at full price through the plain checkout
     link: "fullCheckoutUrl" if the event sets one, otherwise checkoutUrl with
     its ?coupon= removed. */
  let fullUrl = (ev.fullCheckoutUrl || '').trim();
  if (!fullUrl) {
    const u = new URL(ev.checkoutUrl);
    u.searchParams.delete('coupon');
    fullUrl = u.toString();
  }
  const amp = v => v.replace(/&(?!amp;)/g, '&amp;').replace(/"/g, '&quot;');

  const values = {
    DEADLINE_ISO: close.iso,
    DEADLINE_LONG: w.long,
    DEADLINE_DATE: w.date,
    DEADLINE_DAY: w.day,
    CHECKOUT_URL: amp(ev.checkoutUrl),
    CHECKOUT_URL_FULL: amp(fullUrl),
    TRAINING_URL: trainingUrl ? amp(trainingUrl) : '',
    TRAINING_LINK_OPEN: trainingUrl ? `<a href="${amp(trainingUrl)}">` : '',
    TRAINING_LINK_CLOSE: trainingUrl ? '</a>' : '',
    REPLAY_HIDDEN: videoId ? '' : ' hidden',
    REPLAY_SRC: videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&amp;rel=0` : ''
  };

  let html = template.replace(/\{\{([A-Z_]+)\}\}/g, (all, key) => {
    if (!(key in values)) fail('template.html uses {{' + key + '}} but build.js does not know it');
    return values[key];
  });
  /* The page lives one folder down, so images and video sit one level up. */
  html = html.replace(/\b(src|data-src|poster)="(?!https?:|\/\/|data:|#|\/|\.\.\/)([^"]+)"/g, '$1="../$2"');
  html = html.replace(/^<!DOCTYPE html>\n/i, m => m + banner);

  fs.mkdirSync(path.join(root, slug), { recursive: true });
  fs.writeFileSync(path.join(root, slug, 'index.html'), html);
  console.log(`${slug}/index.html  - offer ends ${w.long}  (${close.iso})` + (videoId ? '' : '  - replay banner hidden'));
  console.log(trainingUrl ? `    after that: redirects to ${trainingUrl}` : `    after that: full price via ${fullUrl}`);
  return { slug, close: close.iso, at: close.instant.getTime() };
}).sort((a, b) => a.at - b.at);

/* The bare folder URL forwards to whichever event is still open: the first
   one whose offer has not ended yet. Once all have ended it goes to the next
   training (or the most recent event when there is no training link). */
const list = JSON.stringify(built.map(e => ({ slug: e.slug, close: e.close })));
const last = built[built.length - 1].slug;
fs.writeFileSync(path.join(root, 'index.html'), `<!DOCTYPE html>
${banner}<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>Done-For-You Funnel Build · Whitney Bateson</title>
<script>
(function(){
  var events = ${list};
  var now = Date.now(), go = events[events.length - 1].slug + '/', open = false;
  for (var i = 0; i < events.length; i++) {
    if (Date.parse(events[i].close) > now) { go = events[i].slug + '/'; open = true; break; }
  }
  if (!open && ${JSON.stringify(trainingUrl)}) { location.replace(${JSON.stringify(trainingUrl)}); return; }
  location.replace(go + location.search + location.hash);
})();
</script>
<noscript><meta http-equiv="refresh" content="0; url=${last}/" /></noscript>
</head>
<body>
<p><a href="${last}/">Continue to the Done-For-You Funnel page</a></p>
</body>
</html>
`);
console.log('index.html  - forwards to the current event');
