"""Share one atlas next to the GLBs instead of embedding duplicate PNG data."""
import json
import struct
from pathlib import Path

def share_atlas(path):
    data=Path(path).read_bytes()
    json_size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_size])
    binary=data[28+json_size:]
    removed={im['bufferView'] for im in doc.get('images',[]) if 'bufferView' in im}
    if not removed:return
    remap={}
    views=[]
    blob=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        if i in removed:continue
        remap[i]=len(views)
        offset=view.get('byteOffset',0)
        entry={**view,'byteOffset':len(blob)}
        blob.extend(binary[offset:offset+view['byteLength']])
        blob.extend(b'\0'*((-len(blob))%4))
        views.append(entry)
    for acc in doc.get('accessors',[]):
        if 'bufferView' in acc:acc['bufferView']=remap[acc['bufferView']]
        for kind in ['indices','values']:
            part=acc.get('sparse',{}).get(kind)
            if part:part['bufferView']=remap[part['bufferView']]
    for im in doc.get('images',[]):
        im.pop('bufferView',None)
        im.pop('mimeType',None)
        im['uri']='craft-atlas.png'
    doc['bufferViews']=views
    doc['buffers'][0]['byteLength']=len(blob)
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    packed=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(blob))
    packed+=struct.pack('<I4s',len(encoded),b'JSON')+encoded
    packed+=struct.pack('<I4s',len(blob),b'BIN\0')+blob
    Path(path).write_bytes(packed)

if __name__=='__main__':
    for path in (Path(__file__).resolve().parent.parent/'public/models/craft').glob('*.glb'):share_atlas(path)
