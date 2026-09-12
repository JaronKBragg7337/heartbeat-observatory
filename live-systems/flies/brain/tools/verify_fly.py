from pathlib import Path
import sys,json,struct,xml.etree.ElementTree as ET,math
p=Path(sys.argv[2]);b=p.read_bytes();g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
nodes=g['nodes'];ids={n.get('extras',{}).get('assetId'):i for i,n in enumerate(nodes)};parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
x=ET.parse(sys.argv[1]).getroot();count=0
for parent in x.findall('.//body'):
 for child in parent.findall('body'):
  assert parents[ids['FLY.'+child.get('name')]]==ids['FLY.'+parent.get('name')];count+=1
 for geom in parent.findall('geom'):
  if geom.get('mesh'):assert parents[ids['FLY.mesh.'+geom.get('mesh')]]==ids['FLY.'+parent.get('name')]
 for el,asset in [(parent,'FLY.'+parent.get('name'))]+[(e,'FLY.mesh.'+e.get('mesh')) for e in parent.findall('geom') if e.get('mesh')]:
  n=nodes[ids[asset]];pos=list(map(float,el.get('pos','0 0 0').split()));expected=[pos[0],pos[2],-pos[1]]
  assert max(abs(a-b) for a,b in zip(expected,n.get('translation',[0,0,0])))<1e-6
  w,qx,qy,qz=map(float,el.get('quat','1 0 0 0').split());norm=math.sqrt(w*w+qx*qx+qy*qy+qz*qz);q=[qx/norm,qz/norm,-qy/norm,w/norm];actual=n.get('rotation',[0,0,0,1]);assert abs(abs(sum(a*b for a,b in zip(q,actual)))-1)<1e-6
assert len(g['meshes'])==85;assert p.stat().st_size<8_000_000
print(json.dumps({'bodyParentEdges':count,'meshParents':85,'allBodyAndGeomTransforms':'match XML within 1e-6 after Y-up conversion','bytes':p.stat().st_size},indent=2))
