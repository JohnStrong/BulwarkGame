/**
 * Flat isometric diamond sprites — Viewpoint: BR → TL
 * Simple 2D diamonds (no 3D depth). Sprite size: 64x32.
 */
const sharp = require('sharp');
const path = require('path');
const TILE_W = 64, TILE_H = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');
const GRASS=[95,180,72],GRASS_DARK=[75,155,55],ROAD=[210,165,110],WATER=[45,120,210];
const BRIDGE=[140,138,128],TREE_TOP=[48,130,42],TREE_DARK=[28,85,25],TREE_LIGHT=[75,170,60];
const BORDER=[30,30,28];
let seed=1;
function sr(){seed=(seed*1664525+1013904223)&0xFFFFFFFF;return(seed>>>0)/0xFFFFFFFF;}
function rs(s){seed=s;}
function createBuf(){return Buffer.alloc(TILE_W*TILE_H*4);}
function px(buf,x,y,r,g,b){if(x<0||x>=TILE_W||y<0||y>=TILE_H)return;const i=(y*TILE_W+x)*4;buf[i]=Math.max(0,Math.min(255,Math.round(r)));buf[i+1]=Math.max(0,Math.min(255,Math.round(g)));buf[i+2]=Math.max(0,Math.min(255,Math.round(b)));buf[i+3]=255;}
function inD(x,y){return(Math.abs(x-32)/32+Math.abs(y-16)/16)<=1;}
function fillD(buf,color,noise,sv){rs(sv);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*noise;const d=sr()>0.92?10:(sr()<0.08?-8:0);px(buf,x,y,color[0]+n+d,color[1]+n+d,color[2]+n+d);}}
function drawBorder(buf){for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++){const i=(y*TILE_W+x)*4;if(buf[i+3]===0)continue;let e=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=TILE_W||ny<0||ny>=TILE_H){e=true;continue;}if(buf[(ny*TILE_W+nx)*4+3]===0)e=true;}if(e){buf[i]=BORDER[0];buf[i+1]=BORDER[1];buf[i+2]=BORDER[2];}}}

function genGrass(v){const buf=createBuf();fillD(buf,GRASS,12,1000+v*100);rs(1080+v*100);for(let i=0;i<8;i++){const x=Math.floor(sr()*TILE_W),y=Math.floor(sr()*TILE_H);if(inD(x,y))px(buf,x,y,...GRASS_DARK);}drawBorder(buf);return buf;}
function genFlowers(v){const buf=createBuf();fillD(buf,GRASS,12,2000+v*100);rs(2080+v*100);const cols=[[240,80,120],[255,200,50],[220,220,240],[180,100,220]];for(let i=0;i<4;i++){const fx=12+Math.floor(sr()*40),fy=4+Math.floor(sr()*24);if(inD(fx,fy)){const c=cols[Math.floor(sr()*4)];px(buf,fx,fy,...c);px(buf,fx+1,fy,...c);px(buf,fx-1,fy,...c);px(buf,fx,fy-1,...c);px(buf,fx,fy+1,...c);}}drawBorder(buf);return buf;}
function genRoad(){const buf=createBuf();fillD(buf,ROAD,10,3000);rs(3080);for(let i=0;i<5;i++){let cx=Math.floor(sr()*TILE_W),cy=Math.floor(sr()*TILE_H);for(let d=0;d<4;d++){if(inD(cx,cy))px(buf,cx,cy,170,130,80);cx+=Math.floor(sr()*3)-1;cy+=Math.floor(sr()*3)-1;}}drawBorder(buf);return buf;}
function genWater(v){const buf=createBuf();fillD(buf,WATER,8,4000+v*100);rs(4080+v*100);for(let i=0;i<4;i++){const rx=10+Math.floor(sr()*44),ry=4+Math.floor(sr()*24);if(inD(rx,ry))for(let d=0;d<4;d++)px(buf,rx+d,ry,80,155,235);}drawBorder(buf);return buf;}
function genBridge(){const buf=createBuf();fillD(buf,BRIDGE,8,5000);rs(5080);for(let sy=0;sy<TILE_H;sy+=5){const off=(sy/5)%2===0?0:4;for(let sx=off;sx<TILE_W;sx+=8)for(let dy=1;dy<3;dy++)for(let dx=1;dx<5;dx++)if(inD(sx+dx,sy+dy)){const n=(sr()-0.5)*6;px(buf,sx+dx,sy+dy,155+n,152+n,142+n);}}drawBorder(buf);return buf;}
function genTree(v){const buf=createBuf();fillD(buf,GRASS,10,6000+v*100);
// Trunk visible from BR→TL (bottom-right of canopy)
const cx=32,cy=16,r=9+(v%2)*2;
const trunkX=cx+3,trunkY=cy+4;
rs(6070+v*100);
// Shadow on ground
for(let dy=-2;dy<=2;dy++)for(let dx=-4;dx<=4;dx++)if(inD(cx+dx+2,cy+dy+r-2)){const n=(sr()-0.5)*3;px(buf,cx+dx+2,cy+dy+r-2,55+n,120+n,38+n);}
// Trunk (visible below-right of canopy, bark texture)
for(let dy=-3;dy<=5;dy++)for(let dx=-2;dx<=2;dx++){if(inD(trunkX+dx,trunkY+dy)){const n=(sr()-0.5)*6;const bark=dx>0?[95,62,30]:[70,45,22];px(buf,trunkX+dx,trunkY+dy,bark[0]+n,bark[1]+n,bark[2]+n);}}
// Canopy (overlaps trunk partially)
rs(6080+v*100);
for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const d=Math.sqrt(dx*dx+dy*dy);if(d<=r&&inD(cx+dx,cy+dy-2)){const n=(sr()-0.5)*8;const c=(d<r*0.35&&dy<0)?TREE_LIGHT:(d>r*0.72?TREE_DARK:TREE_TOP);px(buf,cx+dx,cy+dy-2,c[0]+n,c[1]+n,c[2]+n);}}
drawBorder(buf);return buf;}
function genRock(){const buf=createBuf();fillD(buf,GRASS,10,7000);const cx=32,cy=16;rs(7080);for(let dy=-4;dy<=4;dy++)for(let dx=-5;dx<=5;dx++)if(dx*dx+dy*dy<=20&&inD(cx+dx,cy+dy)){const n=(sr()-0.5)*8;px(buf,cx+dx,cy+dy,130+n,128+n,122+n);}drawBorder(buf);return buf;}

async function generateAll(){
    const sprites=[
        {name:'grass-short-1',buf:genGrass(0)},{name:'grass-short-2',buf:genGrass(1)},
        {name:'grass-flowers-1',buf:genFlowers(0)},{name:'grass-flowers-2',buf:genFlowers(1)},
        {name:'road-full',buf:genRoad()},
        {name:'water-1',buf:genWater(0)},{name:'water-2',buf:genWater(1)},{name:'water-3',buf:genWater(2)},
        {name:'bridge-mm',buf:genBridge()},
        {name:'tree-1',buf:genTree(0)},{name:'tree-2',buf:genTree(1)},{name:'tree-3',buf:genTree(2)},
        {name:'tree-4',buf:genTree(3)},{name:'tree-5',buf:genTree(4)},{name:'tree-6',buf:genTree(5)},{name:'tree-7',buf:genTree(6)},
        {name:'rock',buf:genRock()},
    ];
    for(const s of sprites){await sharp(s.buf,{raw:{width:TILE_W,height:TILE_H,channels:4}}).png().toFile(path.join(OUTPUT_DIR,`${s.name}.png`));console.log(`  ✓ ${s.name}.png`);}
    console.log(`\nDone! ${sprites.length} flat diamond sprites (64x32).`);
}
generateAll().catch(e=>{console.error(e);process.exit(1);});
