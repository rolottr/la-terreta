import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const assets = new Map<string,T.Group>();
/** Keep Blender's moving pivots and batch each rigid part by material. */
function batch(root:T.Object3D) {
  root.updateWorldMatrix(true,true);
  const inverse = root.matrixWorld.clone().invert();
  const pieces = new Map<T.Material,T.BufferGeometry[]>();
  const moving:T.Object3D[]=[];
  root.traverse(object => { if(object!==root && /^(Bull_(Head|Leg|Tail)|Tram_Door)/.test(object.name)) moving.push(object); });
  const collect=(object:T.Object3D) => {
    if(moving.includes(object))return;
    for(const child of [...object.children])collect(child);
    if(!(object instanceof T.Mesh) || Array.isArray(object.material))return;
    const geometry=object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
    for(const attribute of Object.keys(geometry.attributes))if(!["position","normal"].includes(attribute))geometry.deleteAttribute(attribute);
    if(!pieces.has(object.material))pieces.set(object.material,[]);
    pieces.get(object.material)!.push(geometry);
    object.removeFromParent();
  };
  for(const child of [...root.children])collect(child);
  for(const [material,geometries] of pieces) {
    const geometry=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g));
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;root.add(mesh);
    for(const g of geometries)g.dispose();
  }
  for(const pivot of moving)batch(pivot);
}
export async function loadCityAssets() {
  await Promise.all(["bull","tram"].map(async name=>{
    const {scene}=await new GLTFLoader().loadAsync(`/models/city/${name}.glb`);
    batch(scene);assets.set(name,scene);
  }));
}
export function cityAsset(name:"bull"|"tram") {
  const source=assets.get(name);
  if(!source)throw Error(`City asset is not loaded: ${name}`);
  return source.clone(true);
}
