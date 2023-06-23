import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import anime from 'animejs/lib/anime.es.js';
import tile_url from "./tile.glb?url";
// import env_texture_url from "./tiergarten_2k.exr?url";
import { lerp } from 'three/src/math/MathUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
// import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
// import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
// import Easing from 'easing-functions'


THREE.DefaultLoadingManager.onLoad = () => {
  requestAnimationFrame(animate);
}

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
renderer.shadowMap.enabled = true;

let composer_rendertarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: 4,
  // these are required to avoid color banding
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType
});
const composer = new EffectComposer(renderer, composer_rendertarget);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
// composer.addPass(new GlitchPass());
// composer.addPass(new BloomPass(.1, 25, 25));
// 
var pixelRatio = renderer.getPixelRatio();
let bloom_pass = new UnrealBloomPass(
  new THREE.Vector2(1 / window.innerWidth * pixelRatio, 1 / window.innerHeight * pixelRatio),
  // new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight),
  // new THREE.Vector2(1, 1),
  .7,
  .1,
  .8
)
composer.addPass(bloom_pass);

// let fxaaPass = new ShaderPass(FXAAShader);

// var uniforms = fxaaPass.material.uniforms;
// uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
// uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
// composer.addPass(fxaaPass);

camera.position.set(0, 17, 5);
camera.lookAt(0, 0, 0.75);
// camera.position.z = 5;

let tiles: Tile[][] = [];
const tile_spacing = 2.06;

// no env texture
// const env_generator = new THREE.PMREMGenerator(renderer);
// env_generator.compileEquirectangularShader();
// let env_texture: THREE.Texture;

let face_mat_1;
let face_mat_2;

// new EXRLoader().load(env_texture_url, texture => {
//   texture.mapping = THREE.EquirectangularReflectionMapping;

//   env_texture = env_generator.fromEquirectangular(texture).texture;
//   // const env_texture = env_texture_generator.fromEquirectangular()
const gltfLoader = new GLTFLoader();
gltfLoader.load(tile_url, gltf => {
  const reference_tile = gltf.scene;

  face_mat_1 = (reference_tile.children.find(x => x.name === "TileFace") as THREE.Mesh).material as THREE.MeshStandardMaterial;
  face_mat_2 = face_mat_1.clone();
  face_mat_2.color.set(0x4433BB);

  // const reference_tile = gltf.scene;
  // reference_tile.castShadow = true; // todo: cast & receive shadows for all children
  // @ts-ignore
  reference_tile.children.forEach((child: THREE.Mesh) => {
    // let mat = (child.material as THREE.MeshStandardMaterial);
    // mat.envMap = env_texture;
    // mat.envMapIntensity = .1;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  reference_tile.castShadow = true;
  reference_tile.receiveShadow = true;


  for (let row = 0; row < 7; row++) {
    let cur_row: Tile[] = [];
    for (let col = 0; col < 7; col++) {
      let cur_tile = makeTile(reference_tile, new THREE.Vector2(col, row));
      cur_tile.group.position.set((row - 3) * tile_spacing, 0, (col - 3) * tile_spacing);
      cur_row.push(cur_tile);
    }
    tiles.push(cur_row);
  }
});
// });

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

window.addEventListener('pointermove', event => {

  // calculate pointer position in normalized device coordinates
  // (-1 to +1) for both components

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

});

let z_vec = new THREE.Vector3(0, 0, 1);
window.addEventListener("pointerdown", _ => {
  if (cur_hovering_tile === null) return;

  let tmp = { clicked: 0 };
  let clicked_tile = cur_hovering_tile;
  clicked_tile.clicking = true;
  anime.remove(clicked_tile);
  let pending_change = true;
  anime({
    targets: tmp,
    clicked: 1,
    easing: "easeOutExpo",
    duration: 600,
    update(anim) {
      clicked_tile.group.setRotationFromAxisAngle(z_vec, Math.PI * 2 * tmp.clicked);
      if (pending_change && anim.progress > .1) {
        pending_change = false;
        clicked_tile.game_state = !clicked_tile.game_state;
        clicked_tile.tile_face.material = clicked_tile.game_state ? face_mat_2! : face_mat_1!;
      }
      // clicked_tile.wrap.position.setY(tmp.clicked)
    },
    // complete(anim) {
    //   clicked_tile.clicked = 0;
    // },
  }).finished.then(function () {
    // Do things...
    clicked_tile.clicking = false;
  });
  clicked_tile!.wrap.position.setY(-1.25);
  anime({
    targets: clicked_tile!.wrap.position,
    y: 0,
  });
  getAllNeighs(clicked_tile).forEach(neighbouring_tile => {
    anime({
      targets: neighbouring_tile.wrap.position,
      y: -.5,
      duration: 100,
      easing: 'easeInOutQuad',
    }).finished.then(function () {
      // Do things...
      clicked_tile.clicking = false;
      anime({
        targets: neighbouring_tile.wrap.position,
        y: 0,
        // easing: 'easeInQuad',
        duration: 1000,
      })
    });
  })

})

type Tile = {
  // used to add an offset
  wrap: THREE.Object3D,
  group: THREE.Group,
  light_ring_material: THREE.MeshStandardMaterial,
  index: THREE.Vector2,
  hovered: number,
  // is a neighbouring tile hovered?
  neighboured: number,
  // in what direction are we animating?
  moving_up: boolean, // unused
  // currently jumping after a click
  clicking: boolean,
  tile_face: THREE.Mesh,
  game_state: boolean,
};

function makeTile(reference_tile: THREE.Group, index: THREE.Vector2): Tile {
  let new_tile = reference_tile.clone();
  let new_tile_wrap = new THREE.Object3D();
  new_tile_wrap.add(new_tile);
  scene.add(new_tile_wrap);

  let light_ring = new_tile.children.find(x => x.name === "TileLight") as THREE.Mesh;
  light_ring.material = (light_ring.material as THREE.Material).clone();

  let tile_face = new_tile.children.find(x => x.name === "TileFace") as THREE.Mesh;

  return {
    wrap: new_tile_wrap,
    group: new_tile,
    light_ring_material: light_ring.material as THREE.MeshStandardMaterial,
    index: index,
    hovered: 0,
    neighboured: 0,
    moving_up: true,
    clicking: false,
    tile_face: tile_face,
    game_state: false,
  }
};

{
  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(23, 20, 7);
  light.castShadow = true;
  light.shadow.camera.left = -10;
  light.shadow.camera.right = 9;
  light.shadow.camera.bottom = -6;
  light.shadow.camera.top = 7;
  light.shadow.camera.near = 20;
  light.shadow.camera.far = 50;
  light.shadow.bias = -0.01;
  scene.add(light);
}

// {
//   const color = 0xFFFFFF;
//   const intensity = 1.3;
//   const light = new THREE.AmbientLight(color, intensity);
//   // scene.add(light);
// }

// {
//   const color = 0xFFFFFF;
//   const intensity = 1;
//   const light = new THREE.PointLight(color, intensity);
//   light.position.set(-1, 1, 4);
//   light.castShadow = true;
//   scene.add(light);
// }

// const ambient_light = new THREE.AmbientLight(0xffffff, .2);
// scene.add(ambient_light);

// const line_material = new THREE.LineBasicMaterial({ color: 0x0000ff });
// const line_points = [];
// line_points.push(new THREE.Vector3(-10, 0, 0));
// line_points.push(new THREE.Vector3(0, 10, 0));
// line_points.push(new THREE.Vector3(10, 0, 0));
// const line_geometry = new THREE.BufferGeometry().setFromPoints(line_points);
// const line = new THREE.Line(line_geometry, line_material);
// scene.add(line);

// const board_quad = new THREE.
const board_collision = new THREE.Mesh(new THREE.PlaneGeometry(7 * tile_spacing, 7 * tile_spacing), undefined);
board_collision.rotateX(-Math.PI / 2);
board_collision.rotateZ(-Math.PI / 2);
board_collision.updateMatrixWorld();
// scene.add(board_collision);

// anime.js version
function updateTile(tile: Tile) {
  let hover_val = Math.max(tile.hovered, tile.neighboured * .3);
  let scale = lerp(1, 1.05, hover_val);
  tile.group.scale.set(scale, scale, scale);
  tile.group.position.setY(hover_val);
  tile.light_ring_material.emissiveIntensity = lerp(1, 10, tile.hovered);
  tile.light_ring_material.emissiveIntensity = Math.max(1, tile.light_ring_material.emissiveIntensity);
}

// function updateTile(tile: Tile, dt: number) {
//   // let prev_hover_val = Math.max(tile.hovered, tile.neighboured * .3);

//   tile.hovered = towards(tile.hovered, (tile === cur_hovering_tile) ? 1 : 0, dt);
//   let isNeigh = (cur_hovering_tile !== null) && (tile.index.distanceToSquared(cur_hovering_tile.index) <= 2.2);
//   tile.neighboured = towards(tile.neighboured, isNeigh ? 1 : 0, dt);
//   tile.moving_up = (tile === cur_hovering_tile) || isNeigh;

//   let hover_val = Math.max(tile.hovered, tile.neighboured * .2);
//   // const easeFn = (prev_hover_val >= hover_val) ? Easing.Elastic.In : Easing.Elastic.Out;
//   const easeFn = tile.moving_up ? Easing.Elastic.Out : Easing.Elastic.In;
//   // const easeFn = Easing.Elastic.InOut;
//   hover_val = easeFn(hover_val);

//   let scale = lerp(1, 1.05, hover_val);
//   tile.group.scale.set(scale, scale, scale);
//   tile.group.position.setY(hover_val);
//   tile.light_ring_material.emissiveIntensity = lerp(1, 10, easeFn(tile.hovered));
// }

function getAllNeighs(tile: Tile): Tile[] {
  let result = [];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      if (i === 0 && j === 0) continue;
      if (!inRangeInclusive(tile.index.y + j, 0, 6) || !inRangeInclusive(tile.index.x + i, 0, 6)) continue;
      let neighbouring_tile = tiles[tile.index.y + j][tile.index.x + i];
      result.push(neighbouring_tile);
    }
  }
  return result;
}

function onStartHover(tile: Tile) {
  anime.remove(tile);
  anime({
    targets: tile,
    hovered: 1,
  });
  getAllNeighs(tile).forEach(neighbouring_tile => {
    anime.remove(neighbouring_tile);
    anime({
      targets: neighbouring_tile,
      neighboured: 1,
      hovered: 0,
    });
  })
}

function onEndHover(tile: Tile) {
  // anime.remove(tile)
  anime({
    targets: tile,
    hovered: 0,
    duration: 2000,
  });

  getAllNeighs(tile).forEach(neighbouring_tile => {
    anime({
      targets: neighbouring_tile,
      neighboured: 0,
      duration: 2000,
    });
  })
}

// const controls = new OrbitControls(camera, renderer.domElement);

let cur_hovering_tile: Tile | null = null;

let last_time = 0;
function animate(cur_time: number) {
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  // @ts-ignore
  let delta_time = (cur_time - last_time) * .001;
  last_time = cur_time;

  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;

  // update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, camera);
  // calculate objects intersecting the picking ray
  let new_hovering_tile: Tile | null = null;
  const intersects = raycaster.intersectObject(board_collision);
  if (intersects.length > 0) {
    let tile_index = intersects[0].uv!.multiplyScalar(7).floor();
    new_hovering_tile = tiles[tile_index.y][tile_index.x];
  }

  if (new_hovering_tile !== cur_hovering_tile) {
    if (cur_hovering_tile !== null) {
      onEndHover(cur_hovering_tile);
    }
    if (new_hovering_tile !== null) {
      onStartHover(new_hovering_tile);
    }
    cur_hovering_tile = new_hovering_tile;
  }
  cur_hovering_tile = new_hovering_tile;
  tiles.forEach(row => row.forEach(tile => updateTile(tile)));

  // tiles.forEach(row => row.forEach(tile => updateTile(tile, delta_time)));

  // renderer.render(scene, camera);
  composer.render();
  // controls.update();
  requestAnimationFrame(animate);
}



function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    // const pixelRatio = renderer.getPixelRatio();
    // fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
    // fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
    // bloom_pass.resolution.set(width, height);
  }
  return needResize;
}

// function towards(cur: number, target: number, max_delta: number): number {
//   if (cur > target) {
//     return Math.max(cur - max_delta, target);
//   } else if (cur < target) {
//     return Math.min(cur + max_delta, target);
//   } else {
//     return target;
//   }
// }

function inRangeInclusive(value: number, min: number, max: number) {
  return value >= min && value <= max;
}
