from pathlib import Path
import json, re, struct

root = Path(__file__).parent
blob = (root / 'global-metadata.dat').read_bytes()
source = (root / 'MetadataClass.cs').read_text(encoding='utf-8-sig')
version = struct.unpack_from('<I', blob, 4)[0]

def layout(name):
    body = re.search(r'public class '+name+r'\s*\{(.*?)\n    \}', source, re.S)[1]
    fields, pending = [], ''
    for line in body.splitlines():
        line = line.strip()
        if line.startswith('[Version'):
            pending = line
            continue
        m = re.match(r'public (uint|int|ushort) (\w+);', line)
        if not m:
            continue
        minimum = re.search(r'Min = ([\d.]+)', pending)
        maximum = re.search(r'Max = ([\d.]+)', pending)
        allowed = (not minimum or version >= float(minimum[1])) and (not maximum or version <= float(maximum[1]))
        pending = ''
        if allowed:
            fields.append((m[2], {'uint':'I', 'int':'i', 'ushort':'H'}[m[1]]))
    return fields

def read_struct(name, offset):
    fields = layout(name)
    fmt = '<'+''.join(t for _,t in fields)
    return dict(zip([n for n,_ in fields], struct.unpack_from(fmt, blob, offset)))

header = read_struct('Il2CppGlobalMetadataHeader', 0)
def string(index):
    start = header['stringOffset']+index
    return blob[start:blob.index(0, start)].decode(errors='replace')

def table(name, offset, size):
    stride = struct.calcsize('<'+''.join(t for _,t in layout(name)))
    assert size % stride == 0, (name, stride, size)
    return [read_struct(name, p) for p in range(offset, offset+size, stride)]

types = table('Il2CppTypeDefinition',header['typeDefinitionsOffset'],header['typeDefinitionsSize'])
fields = table('Il2CppFieldDefinition',header['fieldsOffset'],header['fieldsSize'])
methods = table('Il2CppMethodDefinition',header['methodsOffset'],header['methodsSize'])
output = []
for index,t in enumerate(types):
    name, ns = string(t['nameIndex']), string(t['namespaceIndex'])
    if not re.search(r'(Snake|Eatable|Pellet|GameConfig|WorldConfig|NetworkData|SynchronizationState|InputController|PlayerController|CameraController)',name):
        continue
    entry = {'index':index,'namespace':ns,'name':name,
             'fields':[string(f['nameIndex']) for f in fields[t['fieldStart']:t['fieldStart']+t['field_count']]],
             'methods':[string(m['nameIndex']) for m in methods[t['methodStart']:t['methodStart']+t['method_count']]]}
    output.append(entry)
(root/'game-types.json').write_text(json.dumps(output,indent=2))
print('Metadata version',version,'types',len(types),'selected',len(output))
for e in output:
    if re.search(r'(PlayerSnakeController|SnakeConfig|SnakePath|CameraController|SnakeNetworkData|SnakeSynchronizationState|PelletNetworkData|GameConfig|InputController)$', e['name']):
        print(json.dumps(e))
