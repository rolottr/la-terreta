"""Check actual GLB skin, morph, and animation data without loading the game."""
import json,math,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
b=(ROOT/'public/models/characters.glb').read_bytes();size=struct.unpack_from('<I',b,12)[0]
doc=json.loads(b[20:20+size]);start=20+size+8;binary=b[start:]
formats={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def rows(index):
 a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
 fmt='<'+formats[a['componentType']]*widths[a['type']];width=struct.calcsize(fmt)
 stride=view.get('byteStride',width);offset=view.get('byteOffset',0)+a.get('byteOffset',0)
 for i in range(a['count']):
  row=struct.unpack_from(fmt,binary,offset+i*stride)
  if a.get('normalized'):
   maximum={5121:255,5123:65535}[a['componentType']];row=tuple(v/maximum for v in row)
  yield row

skin_checks=[]
for node in doc['nodes']:
 if 'mesh' not in node or 'skin' not in node:continue
 skin=doc['skins'][node['skin']];mesh=doc['meshes'][node['mesh']]
 morphs=mesh.get('extras',{}).get('targetNames',[])
 assert 'RelaxedHands' in morphs,(node['name'],'Missing hand morph')
 if node['name'].endswith('_detail'):assert 'Blink' in morphs,(node['name'],'Missing blink morph')
 count=0;max_error=0
 for primitive in mesh['primitives']:
  attrs=primitive['attributes'];assert 'WEIGHTS_0' in attrs and 'JOINTS_0' in attrs,node['name']
  for weights,joints in zip(rows(attrs['WEIGHTS_0']),rows(attrs['JOINTS_0'])):
   assert all(math.isfinite(w) and w>=0 for w in weights),node['name']
   max_error=max(max_error,abs(sum(weights)-1));count+=1
   assert all(j<len(skin['joints']) for j in joints),node['name']
  assert max_error<.0001,(node['name'],max_error)
  for pos in rows(attrs['POSITION']):assert all(math.isfinite(v) and abs(v)<3 for v in pos),node['name']
 if mesh.get('weights'):assert all(w==0 for w in mesh['weights']),('Closed default eyes',mesh['name'])
 skin_checks.append({'node':node['name'],'vertices':count,'bones':len(skin['joints']),'maxWeightError':max_error})
clips=[]
for action in doc['animations']:
 duration=0;moving=[]
 for channel in action['channels']:
  sampler=action['samplers'][channel['sampler']];times=[v[0]for v in rows(sampler['input'])]
  assert all(a<=b for a,b in zip(times,times[1:])),action['name']
  duration=max(duration,max(times)-min(times));values=list(rows(sampler['output']))
  if any(any(abs(a-b)>.005 for a,b in zip(values[0],value))for value in values[1:]):
   moving.append(doc['nodes'][channel['target']['node']]['name']+'.'+channel['target']['path'])
 assert duration>=.6 and len(moving)>=2,(action['name'],duration,moving)
 clips.append({'name':action['name'],'duration':duration,'movingTracks':moving})
expected={'Idle','Walk','Run','Cycle','March','Sit','Talk','Watch','Drink','Serve','Dance','OpenAwning'}
variants=[{'name':n['extras']['character']} for n in doc['nodes'] if 'character' in n.get('extras',{})]
assert len(doc['skins'])==len(variants)==24
expected_names={v['name']+'_'+clip for v in variants for clip in expected}
expected_names.update({'hero_female_Row','hero_male_Row'})
assert len(clips)==len(expected_names)
assert {c['name'] for c in clips}==expected_names
resident_scales=[n['extras'].get('heightScale') for n in doc['nodes'] if n.get('extras',{}).get('character','').startswith('resident_')]
assert len(resident_scales)==12 and all(isinstance(s,(int,float)) and .8<s<1.2 for s in resident_scales)
assert len(set(resident_scales))>=8,'Resident heights must remain distinct'

report={'glbBytes':len(b),'skins':skin_checks,'clips':clips,'defaultEyesOpen':True}
print(json.dumps({'skins':len(doc['skins']),'skinnedNodes':len(skin_checks),'clips':len(clips),'defaultEyesOpen':True,'bytes':len(b)}))
