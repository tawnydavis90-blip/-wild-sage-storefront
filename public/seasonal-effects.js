(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function seasonFor(date = new Date()) {
    const md = (date.getMonth() * 100) + date.getDate();
    if (md >= 1121 || md < 220) return 'winter'; // Dec 21–Mar 19
    if (md < 520) return 'spring';                // Mar 20–Jun 19
    if (md < 801) return 'summer';                // Jun 20–Aug 31
    return 'fall';                                // Sep 1–Dec 20
  }

  function celebrationFor(date = new Date()) {
    const md = (date.getMonth() * 100) + date.getDate();
    const celebrations = [
      { start: 219, end: 221, id: 'spring-equinox', message: 'SPRING EQUINOX ✦ BEGIN AGAIN', sigil: '✦' },
      { start: 519, end: 521, id: 'summer-solstice', message: 'SUMMER SOLSTICE ✦ FOLLOW THE LIGHT', sigil: '☼' },
      { start: 821, end: 823, id: 'autumn-equinox', message: 'AUTUMN EQUINOX ✦ BALANCE IN ALL THINGS', sigil: '☾' },
      { start: 1120, end: 1122, id: 'winter-solstice', message: 'WINTER SOLSTICE ✦ RETURN TO THE LIGHT', sigil: '✧' }
    ];
    return celebrations.find(item => md >= item.start && md <= item.end) || null;
  }

  const season = seasonFor();
  const celebration = celebrationFor();
  document.documentElement.dataset.season = season;

  if (celebration) {
    document.documentElement.dataset.seasonalCelebration = celebration.id;
    const announcement = document.querySelector('.announcement span:first-child');
    if (announcement) announcement.textContent = celebration.message;

    const style = document.createElement('style');
    style.textContent = `
      #seasonal-celestial-frame{position:fixed;inset:0;z-index:41;pointer-events:none;border:1px solid rgba(205,166,92,.32);box-shadow:inset 0 0 70px rgba(202,148,54,.07)}
      #seasonal-celestial-frame::before,#seasonal-celestial-frame::after{position:absolute;color:rgba(220,180,95,.72);font-family:serif;text-shadow:0 0 14px rgba(238,181,69,.65)}
      #seasonal-celestial-frame::before{content:attr(data-sigil);left:16px;top:54px;font-size:44px}
      #seasonal-celestial-frame::after{content:"✦  ·  ✧  ·  ✦";right:18px;bottom:16px;font-size:17px;letter-spacing:.4em}
      #seasonal-celestial-frame .corner{position:absolute;width:86px;height:86px;opacity:.58;border-color:#cda65c}
      #seasonal-celestial-frame .tl{left:8px;top:44px;border-left:1px solid;border-top:1px solid}
      #seasonal-celestial-frame .tr{right:8px;top:44px;border-right:1px solid;border-top:1px solid}
      #seasonal-celestial-frame .bl{left:8px;bottom:8px;border-left:1px solid;border-bottom:1px solid}
      #seasonal-celestial-frame .br{right:8px;bottom:8px;border-right:1px solid;border-bottom:1px solid}
      @media(max-width:700px){#seasonal-celestial-frame .corner{width:46px;height:46px}#seasonal-celestial-frame::before{font-size:28px;top:48px}}
    `;
    document.head.appendChild(style);

    const frame = document.createElement('div');
    frame.id = 'seasonal-celestial-frame';
    frame.dataset.sigil = celebration.sigil;
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = '<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>';
    document.body.appendChild(frame);
  }

  if (reducedMotion) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'seasonal-effects';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '40',
    opacity: ({ spring: '0.72', summer: '0.74', fall: '0.82', winter: '0.78' })[season]
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  const fallColors = ['#a95735', '#c68a42', '#713a35', '#87906f', '#d0a565'];
  const springColors = ['#b97b86', '#879478', '#e8dfcf', '#987383', '#c49a9b'];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let animationFrame = 0;
  let lastTime = performance.now();

  function base(fromTop, margin = 30) {
    return {
      x: Math.random() * width,
      y: fromTop ? -margin - Math.random() * height * 0.25 : Math.random() * height,
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.52
    };
  }

  function fallParticle(fromTop = false) {
    const size = 7 + Math.random() * 13;
    return {
      ...base(fromTop),
      kind: Math.random() < 0.82 ? 'leaf' : 'ember',
      size,
      speed: 16 + Math.random() * 27,
      drift: 12 + Math.random() * 24,
      spin: (Math.random() - 0.5) * 1.7,
      color: fallColors[Math.floor(Math.random() * fallColors.length)]
    };
  }

  function springParticle(fromTop = false) {
    const size = 5 + Math.random() * 10;
    return {
      ...base(fromTop),
      kind: Math.random() < 0.84 ? 'petal' : 'pollen',
      size,
      speed: 10 + Math.random() * 20,
      drift: 10 + Math.random() * 22,
      spin: (Math.random() - 0.5) * 1.35,
      color: springColors[Math.floor(Math.random() * springColors.length)]
    };
  }

  function summerParticle(fromTop = false) {
    const moth = Math.random() < 0.07;
    return {
      ...base(false),
      kind: moth ? 'moth' : 'firefly',
      size: moth ? 7 + Math.random() * 5 : 1.2 + Math.random() * 2.6,
      speed: 4 + Math.random() * 8,
      drift: 7 + Math.random() * 18,
      direction: Math.random() < 0.5 ? -1 : 1,
      alpha: moth ? 0.22 + Math.random() * 0.18 : 0.38 + Math.random() * 0.5
    };
  }

  function winterParticle(fromTop = false) {
    const size = 1.4 + Math.random() * 4.2;
    return {
      ...base(fromTop, 15),
      kind: 'snow',
      size,
      speed: 17 + size * 7 + Math.random() * 18,
      drift: 7 + Math.random() * 18
    };
  }

  function createParticle(fromTop = false) {
    if (season === 'spring') return springParticle(fromTop);
    if (season === 'summer') return summerParticle(fromTop);
    if (season === 'fall') return fallParticle(fromTop);
    return winterParticle(fromTop);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mobile = width < 700;
    const counts = {
      spring: mobile ? 24 : 43,
      summer: mobile ? 25 : 48,
      fall: mobile ? 22 : 42,
      winter: mobile ? 34 : 70
    };
    const count = counts[season] + (celebration ? (mobile ? 5 : 12) : 0);
    particles = Array.from({ length: count }, () => createParticle(false));
  }

  function resetParticle(p) {
    Object.assign(p, createParticle(season !== 'summer'));
    if (season === 'summer') {
      p.x = p.direction > 0 ? -25 : width + 25;
      p.y = 25 + Math.random() * Math.max(height - 50, 1);
    }
  }

  function drawGlow(p, core, middle) {
    const radius = Math.max(p.size * 4.5, 7);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    glow.addColorStop(0, core);
    glow.addColorStop(0.25, middle);
    glow.addColorStop(1, 'rgba(232,150,45,0)');
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFall(p, now) {
    if (p.kind === 'ember') {
      drawGlow(p, 'rgba(255,190,85,.95)', 'rgba(232,103,35,.4)');
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation + Math.sin(now * 0.001 + p.phase) * 0.35);
    ctx.scale(1, 0.62);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.75, -p.size * 0.45, p.size * 0.75, p.size * 0.45, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.75, p.size * 0.45, -p.size * 0.75, -p.size * 0.45, 0, -p.size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,26,18,.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -p.size * 0.72);
    ctx.lineTo(0, p.size * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpring(p, now) {
    if (p.kind === 'pollen') {
      drawGlow(p, 'rgba(255,232,174,.72)', 'rgba(220,188,112,.22)');
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation + Math.sin(now * 0.001 + p.phase) * 0.28);
    ctx.scale(0.72, 1);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size, -p.size * 0.35, p.size * 0.8, p.size * 0.55, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.35, -p.size * 0.65, -p.size * 0.45, 0, -p.size);
    ctx.fill();
    ctx.restore();
  }

  function drawSummer(p, now) {
    if (p.kind === 'firefly') {
      const pulse = 0.58 + Math.sin(now * 0.003 + p.phase) * 0.32;
      ctx.save();
      ctx.globalAlpha = Math.max(0.12, p.alpha * pulse);
      drawGlow(p, 'rgba(255,225,126,.98)', 'rgba(215,157,55,.4)');
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(now * 0.0012 + p.phase) * 0.22);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#c7a56b';
    ctx.beginPath();
    ctx.ellipse(-p.size * 0.48, 0, p.size * 0.6, p.size * 0.28, -0.35, 0, Math.PI * 2);
    ctx.ellipse(p.size * 0.48, 0, p.size * 0.6, p.size * 0.28, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWinter(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(255,255,255,.65)';
    ctx.shadowBlur = p.size > 3.6 ? 5 : 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      if (season === 'summer') {
        p.x += p.speed * p.direction * dt;
        p.y += Math.sin(now * 0.0008 + p.phase) * p.drift * dt;
        if (p.x < -35 || p.x > width + 35 || p.y < -35 || p.y > height + 35) resetParticle(p);
        drawSummer(p, now);
        continue;
      }

      p.y += p.speed * dt;
      p.x += Math.sin(now * 0.00065 + p.phase) * p.drift * dt;
      if (season === 'fall' || season === 'spring') p.rotation += p.spin * dt;
      if (p.y > height + 35 || p.x < -50 || p.x > width + 50) resetParticle(p);
      if (season === 'spring') drawSpring(p, now);
      else if (season === 'fall') drawFall(p, now);
      else drawWinter(p);
    }
    animationFrame = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
    } else {
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(frame);
    }
  });
  animationFrame = requestAnimationFrame(frame);
})();