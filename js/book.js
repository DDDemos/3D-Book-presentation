// ============================================================================
// book.js
//
// Procedural 3D book: covers, spine, page stacks, and a bending page-turn
// animation built from vertex manipulation on a subdivided plane (no GLB,
// no animation library).
//
// Coordinate system (book group local space, unrotated):
//   X = across the book (spine at X=0, right edge at +X, left edge at -X)
//   Y = up (the spine's axis — page height)
//   Z = the book's thickness axis (stacking direction / toward-away camera)
// ============================================================================

import * as THREE from "three";
import { makePageBackTexture } from "./presentation.js?v=3";

export const PAGE_WIDTH = 1.5;
export const PAGE_HEIGHT = 2.0;
const PAGE_THICKNESS = 0.0045;
const COVER_THICKNESS = 0.06;
const SPINE_WIDTH = 0.16;
const LAYER_GAP = 0.0006; // extra epsilon between stacked layers to prevent z-fighting

const FLIP_SEGMENTS_X = 26;
const FLIP_SEGMENTS_Y = 10;
const CURL_STRENGTH = 0.85; // radians of extra curl at the free edge, at peak
const LIFT_HEIGHT = 0.16; // out-of-plane bulge height at peak

const DEFAULT_DURATION_MS = 900;
const REDUCED_MOTION_DURATION_MS = 220;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Builds the double-layer (front + back) bendable page geometry.
 * Front layer vertices come first, back layer vertices second, sharing the
 * same (x0,y0) grid so a single animation pass can update both together.
 */
function buildFlipGeometry() {
  const segX = FLIP_SEGMENTS_X;
  const segY = FLIP_SEGMENTS_Y;
  const w = PAGE_WIDTH;
  const h = PAGE_HEIGHT;
  const half = PAGE_THICKNESS / 2;

  const positions = [];
  const uvs = [];
  const base = []; // { x0, y0, sign } per vertex, sign = +1 front layer / -1 back layer
  const indices = [];

  function addLayer(sign, reverseWinding) {
    const start = positions.length / 3;
    for (let j = 0; j <= segY; j++) {
      const v = j / segY;
      const y0 = (v - 0.5) * h;
      for (let i = 0; i <= segX; i++) {
        const u = i / segX;
        const x0 = u * w;
        positions.push(x0, y0, sign * half);
        uvs.push(u, v);
        base.push({ x0, y0, sign });
      }
    }
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segX; i++) {
        const a = start + j * (segX + 1) + i;
        const b = a + 1;
        const c = a + (segX + 1);
        const d = c + 1;
        if (!reverseWinding) {
          indices.push(a, b, c, b, d, c);
        } else {
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  addLayer(+1, false); // front layer: normal +Z when flat
  addLayer(-1, true); // back layer: normal -Z when flat

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const vertsPerLayer = (segX + 1) * (segY + 1);
  const trisPerLayer = segX * segY * 6;
  geometry.addGroup(0, trisPerLayer, 0); // front layer -> material 0
  geometry.addGroup(trisPerLayer, trisPerLayer, 1); // back layer -> material 1
  geometry.computeVertexNormals();

  return { geometry, base, vertsPerLayer };
}

/** Fallback material used while a real texture is loading or missing. */
function neutralMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.02,
    color: 0xffffff,
  });
}

export class Book3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "book";
    scene.add(this.group);

    this._numSlides = 1;
    this._animation = null; // active flip animation state, or null

    this._pageBackTexture = makePageBackTexture();

    this._buildStaticParts();
    this._buildFlippingPage();
  }

  // -------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------

  _buildStaticParts() {
    const w = PAGE_WIDTH;
    const h = PAGE_HEIGHT;

    // Flat static pages (double-sided so they read correctly whether they
    // sit on the right, at rotation.y = 0, or the left, at rotation.y = PI).
    // Pivoted at the spine edge (local x=0) rather than centered, so the
    // same geometry spans [0,w] on the right and, once mirrored by the
    // 180-degree rotation, [-w,0] on the left.
    const pageGeo = new THREE.PlaneGeometry(w, h);
    pageGeo.translate(w / 2, 0, 0);

    this.rightPageMat = neutralMaterial(null);
    this.rightPageMat.side = THREE.DoubleSide;
    this.rightPage = new THREE.Mesh(pageGeo, this.rightPageMat);
    this.rightPage.position.set(0, 0, LAYER_GAP);
    this.rightPage.rotation.y = 0;
    this.rightPage.visible = false;
    this.group.add(this.rightPage);

    this.leftPageMat = neutralMaterial(this._pageBackTexture);
    this.leftPageMat.side = THREE.DoubleSide;
    this.leftPage = new THREE.Mesh(pageGeo, this.leftPageMat);
    this.leftPage.position.set(0, 0, LAYER_GAP);
    this.leftPage.rotation.y = Math.PI;
    this.leftPage.visible = false;
    this.group.add(this.leftPage);

    // Page stack "bulk" blocks (undifferentiated pages) — purely decorative,
    // so the book continues to read as a physical object with depth. Built
    // as a unit box pivoted at its spine-facing edge (local x=0), then
    // scaled per-axis to (width, height, current bulk thickness).
    const stackGeo = new THREE.BoxGeometry(1, 1, 1);
    stackGeo.translate(0.5, 0, 0);

    this.rightStackMat = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.95 });
    this.rightStack = new THREE.Mesh(stackGeo, this.rightStackMat);
    this.rightStack.scale.set(w, h, 0.0001);
    this.group.add(this.rightStack);

    this.leftStackMat = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.95 });
    this.leftStack = new THREE.Mesh(stackGeo, this.leftStackMat);
    this.leftStack.scale.set(-w, h, 0.0001);
    this.group.add(this.leftStack);

    // Covers (thicker boxes so they read as rigid board, not paper).
    // Built as two separate geometries (rather than mirroring one with a
    // negative scale) so their UVs — and therefore cover artwork — read
    // correctly instead of backwards.
    const backCoverGeo = new THREE.BoxGeometry(w, h, COVER_THICKNESS);
    backCoverGeo.translate(w / 2, 0, 0);
    const frontCoverGeo = new THREE.BoxGeometry(w, h, COVER_THICKNESS);
    frontCoverGeo.translate(-w / 2, 0, 0);

    // The front cover doubles as the book's first "page": closed (rotation
    // PI) it sits on the right showing its art to the viewer; opening it
    // swings it to rotation 0, its natural build orientation, on the left.
    // It's a solid box, so a 180-degree spin swaps which of its two opposite
    // Z faces is the one physically facing the camera (the far face is
    // occluded by the box's own bulk, regardless of material.side) — so the
    // art material goes on BOTH those faces, not just the "outer" one.
    this.frontCoverMat = neutralMaterial(null);
    this.frontCover = new THREE.Mesh(frontCoverGeo, [
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      this.frontCoverMat,
      this.frontCoverMat,
    ]);
    this.frontCover.rotation.y = Math.PI; // starts closed
    this.group.add(this.frontCover);

    this.backCoverMat = neutralMaterial(null);
    this.backCover = new THREE.Mesh(backCoverGeo, [
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }),
      this.backCoverMat,
      new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.8 }),
    ]);
    this.group.add(this.backCover);

    // Spine
    const spineGeo = new THREE.BoxGeometry(SPINE_WIDTH, h + 0.02, 1);
    this.spineMat = neutralMaterial(null);
    this.spine = new THREE.Mesh(spineGeo, [
      new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.75 }),
      this.spineMat,
      this.spineMat,
    ]);
    this.group.add(this.spine);

    // Ground plane that only ever shows the book's cast shadow (a real,
    // dynamic soft shadow rather than a painted blob).
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -PAGE_HEIGHT / 2 - 0.02;
    ground.receiveShadow = true;
    this.group.add(ground);

    for (const mesh of [this.rightPage, this.leftPage, this.frontCover, this.backCover, this.spine]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  }

  _buildFlippingPage() {
    const { geometry, base, vertsPerLayer } = buildFlipGeometry();
    this._flipBase = base;
    this._flipVertsPerLayer = vertsPerLayer;
    this._flipGeometry = geometry;

    this.flipFrontMat = neutralMaterial(null);
    this.flipFrontMat.side = THREE.FrontSide;
    this.flipBackMat = neutralMaterial(this._pageBackTexture);
    this.flipBackMat.side = THREE.FrontSide;

    this.flipMesh = new THREE.Mesh(geometry, [this.flipFrontMat, this.flipBackMat]);
    this.flipMesh.visible = false;
    this.flipMesh.frustumCulled = false;
    this.flipMesh.castShadow = true;
    this.flipMesh.receiveShadow = true;
    this.group.add(this.flipMesh);
  }

  // -------------------------------------------------------------------
  // Configuration (called once slide count / cover textures are known)
  // -------------------------------------------------------------------

  setSlideCount(n) {
    this._numSlides = Math.max(1, n);
    this._layoutStacks(-1);
  }

  /**
   * Assigns `texture` to `material.map`, disposing whatever texture was
   * there before. Only safe for slots book.js owns exclusively (covers,
   * spine) — slide-page textures are lifecycle-managed by the
   * SlideTextureCache in presentation.js and must NOT be disposed here,
   * since the same texture is reused whenever the user navigates back.
   */
  _swapMap(material, texture) {
    const old = material.map;
    material.map = texture;
    material.needsUpdate = true;
    if (old && old !== texture) old.dispose();
  }

  /** Sets the right page's slide texture. Ownership stays with the caller's cache. */
  setRightPageTexture(texture) {
    this.rightPageMat.map = texture;
    this.rightPageMat.needsUpdate = true;
    this.rightPage.visible = true;
  }

  setFrontCoverTexture(texture) {
    this._swapMap(this.frontCoverMat, texture);
  }

  setBackCoverTexture(texture) {
    this._swapMap(this.backCoverMat, texture);
  }

  setSpineTexture(texture) {
    this._swapMap(this.spineMat, texture);
  }

  // -------------------------------------------------------------------
  // Layout: positions covers/stacks/pages according to contentIndex.
  //
  // contentIndex is which *content* slide (0-based) is currently showing,
  // or -1 while the closed front cover is showing, or this._numSlides once
  // the closed back cover is showing (i.e. past the last slide). The front
  // cover's own open/closed rotation is driven separately, by flipCover();
  // this only ever snaps its depth and the depth of the back cover.
  // -------------------------------------------------------------------

  _layoutStacks(contentIndex) {
    const maxDepth = this._numSlides * (PAGE_THICKNESS + LAYER_GAP) + 0.02;
    const deepZ = -(maxDepth + COVER_THICKNESS / 2);
    const nearZ = -(COVER_THICKNESS / 2) - LAYER_GAP;

    const turned = Math.max(0, contentIndex); // content pages already moved to the left
    const remaining = Math.max(0, this._numSlides - contentIndex - 1); // content pages still to come, right side

    // Each cover rises to meet the spine plane whenever nothing else (no
    // page, no bulk) is sitting in front of it on its side, so the view
    // never reads as a recessed, sunken gap.
    this.frontCover.position.z = contentIndex <= 0 ? nearZ : deepZ;
    this.backCover.position.z = remaining <= 0 ? nearZ : deepZ;
    this.spine.position.z = (deepZ + 0) / 2;
    this.spine.scale.z = Math.abs(deepZ) + COVER_THICKNESS;

    const leftBulk = Math.max(0, turned - 1) * (PAGE_THICKNESS + LAYER_GAP);
    const rightBulk = Math.max(0, remaining) * (PAGE_THICKNESS + LAYER_GAP);

    this.leftPage.visible = turned > 0;
    this.rightPage.visible = contentIndex >= 0 && contentIndex < this._numSlides;

    if (leftBulk > 0.00001) {
      this.leftStack.visible = true;
      this.leftStack.scale.z = leftBulk;
      this.leftStack.position.z = -(LAYER_GAP * 2) - leftBulk / 2;
    } else {
      this.leftStack.visible = false;
    }

    if (rightBulk > 0.00001) {
      this.rightStack.visible = true;
      this.rightStack.scale.z = rightBulk;
      this.rightStack.position.z = -(LAYER_GAP * 2) - rightBulk / 2;
    } else {
      this.rightStack.visible = false;
    }
  }

  // -------------------------------------------------------------------
  // Animation
  // -------------------------------------------------------------------

  isAnimating() {
    return this._animation !== null;
  }

  /**
   * Starts a page-turn animation.
   * @param {"forward"|"backward"} direction
   * @param {THREE.Texture} frontTexture - texture for the leaf being turned
   * @param {THREE.Texture|null} upcomingRightTexture - what the right page
   *   should show once revealed (forward: next slide; backward: same as
   *   frontTexture, since the leaf becomes the new current slide)
   * @param {boolean} reducedMotion
   * @param {() => void} onComplete
   */
  flip({ direction, frontTexture, upcomingRightTexture, reducedMotion, onComplete }) {
    if (this._animation) return;

    this.flipFrontMat.map = frontTexture;
    this.flipFrontMat.needsUpdate = true;

    if (direction === "forward") {
      // The flipping leaf currently occupies the same spot as the visible
      // right page — swap what's underneath to the next slide right away so
      // it's progressively revealed as the top page lifts and turns.
      this.rightPageMat.map = upcomingRightTexture;
      this.rightPageMat.needsUpdate = true;
      this.rightPage.visible = !!upcomingRightTexture;
      this.leftPage.visible = true; // neutral back, always the same texture
    } else {
      // Backward: the flipping leaf takes over the left page's spot (same
      // neutral-back appearance at the start), right page stays as-is until
      // the leaf lands on top of it at the very end.
      this.leftPage.visible = false;
    }

    this.flipMesh.visible = true;
    this.flipMesh.renderOrder = 2;

    this._animation = {
      direction,
      start: performance.now(),
      duration: reducedMotion ? REDUCED_MOTION_DURATION_MS : DEFAULT_DURATION_MS,
      curl: reducedMotion ? 0.15 : CURL_STRENGTH,
      lift: reducedMotion ? 0.03 : LIFT_HEIGHT,
      onComplete: () => {
        this.flipMesh.visible = false;
        if (direction === "backward") {
          this.rightPageMat.map = upcomingRightTexture;
          this.rightPageMat.needsUpdate = true;
          this.rightPage.visible = true;
        }
        onComplete();
      },
    };

    this._updateFlipGeometry(direction === "forward" ? 0 : Math.PI, this._animation.curl, this._animation.lift);
  }

  /**
   * Opens or closes the front cover — a rigid hinge rotation (no bend/curl,
   * unlike flip()), since a cover is a stiff board rather than a sheet of
   * paper. "forward" opens it (rotation PI -> 0, swinging left); "backward"
   * closes it again (0 -> PI, swinging back over the right side).
   */
  flipCover({ direction, upcomingRightTexture, reducedMotion, onComplete }) {
    if (this._animation) return;

    if (direction === "forward") {
      // Reveal slide 0 underneath right away, so it shows progressively as
      // the cover swings open — same idea as the reveal in flip().
      this.rightPageMat.map = upcomingRightTexture;
      this.rightPageMat.needsUpdate = true;
      this.rightPage.visible = true;
    }
    // backward (closing): rightPage stays showing slide 0 throughout, and is
    // only hidden once the cover has fully swung back over it.

    const fromAngle = direction === "forward" ? Math.PI : 0;
    const toAngle = direction === "forward" ? 0 : Math.PI;

    this._animation = {
      kind: "cover",
      start: performance.now(),
      duration: reducedMotion ? REDUCED_MOTION_DURATION_MS : DEFAULT_DURATION_MS,
      fromAngle,
      toAngle,
      onComplete: () => {
        if (direction === "backward") {
          this.rightPage.visible = false;
        }
        onComplete();
      },
    };

    this.frontCover.rotation.y = fromAngle;
  }

  /** Advances the active animation. Call once per frame. */
  update(nowMs) {
    if (!this._animation) return;

    const anim = this._animation;
    const elapsed = nowMs - anim.start;
    const p = Math.min(1, elapsed / anim.duration);
    const eased = easeInOutCubic(p);

    if (anim.kind === "cover") {
      this.frontCover.rotation.y = anim.fromAngle + (anim.toAngle - anim.fromAngle) * eased;
    } else {
      const angle = anim.direction === "forward" ? eased * Math.PI : Math.PI - eased * Math.PI;
      this._updateFlipGeometry(angle, anim.curl, anim.lift);
    }

    if (p >= 1) {
      this._animation = null;
      anim.onComplete(); // triggers Presentation's callback, which calls syncLayout()
    }
  }

  /** Rebuilds the flipping page's vertex positions for a given hinge angle. */
  _updateFlipGeometry(angle, curlStrength, liftHeight) {
    const posAttr = this._flipGeometry.getAttribute("position");
    const base = this._flipBase;
    const w = PAGE_WIDTH;
    const h = PAGE_HEIGHT;
    const sinA = Math.sin(angle);

    for (let idx = 0; idx < base.length; idx++) {
      const { x0, y0, sign } = base[idx];
      const fold = x0 / w; // 0 at spine, 1 at free edge
      const theta = angle + curlStrength * fold * sinA;

      const zLocal = sign * (PAGE_THICKNESS / 2);
      const x = x0 * Math.cos(theta) - zLocal * Math.sin(theta);
      const z = x0 * Math.sin(theta) + zLocal * Math.cos(theta);

      const edgeFalloff = 1 - Math.pow((2 * y0) / h, 2);
      const y = y0 + liftHeight * fold * sinA * Math.max(0, edgeFalloff);

      posAttr.setXYZ(idx, x, y, z);
    }

    posAttr.needsUpdate = true;
    this._flipGeometry.computeVertexNormals();
  }

  /** Called by Presentation after contentIndex changes, to reposition stacks. */
  syncLayout(contentIndex) {
    this._layoutStacks(contentIndex);
  }

  dispose() {
    this._flipGeometry.dispose();
    this._pageBackTexture.dispose();
  }
}
