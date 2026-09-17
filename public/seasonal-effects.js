(() => {
  const WINTER_START = { month: 11, day: 21 }; // December 21
  const SPRING_START = { month: 2, day: 20 };  // March 20
  const FALL_START = { month: 8, day: 1 };     // September 1
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function seasonFor(date = new Date()) {
    const md = (date.getMonth() * 100) + date.getDate();
    if (md >= 1121 || md < 220) return 'winter';
    if (md >= 801) return 'fall';
    return 'none';
  }

  const season = seasonFor();
  document.documentElement.dataset.season = season;
  if (season === 'none' || reducedMotion) return;

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
    opacity: season === 'fall' ? '0.82' : '0.78'
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  const colors = ['#a95735', '#c68a42', '#713a35', '#87906f', '#d0a565'];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let animationFrame = 0;
  let lastTime = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function leaf(fromTop = false) {
    const size = 7 + Math.random() * 13;
    return {
      kind: Math.random() < 0.82 ? 'leaf' : 'ember',
      x: Math.random() * width,
      y: fromTop ? -30 - Math.random() * height * 0.25 : Math.random() * height,
      size,
      speed: 16 + Math.random() * 27,
      drift: 12 + Math.random() * 24,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.7,
      rotation: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.38 + Math.random() * 0.48
    };
  }

  function snow(fromTop = false) {
    const size = 1.4 + Math.random() * 4.2;
    return {
      kind: 'snow',
      x: Math.random() * width,
      y: fromTop ? -15 - Math.random() * height * 0.2 : Math.random() * height,
      size,
      speed: 17 + size * 7 + Math.random() * 18,
      drift: 7 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.55
    };
  }

  function seed() {
    const mobile = width < 700;
    const count = season === 'fall' ? (mobile ? 22 : 42) : (mobile ? 34 : 70);
    particles = Array.from({ length: count }, () => season === 'fall' ? leaf(false) : snow(false));
  }

  function resetParticle(p) {
    const fresh = season === 'fall' ? leaf(true) : snow(true);
    Object.assign(p, fresh);
  }

  function drawLeaf(p, t) {
    if (p.kind === 'ember') {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 0.65);
      glow.addColorStop(0, 'rgba(255,180,70,.85)');
      glow.addColorStop(0.35, 'rgba(232,103,35,.45)');
      glow.addColorStop(1, 'rgba(232,103,35,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation + Math.sin(t * 0.001 + p.phase) * 0.35);
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

  function drawSnow(p) {
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
      p.y += p.speed * dt;
      p.x += Math.sin(now * 0.00065 + p.phase) * p.drift * dt;
      if (season === 'fall') p.rotation += p.spin * dt;
      if (p.y > height + 35 || p.x < -50 || p.x > width + 50) resetParticle(p);
      season === 'fall' ? drawLeaf(p, now) : drawSnow(p);
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