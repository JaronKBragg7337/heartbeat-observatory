"""Blender 5.1: blender -b -P build_fly.py -- SOURCE_ASSETS OUTPUT_GLB.
Measured geometry and body transforms: TuragaLab/flybody, Apache-2.0.
Coordinates are parsed directly: no OBJ importer axis conversion. CGS -> metres.
"""
import bpy, bmesh, sys, json, xml.etree.ElementTree as ET
from pathlib import Path
from mathutils import Quaternion
source, output = map(Path, sys.argv[sys.argv.index('--')+1:])
xml = ET.parse(source/'fruitfly.xml').getroot()
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
defaults = {}
def collect(el, inherited):
    merged={k:dict(v) for k,v in inherited.items()}
    for c in el:
        if c.tag!='default': merged.setdefault(c.tag,{}).update(c.attrib)
    defaults[el.get('class','main')]=merged
    for c in el.findall('default'): collect(c,merged)
collect(xml.find('default'),{})
def attrs(el, cls): return {**defaults.get(el.get('class',cls),{}).get(el.tag,{}),**el.attrib}
def vec(s): return list(map(float,s.split()))
def transform(obj, el):
    obj.location=vec(el.get('pos','0 0 0'))
    obj.rotation_mode='QUATERNION'; obj.rotation_quaternion=Quaternion(vec(el.get('quat','1 0 0 0'))).normalized()
def empty(name,parent):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o['assetId']='FLY.'+name; return o
materials={}
for m in xml.findall('asset/material'):
    mat=bpy.data.materials.new(m.get('name')); mat.use_nodes=True
    rgba=vec(m.get('rgba','0.674 0.35 0.143 1')); bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=rgba; bsdf.inputs['Roughness'].default_value=.38
    bsdf.inputs['Alpha'].default_value=rgba[3]
    if rgba[3]<1: mat.surface_render_method='DITHERED'
    materials[m.get('name')]=mat
meshes={m.get('name'):m for m in xml.findall('asset/mesh')}
root=empty('flybody',None); root.scale=(.01,)*3; root['sourceUnits']='CGS; centimetres converted to metres'; root['sourceCommit']='d015e9bfe441bd90ae431bac24c55cb74bdbce26'; root['license']='Apache-2.0'
counts={'bodies':0,'meshes':0,'joints':0,'sourceFaces':0,'exportFaces':0}
def body(el,parent,cls='body'):
    cls=el.get('childclass',cls); o=empty(el.get('name'),parent); transform(o,el); counts['bodies']+=1
    joints=[]
    for j in el.findall('joint'):
        a=attrs(j,cls)
        if a.get('type')=='free': continue
        assert vec(a.get('pos','0 0 0'))==[0,0,0], 'Nonzero joint pivot requires an extra pivot node'
        axis=vec(a.get('axis','0 0 1'))
        joints.append({'name':a['name'],'axis':[axis[0],axis[2],-axis[1]],'range':vec(a.get('range','-3.141593 3.141593'))})
    o['jointsJson']=json.dumps(joints); counts['joints']+=len(joints)
    for g in el.findall('geom'):
        if not g.get('mesh'): continue
        a=attrs(g,cls); spec=attrs(meshes[g.get('mesh')],'main'); scale=vec(spec.get('scale','0.1 0.1 0.1'))
        vertices=[]; faces=[]
        for line in (source/spec.get('file')).read_text().splitlines():
            parts=line.split()
            if not parts: continue
            if parts[0]=='v': vertices.append(tuple(float(parts[i+1])*scale[i] for i in range(3)))
            elif parts[0]=='f': faces.append(tuple(int(p.split('/')[0])-1 for p in parts[1:]))
        mesh=bpy.data.meshes.new(g.get('mesh')); mesh.from_pydata(vertices,[],faces); mesh.update()
        bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7); bm.to_mesh(mesh); bm.free()
        obj=bpy.data.objects.new(g.get('mesh'),mesh); bpy.context.collection.objects.link(obj); obj.parent=o; transform(obj,g); obj['assetId']='FLY.mesh.'+g.get('mesh')
        mesh.materials.append(materials[a.get('material','body')])
        for p in mesh.polygons: p.use_smooth=True
        counts['sourceFaces']+=len(faces)
        if len(faces)>1500:
            mod=obj.modifiers.new('Silhouette budget','DECIMATE'); mod.ratio=max(.12,min(1,1500/len(faces)))
            bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=mod.name)
        counts['exportFaces']+=len(obj.data.polygons); counts['meshes']+=1
    for child in el.findall('body'): body(child,o,cls)
for b in xml.findall('worldbody/body'): body(b,root)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_yup=True,export_animations=False)
assert output.stat().st_size<8_000_000
output.with_suffix('.build.json').write_text(json.dumps({**counts,'bytes':output.stat().st_size,'sourceCommit':root['sourceCommit'],'meshScale':[.1,.1,.1],'metresPerSourceUnit':.01},indent=2))
print('FLY_BUILD',counts,output.stat().st_size)
