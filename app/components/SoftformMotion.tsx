"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const SECTION_SELECTORS = ["#top", "#collection", "#create", "#process", ".quote-section", "footer"];
const CAMERA_STOPS = [
  { position: [0.2, 0.25, 10.4], target: [1.2, 0.2, 0], fov: 38 },
  { position: [-2.4, 0.85, 8.5], target: [0.4, 0.1, 0], fov: 44 },
  { position: [2.8, -0.15, 7.7], target: [-0.7, 0.2, -0.4], fov: 40 },
  { position: [-1.8, 1.7, 8.2], target: [0.5, -0.2, -1], fov: 46 },
  { position: [0, 0.3, 7.1], target: [0, 0, 0], fov: 37 },
  { position: [1.8, 1.2, 9.4], target: [0, -0.6, -1.4], fov: 45 },
] as const;

const damp = (current: number, target: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-rate * dt));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function createLathe(points: Array<[number, number]>, material: THREE.Material, segments = 72) {
  return new THREE.Mesh(
    new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments),
    material,
  );
}

function createLamp(material: THREE.Material) {
  const lamp = new THREE.Group();
  const stem = createLathe(
    [[0, -1.4], [0.58, -1.32], [0.72, -0.8], [0.5, -0.05], [0.4, 0.22], [0.32, 0.38], [0, 0.4]],
    material,
  );
  const shade = createLathe(
    [[0, 0], [0.32, 0.04], [0.95, 0.18], [1.45, 0.5], [1.58, 0.78], [1.5, 0.93], [0.25, 1.12], [0, 1.14]],
    material,
  );
  shade.position.y = 0.2;
  lamp.add(stem, shade);
  lamp.scale.setScalar(1.06);
  return lamp;
}

function createVase(material: THREE.Material) {
  const vase = createLathe(
    [[0.34, -1.2], [0.82, -1.12], [1.15, -0.62], [1.18, -0.05], [1.02, 0.55], [0.64, 0.92], [0.47, 1.18], [0.36, 1.22]],
    material,
  );
  const position = vase.geometry.attributes.position;
  const vector = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vector.fromBufferAttribute(position, index);
    const angle = Math.atan2(vector.z, vector.x);
    const ripple = 1 + Math.sin(angle * 5 + vector.y * 1.8) * 0.055;
    position.setXYZ(index, vector.x * ripple, vector.y, vector.z * ripple);
  }
  position.needsUpdate = true;
  vase.geometry.computeVertexNormals();
  return vase;
}

function createFilament(material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.6, -1.4, -1.4),
    new THREE.Vector3(-1.8, 1.8, 0.3),
    new THREE.Vector3(0.4, -1.1, 1.1),
    new THREE.Vector3(2.2, 1.55, -0.2),
    new THREE.Vector3(3.8, -0.2, -1.8),
  ]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.045, 10, false), material);
}

function createParticles(coarse: boolean) {
  const count = coarse ? 70 : 150;
  const data = new Float32Array(count * 3);
  let seed = 971;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < count; index += 1) {
    data[index * 3] = (random() - 0.5) * 12;
    data[index * 3 + 1] = (random() - 0.5) * 8;
    data[index * 3 + 2] = (random() - 0.5) * 8 - 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffd7bb,
    size: coarse ? 0.03 : 0.026,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

export function SoftformMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const root = document.documentElement;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sections = SECTION_SELECTORS
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((section): section is HTMLElement => Boolean(section));
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>(
      ".section-heading, .product-card, .create-intro, .studio-card, .steps article, .quote-section blockquote, .quote-section > p, .quote-section > a, footer > *",
    ));

    revealItems.forEach((item, index) => {
      item.classList.add("motion-item");
      item.style.setProperty("--motion-delay", `${(index % 4) * 85}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("motion-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9% 0px", threshold: 0.08 });
    revealItems.forEach((item) => observer.observe(item));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch {
      revealItems.forEach((item) => item.classList.add("motion-in"));
      root.classList.add("motion-fallback");
      return () => {
        observer.disconnect();
        root.classList.remove("motion-fallback");
      };
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    const world = new THREE.Group();
    scene.add(world);

    const porcelain = new THREE.MeshPhysicalMaterial({
      color: 0xffead6,
      roughness: 0.48,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      transmission: 0.2,
      thickness: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sageGlass = new THREE.MeshPhysicalMaterial({
      color: 0xbcc8b4,
      roughness: 0.34,
      transparent: true,
      opacity: 0.3,
      transmission: 0.52,
      thickness: 1.4,
      depthWrite: false,
    });
    const peachGlass = new THREE.MeshPhysicalMaterial({
      color: 0xf0aa80,
      roughness: 0.28,
      transparent: true,
      opacity: 0.42,
      transmission: 0.36,
      thickness: 0.9,
      depthWrite: false,
    });

    const lamp = createLamp(porcelain);
    lamp.position.set(3.1, -0.25, -0.6);
    lamp.rotation.set(0.08, -0.52, -0.04);
    world.add(lamp);

    const vase = createVase(sageGlass);
    vase.position.set(-3.2, -0.35, -1.1);
    vase.rotation.y = 0.4;
    world.add(vase);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.11, 20, 110), peachGlass);
    ring.position.set(0.2, 0.3, 0.4);
    ring.rotation.set(0.75, 0.25, -0.3);
    world.add(ring);

    const filament = createFilament(peachGlass);
    filament.position.z = -1.2;
    world.add(filament);

    const particles = createParticles(coarse);
    world.add(particles);

    scene.add(new THREE.HemisphereLight(0xfff5e8, 0x6f806c, 2.4));
    const key = new THREE.DirectionalLight(0xffd5b8, 3.2);
    key.position.set(4, 6, 7);
    scene.add(key);
    const fill = new THREE.PointLight(0xbfd2b6, 14, 15, 2);
    fill.position.set(-4, 1, 3);
    scene.add(fill);

    const positionCurve = new THREE.CatmullRomCurve3(
      CAMERA_STOPS.map((stop) => new THREE.Vector3(...stop.position)), false, "catmullrom", 0.42,
    );
    const targetCurve = new THREE.CatmullRomCurve3(
      CAMERA_STOPS.map((stop) => new THREE.Vector3(...stop.target)), false, "catmullrom", 0.42,
    );

    let anchors: number[] = [];
    let maxScroll = 1;
    let progress = 0;
    let smoothProgress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let cursorTargetX = cursorX;
    let cursorTargetY = cursorY;
    let running = !document.hidden;
    let frameId = 0;
    let previousTime = performance.now();
    let lastScrollY = window.scrollY;
    let navHidden = false;
    let renderScale = 1;
    let perfTime = 0;
    let perfFrames = 0;
    const cameraPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const header = document.querySelector<HTMLElement>(".site-header");
    const hero = document.querySelector<HTMLElement>(".hero");
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".product-card"));
    const railButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-motion-rail] button"));
    const cursor = document.querySelector<HTMLElement>("[data-motion-cursor]");

    const getWidth = () => document.documentElement.clientWidth || window.innerWidth;
    const getHeight = () => document.documentElement.clientHeight || window.innerHeight;

    function measure() {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - getHeight());
      anchors = sections.map((section, index) => {
        if (index === 0) return 0;
        if (index === sections.length - 1) return maxScroll;
        return THREE.MathUtils.clamp(section.offsetTop + section.offsetHeight * 0.5 - getHeight() * 0.5, 0, maxScroll);
      });
      for (let index = 1; index < anchors.length; index += 1) anchors[index] = Math.max(anchors[index], anchors[index - 1] + 1);
    }

    function progressFor(scrollY: number) {
      if (!anchors.length || scrollY <= anchors[0]) return 0;
      for (let index = 0; index < anchors.length - 1; index += 1) {
        if (scrollY <= anchors[index + 1]) {
          return index + (scrollY - anchors[index]) / Math.max(1, anchors[index + 1] - anchors[index]);
        }
      }
      return Math.max(0, anchors.length - 1);
    }

    function resize() {
      const width = getWidth();
      const height = getHeight();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.65) * renderScale;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      measure();
    }

    function applyCamera() {
      const segments = Math.max(1, CAMERA_STOPS.length - 1);
      const unit = THREE.MathUtils.clamp(smoothProgress / segments, 0, 1);
      positionCurve.getPoint(unit, cameraPosition);
      targetCurve.getPoint(unit, cameraTarget);

      const stopIndex = Math.min(segments - 1, Math.floor(smoothProgress));
      const local = THREE.MathUtils.clamp(smoothProgress - stopIndex, 0, 1);
      let fov = THREE.MathUtils.lerp(CAMERA_STOPS[stopIndex].fov, CAMERA_STOPS[stopIndex + 1].fov, local);
      const tallFrame = THREE.MathUtils.clamp((1.15 - camera.aspect) / 0.55, 0, 1);
      const direction = cameraPosition.clone().sub(cameraTarget).normalize();
      cameraPosition.addScaledVector(direction, tallFrame * 3.1);
      cameraPosition.y += tallFrame * 0.35;
      fov *= 1 + tallFrame * 0.2;

      const parallax = 1 - smoothstep(0, 1.7, smoothProgress) * 0.48;
      cameraPosition.x += pointerX * 0.42 * parallax;
      cameraPosition.y += pointerY * 0.24 * parallax;
      cameraTarget.x -= pointerX * 0.12 * parallax;
      cameraTarget.y -= pointerY * 0.07 * parallax;
      camera.position.copy(cameraPosition);
      camera.lookAt(cameraTarget);
      if (Math.abs(camera.fov - fov) > 0.001) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    function updateWorld(time: number, dt: number) {
      const stage = smoothProgress;
      const collection = smoothstep(0.55, 1.25, stage);
      const create = smoothstep(1.55, 2.4, stage);
      const process = smoothstep(2.55, 3.4, stage);
      const closing = smoothstep(3.65, 4.55, stage);

      lamp.rotation.y = -0.52 + stage * 0.33 + Math.sin(time * 0.00035) * 0.08;
      lamp.rotation.x = 0.08 + Math.sin(time * 0.00022) * 0.025;
      lamp.position.x = THREE.MathUtils.lerp(3.1, 1.1, collection);
      lamp.position.y = -0.25 + Math.sin(time * 0.00042) * 0.09 + closing * 0.55;
      lamp.scale.setScalar(THREE.MathUtils.lerp(1.06, 0.72, create) + closing * 0.28);

      vase.rotation.y = 0.4 - stage * 0.28;
      vase.position.x = THREE.MathUtils.lerp(-3.2, -1.2, collection);
      vase.position.y = -0.35 + Math.sin(time * 0.00032 + 1.2) * 0.07 - process * 0.45 + closing * 0.75;
      vase.scale.setScalar(0.88 + create * 0.22 - process * 0.18 + closing * 0.28);

      ring.rotation.x = 0.75 + stage * 0.42;
      ring.rotation.y = 0.25 + time * 0.00016;
      ring.rotation.z = -0.3 - stage * 0.18;
      ring.position.x = 0.2 + Math.sin(stage * 1.7) * 0.7;
      ring.position.y = 0.3 + create * 1.05 - process * 0.7;
      ring.scale.setScalar(0.82 + create * 0.55 - closing * 0.2);

      filament.rotation.z = stage * 0.12;
      filament.rotation.y = Math.sin(time * 0.00015) * 0.14;
      filament.position.y = THREE.MathUtils.lerp(-1.4, 0.55, process) - closing * 0.9;
      filament.scale.setScalar(0.84 + process * 0.34);
      particles.rotation.y += dt * 0.025;
      particles.position.y = Math.sin(time * 0.00016) * 0.16;

      const sectionPulse = 0.82 + Math.sin(time * 0.00045) * 0.06;
      porcelain.opacity = (0.28 + collection * 0.1 + closing * 0.1) * sectionPulse;
      sageGlass.opacity = 0.22 + create * 0.12 + closing * 0.08;
      peachGlass.opacity = 0.27 + process * 0.13;
    }

    function updateDom() {
      const y = window.scrollY;
      const heroExit = THREE.MathUtils.clamp(y / Math.max(1, getHeight() * 0.72), 0, 1);
      root.style.setProperty("--hero-copy-y", `${(heroExit * 48).toFixed(1)}px`);
      root.style.setProperty("--hero-copy-alpha", String((1 - smoothstep(0.08, 0.82, heroExit)).toFixed(3)));
      root.style.setProperty("--hero-image-scale", String((1.015 + heroExit * 0.065).toFixed(4)));
      root.style.setProperty("--hero-image-shift", `${(-heroExit * 22).toFixed(1)}px`);
      root.style.setProperty("--hero-note-alpha", String((1 - smoothstep(0, 0.42, heroExit)).toFixed(3)));
      root.style.setProperty("--hero-note-y", `${(smoothstep(0, 0.42, heroExit) * 18).toFixed(1)}px`);
      hero?.classList.toggle("motion-leaving", heroExit > 0.02);

      header?.classList.toggle("motion-stuck", y > 52);
      const scrollDelta = y - lastScrollY;
      if (scrollDelta > 4 && y > getHeight() * 0.82) navHidden = true;
      else if (scrollDelta < -4 || y < 80) navHidden = false;
      header?.classList.toggle("motion-hidden", navHidden);
      if (Math.abs(scrollDelta) > 0.5) lastScrollY = y;

      const active = Math.round(progressFor(y));
      railButtons.forEach((button, index) => button.classList.toggle("active", index === active));
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const drift = THREE.MathUtils.clamp((center - getHeight() / 2) / getHeight(), -1, 1) * -16;
        card.style.setProperty("--card-drift", `${drift.toFixed(1)}px`);
      });
    }

    function render(now: number) {
      if (!running) return;
      const rawDt = Math.max(0, (now - previousTime) / 1000);
      const dt = Math.min(rawDt || 0.016, 0.05);
      previousTime = now;
      progress = progressFor(window.scrollY);
      smoothProgress = reduced ? progress : damp(smoothProgress, progress, 5.1, dt);
      pointerX = damp(pointerX, pointerTargetX, 2.7, dt);
      pointerY = damp(pointerY, pointerTargetY, 2.7, dt);
      cursorX = damp(cursorX, cursorTargetX, 13, dt);
      cursorY = damp(cursorY, cursorTargetY, 13, dt);

      applyCamera();
      updateWorld(now, dt);
      updateDom();
      if (cursor && !coarse) cursor.style.transform = `translate3d(${cursorX.toFixed(1)}px,${cursorY.toFixed(1)}px,0)`;
      renderer.render(scene, camera);

      if (!reduced && now > 2500) {
        perfTime += rawDt;
        perfFrames += 1;
        if (perfFrames >= 45) {
          const average = perfTime / perfFrames;
          perfFrames = 0;
          perfTime = 0;
          if (average > 0.025 && renderScale > 0.58) {
            renderScale = Math.max(0.58, renderScale * 0.84);
            resize();
          } else if (average < 0.0145 && renderScale < 1) {
            renderScale = Math.min(1, renderScale + 0.07);
            resize();
          }
        }
      }
      if (!reduced) frameId = requestAnimationFrame(render);
    }

    function handlePointer(event: PointerEvent) {
      cursorTargetX = event.clientX;
      cursorTargetY = event.clientY;
      pointerTargetX = (event.clientX / getWidth()) * 2 - 1;
      pointerTargetY = -((event.clientY / getHeight()) * 2 - 1);
    }

    function handleVisibility() {
      running = !document.hidden;
      if (running && !reduced) {
        previousTime = performance.now();
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(render);
      }
    }

    function setCursorState(event: Event) {
      const interactive = (event.target as HTMLElement | null)?.closest("a, button, input, select, .upload-zone");
      cursor?.classList.toggle("active", Boolean(interactive));
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(document.body);
    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("pointerover", setCursorState, { passive: true });
    window.addEventListener("pointerout", setCursorState, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("orientationchange", resize, { passive: true });
    root.classList.add("motion-ready");
    resize();
    smoothProgress = progressFor(window.scrollY);
    previousTime = performance.now();
    frameId = requestAnimationFrame(render);

    let reducedScrollHandler: (() => void) | null = null;
    if (reduced) {
      updateDom();
      applyCamera();
      updateWorld(performance.now(), 0);
      renderer.render(scene, camera);
      reducedScrollHandler = () => {
        progress = smoothProgress = progressFor(window.scrollY);
        updateDom();
        applyCamera();
        updateWorld(performance.now(), 0);
        renderer.render(scene, camera);
      };
      window.addEventListener("scroll", reducedScrollHandler, { passive: true });
    }

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("pointerover", setCursorState);
      window.removeEventListener("pointerout", setCursorState);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("orientationchange", resize);
      if (reducedScrollHandler) window.removeEventListener("scroll", reducedScrollHandler);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose?.();
      });
      renderer.dispose();
      root.classList.remove("motion-ready");
    };
  }, []);

  function jumpTo(index: number) {
    const target = document.querySelector<HTMLElement>(SECTION_SELECTORS[index]);
    if (!target) return;
    target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return (
    <>
      <canvas ref={canvasRef} className="motion-canvas" aria-hidden="true" />
      <nav className="motion-rail" data-motion-rail aria-label="页面章节">
        {["首页", "作品", "定制", "工艺", "理念", "页尾"].map((label, index) => (
          <button key={label} type="button" aria-label={label} onClick={() => jumpTo(index)}><i /></button>
        ))}
      </nav>
      <div className="motion-cursor" data-motion-cursor aria-hidden="true" />
    </>
  );
}
