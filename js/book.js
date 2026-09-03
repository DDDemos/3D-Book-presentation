/**
 * Atelier 3D Interactive Book Engine
 * Built with Three.js (ES Module from jsDelivr)
 * 
 * Procedural luxury hardcover book, deckled page stacks, travertine pedestal,
 * realistic inextensible bending page-turn mechanics with non-mirrored reverse UVs.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { config } from './config.js';

export class BookScene {
  constructor(containerElement, onInitComplete) {
    this.container = containerElement;
    this.onInitComplete = onInitComplete;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.lights = {};
    
    // Textures & Materials
    this.textureLoader = new THREE.TextureLoader();
    this.slideTextures = new Map();
    this.coverTextures = {};
    this.materials = {};

    // 3D Objects
    this.plinth = null;
    this.bookGroup = null;
    this.coverLeft = null;
    this.coverRight = null;
    this.spineMesh = null;
    this.leftPageStack = null;
    this.rightPageStack = null;
    this.leftRestingPage = null;
    this.rightRestingPage = null;

    // Turning page
    this.turningPageGroup = null;
    this.turningFrontMesh = null;
    this.turningBackMesh = null;
    this.turningGeometry = null;
    this.isTurning = false;
    this.turnProgress = 0;
    this.turnDirection = 'next'; // 'next' or 'prev'
    this.turnStartTime = 0;
    this.turnDuration = config.book.turnDuration;
    this.onTurnComplete = null;

    // Current State
    this.currentSpreadIndex = 4; // Default spread 4 as in reference design
    this.totalSpreads = config.spreads.length;
    this.lightingMode = 'daylight'; // 'daylight' or 'chiaroscuro'
    this.paperStock = 'cotton-rag';

    // Interactive Camera controls (Smooth constrained rotation)
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0.55, y: 0.25 }; // Initial attractive 3/4 angle
    this.currentRotation = { x: 0.55, y: 0.25 };
    this.defaultRotation = { x: 0.55, y: 0.25 };
    this.targetElevation = config.book.initialElevation; // degrees
    this.zoomLevel = 1.0;

    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLighting();
    this.setupMaterials();
    this.buildPedestal();
    this.buildBook();
    this.setupTurningPage();
    this.setupEvents();

    // Initial render and display
    this.updateSpreadContent(this.currentSpreadIndex, false);
    this.animate();

    if (this.onInitComplete) {
      this.onInitComplete();
    }
  }

  setupScene() {
    this.scene = new THREE.Scene();
    // Neutral warm atmospheric fog to integrate smoothly with UI backdrop
    this.scene.fog = new THREE.FogExp2(0xfbf9f4, 0.022);
  }

  setupCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight || 1.6;
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 100);
    // Initial camera position looking down at book on travertine plinth
    this.updateCameraTransform();
  }

  updateCameraTransform() {
    const dist = 14.2 / this.zoomLevel;
    const phi = THREE.MathUtils.degToRad(90 - this.targetElevation) + (this.currentRotation.x - this.defaultRotation.x) * 0.45;
    const theta = (this.currentRotation.y - this.defaultRotation.y) * 0.65;

    const clampedPhi = Math.max(0.35, Math.min(1.45, phi));
    const clampedTheta = Math.max(-0.65, Math.min(0.65, theta));

    this.camera.position.x = dist * Math.sin(clampedPhi) * Math.sin(clampedTheta);
    this.camera.position.y = dist * Math.cos(clampedPhi) + 1.2;
    this.camera.position.z = dist * Math.sin(clampedPhi) * Math.cos(clampedTheta) + 1.8;

    // Look slightly above center of the book spread
    this.camera.lookAt(new THREE.Vector3(0, 0.35, 0));
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);
  }

  setupLighting() {
    // Ambient light
    this.lights.ambient = new THREE.AmbientLight(0xfcfaf5, 1.1);
    this.scene.add(this.lights.ambient);

    // Overhead natural skylight (Key light with soft raking shadow)
    this.lights.key = new THREE.DirectionalLight(0xfff6ea, 1.6);
    this.lights.key.position.set(4, 12, 6);
    this.lights.key.castShadow = true;
    this.lights.key.shadow.mapSize.width = 2048;
    this.lights.key.shadow.mapSize.height = 2048;
    this.lights.key.shadow.camera.near = 0.5;
    this.lights.key.shadow.camera.far = 30;
    this.lights.key.shadow.camera.left = -7;
    this.lights.key.shadow.camera.right = 7;
    this.lights.key.shadow.camera.top = 7;
    this.lights.key.shadow.camera.bottom = -7;
    this.lights.key.shadow.bias = -0.0004;
    this.lights.key.shadow.radius = 2.8;
    this.scene.add(this.lights.key);

    // Subtle bounce fill light simulating travertine reflection
    this.lights.fill = new THREE.DirectionalLight(0xf2ede2, 0.65);
    this.lights.fill.position.set(-6, 3, -4);
    this.scene.add(this.lights.fill);

    // Raking rim light highlighting page deckle edges
    this.lights.rim = new THREE.DirectionalLight(0xffffff, 0.4);
    this.lights.rim.position.set(0, 4, -8);
    this.scene.add(this.lights.rim);
  }

  setLightingAtmosphere(mode) {
    this.lightingMode = mode;
    if (mode === 'chiaroscuro') {
      // Dramatic evening gallery low light
      this.lights.ambient.color.setHex(0x2d2a26);
      this.lights.ambient.intensity = 0.5;

      this.lights.key.color.setHex(0xffdfa8);
      this.lights.key.intensity = 2.4;
      this.lights.key.position.set(7, 6, 4); // Low raking angle

      this.lights.fill.intensity = 0.2;
      this.lights.rim.intensity = 0.3;
      this.renderer.toneMappingExposure = 1.15;
      this.scene.fog.color.setHex(0x1a1918);
    } else {
      // Natural overhead museum daylight
      this.lights.ambient.color.setHex(0xfcfaf5);
      this.lights.ambient.intensity = 1.1;

      this.lights.key.color.setHex(0xfff6ea);
      this.lights.key.intensity = 1.6;
      this.lights.key.position.set(4, 12, 6);

      this.lights.fill.intensity = 0.65;
      this.lights.rim.intensity = 0.4;
      this.renderer.toneMappingExposure = 1.05;
      this.scene.fog.color.setHex(0xfbf9f4);
    }
  }

  setupMaterials() {
    // Travertine Plinth stone texture
    const travTex = this.loadTexture(config.book.travertine);
    travTex.wrapS = THREE.RepeatWrapping;
    travTex.wrapT = THREE.RepeatWrapping;
    travTex.repeat.set(2, 2);

    this.materials.plinth = new THREE.MeshStandardMaterial({
      map: travTex,
      roughness: 0.88,
      metalness: 0.05,
      color: 0xede6d8
    });

    // Hardcover cloth textures
    const frontTex = this.loadTexture(config.book.frontCover);
    const backTex = this.loadTexture(config.book.backCover);
    const spineTex = this.loadTexture(config.book.spine);

    this.materials.coverFront = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.72,
      metalness: 0.12,
      color: 0x1f1d1b
    });

    this.materials.coverBack = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.72,
      metalness: 0.12,
      color: 0x1f1d1b
    });

    this.materials.spine = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.78,
      metalness: 0.08,
      color: 0x22201e
    });

    // Page edges / paper block material (ribbed subtle grain)
    this.materials.pageBlock = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0.02,
      color: 0xede6d8
    });

    // Resting page materials (initially empty, assigned textures per spread)
    this.materials.leftResting = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.01,
      color: 0xfaf7f2,
      side: THREE.FrontSide
    });

    this.materials.rightResting = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.01,
      color: 0xfaf7f2,
      side: THREE.FrontSide
    });

    // Turning page materials (front and back)
    this.materials.turningFront = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.01,
      color: 0xfaf7f2,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    this.materials.turningBack = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.01,
      color: 0xfaf7f2,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
  }

  loadTexture(url) {
    const tex = this.textureLoader.load(
      url,
      undefined,
      undefined,
      (err) => {
        console.warn(`Texture could not load from ${url}, using aesthetic fallback`, err);
      }
    );
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildPedestal() {
    // Architectural Travertine stone pedestal/plinth as seen in reference image
    const plinthGeo = new THREE.BoxGeometry(13.8, 1.2, 10.4);
    this.plinth = new THREE.Mesh(plinthGeo, this.materials.plinth);
    this.plinth.position.set(0, -0.6, 0);
    this.plinth.receiveShadow = true;
    this.plinth.castShadow = true;
    this.scene.add(this.plinth);

    // Subtle dark contact shadow beneath the book on the plinth
    const shadowGeo = new THREE.PlaneGeometry(10.8, 7.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x161514,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.003, 0);
    this.scene.add(contactShadow);
  }

  buildBook() {
    this.bookGroup = new THREE.Group();
    this.scene.add(this.bookGroup);

    const pw = config.book.pageWidth;   // 4.8
    const ph = config.book.pageHeight;  // 6.4
    const cw = config.book.coverWidth;  // 4.95
    const ch = config.book.coverHeight; // 6.6
    const ct = config.book.coverThickness; // 0.08
    const sw = config.book.spineWidth;  // 0.46

    // 1. Left Hardcover (resting on plinth angled slightly upward)
    const coverGeo = new THREE.BoxGeometry(cw, ct, ch);
    this.coverLeft = new THREE.Mesh(coverGeo, this.materials.coverBack);
    this.coverLeft.position.set(-cw / 2 - sw / 2, ct / 2, 0);
    this.coverLeft.receiveShadow = true;
    this.coverLeft.castShadow = true;
    this.bookGroup.add(this.coverLeft);

    // 2. Right Hardcover
    this.coverRight = new THREE.Mesh(coverGeo, this.materials.coverFront);
    this.coverRight.position.set(cw / 2 + sw / 2, ct / 2, 0);
    this.coverRight.receiveShadow = true;
    this.coverRight.castShadow = true;
    this.bookGroup.add(this.coverRight);

    // 3. Curved Book Spine (Cloth binding)
    const spineGeo = new THREE.CylinderGeometry(sw * 0.52, sw * 0.52, ch, 24, 1, true, -Math.PI * 0.5, Math.PI);
    this.spineMesh = new THREE.Mesh(spineGeo, this.materials.spine);
    this.spineMesh.rotation.z = Math.PI / 2;
    this.spineMesh.rotation.y = Math.PI / 2;
    this.spineMesh.position.set(0, ct * 0.4, 0);
    this.bookGroup.add(this.spineMesh);

    // 4. Page Stacks (Visible paper blocks showing thickness)
    // Left stack:
    const stackGeoLeft = new THREE.BoxGeometry(pw, 0.16, ph);
    this.leftPageStack = new THREE.Mesh(stackGeoLeft, this.materials.pageBlock);
    this.leftPageStack.position.set(-pw / 2 - sw * 0.2, ct + 0.08, 0);
    this.leftPageStack.receiveShadow = true;
    this.leftPageStack.castShadow = true;
    this.bookGroup.add(this.leftPageStack);

    // Right stack:
    const stackGeoRight = new THREE.BoxGeometry(pw, 0.16, ph);
    this.rightPageStack = new THREE.Mesh(stackGeoRight, this.materials.pageBlock);
    this.rightPageStack.position.set(pw / 2 + sw * 0.2, ct + 0.08, 0);
    this.rightPageStack.receiveShadow = true;
    this.rightPageStack.castShadow = true;
    this.bookGroup.add(this.rightPageStack);

    // 5. Resting Pages (Static pages displaying current spread)
    // Subtle tilt for open book curvature
    const pageGeo = new THREE.PlaneGeometry(pw, ph, 16, 16);

    // Left resting page
    this.leftRestingPage = new THREE.Mesh(pageGeo, this.materials.leftResting);
    this.leftRestingPage.rotation.x = -Math.PI / 2;
    this.leftRestingPage.position.set(-pw / 2 - sw * 0.2, ct + 0.165, 0);
    this.leftRestingPage.receiveShadow = true;
    this.bookGroup.add(this.leftRestingPage);

    // Right resting page
    this.rightRestingPage = new THREE.Mesh(pageGeo.clone(), this.materials.rightResting);
    this.rightRestingPage.rotation.x = -Math.PI / 2;
    this.rightRestingPage.position.set(pw / 2 + sw * 0.2, ct + 0.165, 0);
    this.rightRestingPage.receiveShadow = true;
    this.bookGroup.add(this.rightRestingPage);
  }

  setupTurningPage() {
    const pw = config.book.pageWidth;
    const ph = config.book.pageHeight;
    const segmentsX = 80; // High resolution horizontal segments for silky-smooth travelling bend
    const segmentsY = 30; // High resolution vertical segments for diagonal corner lift

    this.segmentsX = segmentsX;
    this.segmentsY = segmentsY;

    this.turningPageGroup = new THREE.Group();
    this.turningPageGroup.visible = false;
    this.bookGroup.add(this.turningPageGroup);

    const vertexCount = (segmentsX + 1) * (segmentsY + 1);
    const positions = new Float32Array(vertexCount * 3);
    const uvsFront = new Float32Array(vertexCount * 2);
    const uvsBack = new Float32Array(vertexCount * 2);

    // Initial undeformed positions and exact UV coordinate mapping
    for (let j = 0; j <= segmentsY; j++) {
      const v = j / segmentsY; // 0 (bottom) to 1 (top)
      const z = (0.5 - v) * ph; // Top of page is at -Z (away from camera), bottom at +Z

      for (let i = 0; i <= segmentsX; i++) {
        const u = i / segmentsX; // 0 (spine hinge) to 1 (free outer edge)
        const x = u * pw;
        const y = 0;

        const idx = j * (segmentsX + 1) + i;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        // Front face UV: standard upright mapping on right page
        // u: 0 at spine, 1 at outer edge; v: 0 at bottom, 1 at top
        uvsFront[idx * 2] = u;
        uvsFront[idx * 2 + 1] = v;

        // Back face UV: standard upright mapping on left page
        // When turned over to the left, outer edge (u=1 on sheet) is on the left (u=0 on texture)
        // and spine (u=0 on sheet) is on the right (u=1 on texture).
        uvsBack[idx * 2] = 1.0 - u;
        uvsBack[idx * 2 + 1] = v;
      }
    }

    // Build triangle index arrays for Front (normal UP) and Back (normal DOWN)
    const indicesFront = [];
    const indicesBack = [];

    for (let j = 0; j < segmentsY; j++) {
      for (let i = 0; i < segmentsX; i++) {
        const a = j * (segmentsX + 1) + i;
        const b = j * (segmentsX + 1) + (i + 1);
        const c = (j + 1) * (segmentsX + 1) + (i + 1);
        const d = (j + 1) * (segmentsX + 1) + i;

        // Front face: normal points UP (+Y) when flat on the right
        indicesFront.push(a, b, d);
        indicesFront.push(b, c, d);

        // Back face: reversed triangle winding so normal points DOWN (-Y) when flat on the right,
        // and flips to point UP (+Y) when flat on the left!
        indicesBack.push(a, d, b);
        indicesBack.push(b, d, c);
      }
    }

    // 1. Front Geometry
    this.turningGeometry = new THREE.BufferGeometry();
    this.turningGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.turningGeometry.setAttribute('uv', new THREE.BufferAttribute(uvsFront, 2));
    this.turningGeometry.setIndex(indicesFront);
    this.turningGeometry.computeVertexNormals();

    this.turningFrontMesh = new THREE.Mesh(this.turningGeometry, this.materials.turningFront);
    this.turningFrontMesh.castShadow = true;
    this.turningFrontMesh.receiveShadow = true;
    this.turningPageGroup.add(this.turningFrontMesh);

    // 2. Back Geometry (shares the EXACT same position attribute buffer to ensure perfect physical cohesion)
    this.backGeometry = new THREE.BufferGeometry();
    this.backGeometry.setAttribute('position', this.turningGeometry.getAttribute('position'));
    this.backGeometry.setAttribute('uv', new THREE.BufferAttribute(uvsBack, 2));
    this.backGeometry.setIndex(indicesBack);
    this.backGeometry.computeVertexNormals();

    this.turningBackMesh = new THREE.Mesh(this.backGeometry, this.materials.turningBack);
    this.turningBackMesh.castShadow = true;
    this.turningBackMesh.receiveShadow = true;
    this.turningPageGroup.add(this.turningBackMesh);

    // Initial position of turning group at origin (coordinates computed in bookGroup coordinate space)
    this.turningPageGroup.position.set(0, 0, 0);
  }

  getStackThickness(spreadIndex, side) {
    const norm = (Math.max(1, Math.min(this.totalSpreads, spreadIndex)) - 1) / (this.totalSpreads - 1 || 1);
    if (side === 'left') {
      return 0.04 + norm * 0.22;
    } else {
      return 0.26 - norm * 0.22;
    }
  }

  /**
   * Procedural Physical Travelling Page Bending Deformer
   * 
   * Produces authentic paper mechanics:
   * - Strict inextensibility (arc-length along width is mathematically conserved at pw)
   * - Deformation begins near free outer edge
   * - Travelling wave of curvature peaks at mid-flip forming an S-like / cylindrical curl
   * - Curvature propagates across sheet width from outer edge to spine
   * - Sheet gradually straightens as it floats down and lands flat
   * - Bound edge remains locked to the spine binding without clipping
   * - Symmetrical formulation works identically for forward ('next') and backward ('prev')
   * 
   * @param {number} t - eased animation progress (0.0 to 1.0)
   * @param {string} direction - 'next' (right-to-left) or 'prev' (left-to-right)
   */
  applyPageCurlDeformation(t, direction) {
    const pw = config.book.pageWidth;
    const ph = config.book.pageHeight;
    const ct = config.book.coverThickness;
    const spineGutter = config.book.spineWidth * 0.2;
    const Nx = this.segmentsX;
    const Ny = this.segmentsY;
    const ds = pw / Nx;

    const pos = this.turningGeometry.attributes.position;
    const isNext = direction === 'next';

    // Departure and arrival spread indices
    const departingIndex = this.currentSpreadIndex;
    const incomingIndex = isNext ? departingIndex + 1 : departingIndex - 1;

    // Departure and arrival resting stack heights
    let xHingeStart, xHingeEnd, yHingeStart, yHingeEnd;
    if (isNext) {
      xHingeStart = spineGutter;
      xHingeEnd = -spineGutter;
      yHingeStart = ct + this.getStackThickness(departingIndex, 'right') + 0.004;
      yHingeEnd = ct + this.getStackThickness(incomingIndex, 'left') + 0.004;
    } else {
      xHingeStart = -spineGutter;
      xHingeEnd = spineGutter;
      yHingeStart = ct + this.getStackThickness(departingIndex, 'left') + 0.004;
      yHingeEnd = ct + this.getStackThickness(incomingIndex, 'right') + 0.004;
    }

    // Spine anchor: smoothly transitions from departure gutter to arrival gutter
    // Lifts gently over the curved spine crown (+0.045 * sin(PI * t)) to prevent spine collision
    const xHinge = xHingeStart + (xHingeEnd - xHingeStart) * t;
    const yHinge = yHingeStart + (yHingeEnd - yHingeStart) * t + 0.045 * Math.sin(Math.PI * t);

    // Primary bending envelope: peaks around mid-flip (t = 0.5) and is exactly 0 at t=0 and t=1
    const env = Math.sin(Math.PI * t);

    // Spine tangent angle: smooth rotation from 0 to PI
    const spineAngle = Math.PI * t;

    // Travelling wave center: propagates across the width from free outer edge (1.0) towards spine (0.0)
    const waveCenter = 1.0 - 0.9 * t;

    // Contact threshold preventing paper from dipping below the landing stack surface
    const landingStackThickness = isNext
      ? this.getStackThickness(incomingIndex, 'left')
      : this.getStackThickness(incomingIndex, 'right');
    const stackTopY = ct + landingStackThickness + 0.003;

    // Row-by-row inextensible arc integration across page height
    for (let j = 0; j <= Ny; j++) {
      const v = j / Ny; // 0 (bottom) to 1 (top)
      const vNorm = v - 0.5; // -0.5 to +0.5
      const zBase = (0.5 - v) * ph; // Top of book is -Z, bottom is +Z

      let curX = xHinge;
      let curY = yHinge;

      // Anchor hinge vertex (i = 0, spine edge)
      const idx0 = j * (Nx + 1);
      pos.setXYZ(idx0, curX, curY, zBase);

      // Integrate along the sheet width from spine (i = 1) to free outer edge (i = Nx)
      for (let i = 1; i <= Nx; i++) {
        const u = (i - 0.5) / Nx;

        // 1. Travelling wave Gaussian kernel
        const dist = u - waveCenter;
        const wave = Math.exp(-(dist * dist) / (2 * 0.22 * 0.22));

        // 2. Travelling cylindrical roll: concentrated around the moving wave front
        const arch = 1.45 * env * wave * Math.sin(Math.PI * u);

        // 3. Free outer edge peel: deformation begins near the free outer edge in early flip
        const peel = 1.1 * env * Math.pow(u, 1.6) * Math.max(0, 1.0 - 1.2 * t);

        // 4. S-curve inflection (counter-flexure along the sheet width)
        const sCurve = -0.75 * Math.pow(env, 1.3) * Math.sin(Math.PI * u) * (u - 0.5) * (1.0 - 0.3 * t);

        // 5. Tactile diagonal corner lift (bottom outer corner leads lift)
        const cornerLift = 0.35 * env * Math.pow(u, 2.0) * (-vNorm + 0.25) * (1.0 - 0.65 * t);

        // 6. Straightening factor as page approaches destination
        const straighten = Math.pow(1.0 - t, 0.4);

        let theta = spineAngle + (arch + peel + sCurve + cornerLift) * straighten;

        // Symmetrical reflection for backward flip
        if (!isNext) {
          theta = Math.PI - theta;
        }

        curX += ds * Math.cos(theta);
        curY += ds * Math.sin(theta);

        // Physical contact surface protection
        if (curY < stackTopY) {
          curY = stackTopY;
        }

        // Transverse paper bowing along book length (subtle three-dimensional paper volume)
        const zTransverse = 0.06 * env * Math.sin(Math.PI * u) * (1.0 - 4.0 * vNorm * vNorm);

        const idx = j * (Nx + 1) + i;
        pos.setXYZ(idx, curX, curY, zBase + zTransverse);
      }
    }

    pos.needsUpdate = true;
    this.turningGeometry.computeVertexNormals();
    this.backGeometry.computeVertexNormals();
  }

  /**
   * Execute animated page turn
   */
  turnPage(direction, onComplete) {
    if (this.isTurning) return false;

    // Boundary check
    if (direction === 'next' && this.currentSpreadIndex >= this.totalSpreads) return false;
    if (direction === 'prev' && this.currentSpreadIndex <= 1) return false;

    this.isTurning = true;
    this.turnDirection = direction;
    this.turnStartTime = performance.now();
    this.onTurnComplete = onComplete;

    const departingSpread = config.spreads[this.currentSpreadIndex - 1];
    const incomingIndex = direction === 'next' ? this.currentSpreadIndex + 1 : this.currentSpreadIndex - 1;
    const incomingSpread = config.spreads[incomingIndex - 1];

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.turnDuration = prefersReducedMotion ? 250 : config.book.turnDuration;

    const ct = config.book.coverThickness;

    if (direction === 'next') {
      // Right page turns over to the left
      // Front material displays departing right slide (facing up on the right)
      this.materials.turningFront.map = this.getSlideTexture(departingSpread.rightSlideIndex);
      this.materials.turningFront.needsUpdate = true;

      // Back material displays incoming left slide (will face up on the left)
      this.materials.turningBack.map = this.getSlideTexture(incomingSpread.leftSlideIndex);
      this.materials.turningBack.needsUpdate = true;

      // The resting right page immediately reveals the incoming right slide underneath!
      this.materials.rightResting.map = this.getSlideTexture(incomingSpread.rightSlideIndex);
      this.materials.rightResting.needsUpdate = true;

      // Update right stack height to reflect the newly exposed spread underneath
      const newRightThick = this.getStackThickness(incomingIndex, 'right');
      this.rightPageStack.scale.y = newRightThick / 0.16;
      this.rightRestingPage.position.y = ct + newRightThick + 0.003;
    } else {
      // Previous: Left page turns over to the right
      // Front material displays incoming right slide (will face up when landing on the right)
      this.materials.turningFront.map = this.getSlideTexture(incomingSpread.rightSlideIndex);
      this.materials.turningFront.needsUpdate = true;

      // Back material displays departing left slide (facing up while on the left)
      this.materials.turningBack.map = this.getSlideTexture(departingSpread.leftSlideIndex);
      this.materials.turningBack.needsUpdate = true;

      // The resting left page immediately reveals the incoming left slide underneath!
      this.materials.leftResting.map = this.getSlideTexture(incomingSpread.leftSlideIndex);
      this.materials.leftResting.needsUpdate = true;

      // Update left stack height to reflect the newly exposed spread underneath
      const newLeftThick = this.getStackThickness(incomingIndex, 'left');
      this.leftPageStack.scale.y = newLeftThick / 0.16;
      this.leftRestingPage.position.y = ct + newLeftThick + 0.003;
    }

    // Apply initial deformation at t = 0 before showing to avoid any 1-frame jump
    this.applyPageCurlDeformation(0.0, direction);
    this.turningPageGroup.visible = true;
    return true;
  }

  getSlideTexture(index) {
    if (this.slideTextures.has(index)) {
      return this.slideTextures.get(index);
    }
    const url = config.slides[index] || config.slides[0];
    const tex = this.loadTexture(url);
    this.slideTextures.set(index, tex);
    return tex;
  }

  /**
   * Update resting spread textures without turning animation
   */
  updateSpreadContent(spreadIndex, smooth = false) {
    this.currentSpreadIndex = Math.max(1, Math.min(this.totalSpreads, spreadIndex));
    const spread = config.spreads[this.currentSpreadIndex - 1];

    const leftTex = this.getSlideTexture(spread.leftSlideIndex);
    const rightTex = this.getSlideTexture(spread.rightSlideIndex);

    this.materials.leftResting.map = leftTex;
    this.materials.leftResting.needsUpdate = true;

    this.materials.rightResting.map = rightTex;
    this.materials.rightResting.needsUpdate = true;

    // Adjust stack thicknesses to reflect progress through the book
    const leftThick = this.getStackThickness(this.currentSpreadIndex, 'left');
    const rightThick = this.getStackThickness(this.currentSpreadIndex, 'right');

    this.leftPageStack.scale.y = leftThick / 0.16;
    this.rightPageStack.scale.y = rightThick / 0.16;

    const ct = config.book.coverThickness;
    this.leftRestingPage.position.y = ct + leftThick + 0.003;
    this.rightRestingPage.position.y = ct + rightThick + 0.003;
  }

  /**
   * Replace texture from file input preview (URL.createObjectURL)
   */
  replaceSlidePreview(slideIndex, objectUrl) {
    const tex = this.loadTexture(objectUrl);
    this.slideTextures.set(slideIndex, tex);
    this.updateSpreadContent(this.currentSpreadIndex, false);
  }

  replaceCoverPreview(coverType, objectUrl) {
    const tex = this.loadTexture(objectUrl);
    if (coverType === 'front') {
      this.materials.coverFront.map = tex;
      this.materials.coverFront.needsUpdate = true;
    } else if (coverType === 'back') {
      this.materials.coverBack.map = tex;
      this.materials.coverBack.needsUpdate = true;
    } else if (coverType === 'spine') {
      this.materials.spine.map = tex;
      this.materials.spine.needsUpdate = true;
    }
  }

  setupEvents() {
    const dom = this.renderer.domElement;

    // Pointer events for subtle spatial drag rotation
    const onPointerDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = {
        x: e.clientX || (e.touches && e.touches[0].clientX) || 0,
        y: e.clientY || (e.touches && e.touches[0].clientY) || 0
      };
      dom.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

      const deltaX = clientX - this.previousMousePosition.x;
      const deltaY = clientY - this.previousMousePosition.y;

      // Constrained sensitivity: presentation viewer, not wild 3D game
      this.targetRotation.y += deltaX * 0.0035;
      this.targetRotation.x += deltaY * 0.0035;

      // Clamp rotations strictly
      this.targetRotation.y = Math.max(-0.45, Math.min(0.45, this.targetRotation.y));
      this.targetRotation.x = Math.max(0.15, Math.min(0.85, this.targetRotation.x));

      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      this.isDragging = false;
      dom.style.cursor = 'grab';
    };

    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Responsive resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  setElevation(degrees) {
    this.targetElevation = degrees;
  }

  resetIsometricView() {
    this.targetRotation.x = this.defaultRotation.x;
    this.targetRotation.y = this.defaultRotation.y;
    this.targetElevation = config.book.initialElevation;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // 1. Update page turn physics if in progress
    if (this.isTurning) {
      const now = performance.now();
      const elapsed = now - this.turnStartTime;
      const t = Math.min(1.0, elapsed / this.turnDuration);

      // Smooth cubic easing:
      // t * t * (3 - 2 * t)
      const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.applyPageCurlDeformation(easeT, this.turnDirection);

      if (t >= 1.0) {
        this.isTurning = false;
        this.turningPageGroup.visible = false;
        const newIndex = this.turnDirection === 'next' 
          ? this.currentSpreadIndex + 1 
          : this.currentSpreadIndex - 1;
        
        this.updateSpreadContent(newIndex, false);
        if (this.onTurnComplete) {
          this.onTurnComplete(newIndex);
        }
      }
    }

    // 2. Smooth camera damping
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;
    this.updateCameraTransform();

    // 3. Render frame
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
