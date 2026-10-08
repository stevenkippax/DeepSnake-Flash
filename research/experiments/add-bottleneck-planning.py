from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();Path('work/snake-game/navigation-before-bottlenecks.js').write_text(s);s=s.replace('function raster(obs,radius,future)', 'function raster(obs,radius,future,threshold=-.2)');s=s.replace('clear[j]<-.2', 'clear[j]<threshold').replace('clear[row*width+nc]<-.2', 'clear[row*width+nc]<threshold').replace('clear[nr*width+col]<-.2', 'clear[nr*width+col]<threshold').replace('clear[start]<-.2', 'clear[start]<threshold');s=s.replace('function nearest(space,x,y)', 'function nearest(space,x,y,allowed=null)').replace('if(i<0||space.labels[i]<0)continue;', 'if(i<0||space.labels[i]<0 || allowed&&!allowed(i))continue;')
a='''    const closing=area>laterArea+15 && laterArea<area*.75 && laterArea<accessibleLargest*.4;
    const confined=''';b='''    const closing=area>laterArea+15 && laterArea<area*.75 && laterArea<accessibleLargest*.4;
    const wide=raster(obs,radius,0,2);
    let wideAccessible=0;
    if(room)for(let i=0;i<total;i++)if(current.labels[i]===room.id && wide.labels[i]>=0)wideAccessible=Math.max(wideAccessible,wide.regions[wide.labels[i]].area);
    const wideStart=nearest(wide,x,y,i=>current.labels[i]===room?.id),wideOwn=wideStart<0?0:wide.regions[wide.labels[wideStart]].area;
    const pinched=area>wideOwn+50 && wideOwn<wideAccessible*.3 && wideOwn<500 && wideAccessible>=80;
    const confined=''';assert a in s;s=s.replace(a,b)
s=s.replace('if(closing) {\n      const heads=', 'if(closing || pinched) {\n      const heads=')
a='''i=>{const id=future.labels[i];return id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.6,laterArea*1.5);}''';b='''i=>{const id=future.labels[i],w=wide.labels[i];return pinched ? w>=0&&wide.regions[w].area>=Math.max(80,wideAccessible*.6) && id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.3) : id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.6,laterArea*1.5);}''';assert a in s;s=s.replace(a,b)
s=s.replace('const waiting=(closing&&!escapePath.length)||confined;', 'const waiting=((closing||pinched)&&!escapePath.length)||confined;')
s=s.replace('largestAccessibleFutureArea:accessibleLargest,closing,confined', 'largestAccessibleFutureArea:accessibleLargest,wideArea:wideOwn,wideAccessibleArea:wideAccessible,pinched,closing,confined')
p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();s=s.replace('closing:navigation.closing,confined', 'closing:navigation.closing,pinched:navigation.pinched,wideArea:navigation.wideArea,wideAccessibleArea:navigation.wideAccessibleArea,confined');s=s.replace('evacuating=!!navigation?.closing&&', 'evacuating=!!(navigation?.closing||navigation?.pinched)&&');p.write_text(s)
p=Path('work/snake-game/check-topology.cjs');s=p.read_text();s += "\nconst fragile=n.analyze(0,0,box,.3);assert(fragile.pinched&&!fragile.closing&&fragile.escapePath.length,'A pocket with a narrow mouth must trigger early relocation before a head starts sealing it');\n";p.write_text(s)
