/**
 * Castle sprites — flat isometric diamonds (64x32), BR→TL viewpoint.
 * Matches the terrain sprite format from generate-iso-sprites-br-tl.js
 */
const sharp = require('sharp');
const path = require('path');
const TILE_W = 64, TILE_H = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Castle palette
const WALL=[175,162,135],WALL_LIGHT=[195,182,155],WALL_DARK=[125,115,95],WALL_MORTAR=[145,135,112];
const TOWER=[155,145,120],TOWER_LIGHT=[178,168,142],TOWER_DARK=[105,98,80];
const WOOD=[120,78,38],WOOD_LIGHT=[145,98,50],WOOD_DARK=[85,55,25];
const IRON=[55,55,58],IRON_LIGHT=[75,75,78];
const STRAW=[195,175,95],STRAW_DARK=[165,145,70];
const BORDER=[25,25,22];
const ROAD=[210,165,110];

let seed=1;
function sr(){seed=(seed*1664525+1013904223)&0xFFFFFFFF;return(seed>>>0)/0xFFFFFFFF;}
function rs(s){seed=s;}
function createBuf(){return Buffer.alloc(TILE_W*TILE_H*4);}
function px(buf,x,y,r,g,b){if(x<0||x>=TILE_W||y<0||y>=TILE_H)return;const i=(y*TILE_W+x)*4;buf[i]=Math.max(0,Math.min(255,Math.round(r)));buf[i+1]=Math.max(0,Math.min(255,Math.round(g)));buf[i+2]=Math.max(0,Math.min(255,Math.round(b)));buf[i+3]=255;}
function inD(x,y){return(Math.abs(x-32)/32+Math.abs(y-16)/16)<=1;}
function fillD(buf,color,noise,sv){rs(sv);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*noise;px(buf,x,y,color[0]+n,color[1]+n,color[2]+n);}}

function drawStones(buf,base,light,mortar,sv){
    rs(sv);
    fillD(buf,mortar,6,sv);
    rs(sv+100);
    for(let sy=0;sy<TILE_H;sy+=6){
        const off=((sy/6)%2===0)?0:4;
        for(let sx=off;sx<TILE_W;sx+=8){
            const sw=6+Math.floor(sr()*2);
            const sh=4+Math.floor(sr()*2);
            const col=sr()>0.4?light:base;
            for(let dy=1;dy<sh;dy++)for(let dx=1;dx<sw;dx++)
                if(inD(sx+dx,sy+dy)){const n=(sr()-0.5)*8;px(buf,sx+dx,sy+dy,col[0]+n,col[1]+n,col[2]+n);}
        }
    }
}

function drawBorder(buf){for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++){const i=(y*TILE_W+x)*4;if(buf[i+3]===0)continue;let e=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=TILE_W||ny<0||ny>=TILE_H){e=true;continue;}if(buf[(ny*TILE_W+nx)*4+3]===0)e=true;}if(e){buf[i]=BORDER[0];buf[i+1]=BORDER[1];buf[i+2]=BORDER[2];}}}

// Castle bridge
function genBridgeStart(){const buf=createBuf();rs(10000);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*10;if(x<32)px(buf,x,y,ROAD[0]+n,ROAD[1]+n*0.8,ROAD[2]+n*0.6);else{const pl=y%5===0;px(buf,x,y,...(pl?WOOD_DARK:WOOD));}}drawBorder(buf);return buf;}
function genBridgeMid(){const buf=createBuf();rs(10100);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*8;const pl=y%5===0;px(buf,x,y,...(pl?WOOD_DARK:(sr()>0.7?WOOD_LIGHT:WOOD)));}drawBorder(buf);return buf;}
function genBridgeGate(){const buf=createBuf();rs(10200);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*8;if(x<32){const pl=y%5===0;px(buf,x,y,...(pl?WOOD_DARK:WOOD));}else px(buf,x,y,WALL[0]+n,WALL[1]+n,WALL[2]+n);}drawBorder(buf);return buf;}

// Tower (circular on diamond)
function genTower(){const buf=createBuf();fillD(buf,TOWER,8,11000);const cx=32,cy=16,r=12;rs(11100);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const d=Math.sqrt(dx*dx+dy*dy);if(d<=r&&inD(cx+dx,cy+dy)){const n=(sr()-0.5)*8;const c=d>r-2?TOWER_DARK:(d>r-4?TOWER:TOWER_LIGHT);px(buf,cx+dx,cy+dy,c[0]+n,c[1]+n,c[2]+n);}}for(let a=0;a<10;a++){const ang=(a/10)*Math.PI*2;px(buf,cx+Math.round((r-1)*Math.cos(ang)),cy+Math.round((r-1)*Math.sin(ang)*0.5),...TOWER_DARK);}drawBorder(buf);return buf;}

// Keep parts (4 tiles)
function genKeepTL(){const buf=createBuf();drawStones(buf,TOWER,TOWER_LIGHT,WALL_MORTAR,12000);drawBorder(buf);return buf;}
function genKeepBL(){const buf=createBuf();drawStones(buf,TOWER,TOWER_LIGHT,WALL_MORTAR,12200);drawBorder(buf);return buf;}
function genKeepBR(){const buf=createBuf();drawStones(buf,TOWER,TOWER_LIGHT,WALL_MORTAR,12300);drawBorder(buf);return buf;}
function genKeepCenter(){
    const buf=createBuf();drawStones(buf,TOWER_LIGHT,[200,190,165],WALL_MORTAR,12400);
    // Flag pole + flag
    for(let y=4;y<=18;y++){px(buf,32,y,55,35,18);px(buf,33,y,65,42,22);}
    rs(12500);for(let fy=0;fy<7;fy++){const wave=Math.round(Math.sin(fy*0.8)*1.5);for(let fx=0;fx<9;fx++){const n=(sr()-0.5)*6;if(inD(34+fx+wave,4+fy))px(buf,34+fx+wave,4+fy,200+n,30,25);}}
    // Gold trim
    for(let fx=0;fx<9;fx++){if(inD(34+fx,4))px(buf,34+fx,4,230,190,50);if(inD(34+fx,10))px(buf,34+fx,10,230,190,50);}
    drawBorder(buf);return buf;
}

// Gatehouse
function genGatehouse(){const buf=createBuf();drawStones(buf,WALL,WALL_LIGHT,WALL_MORTAR,13000);rs(13100);for(let y=8;y<=24;y++)for(let x=22;x<=42;x++)if(inD(x,y))px(buf,x,y,25,22,20);for(let x=23;x<=41;x+=3)for(let y=9;y<=23;y++)if(inD(x,y))px(buf,x,y,...IRON);for(let y=10;y<=22;y+=3)for(let x=22;x<=42;x++)if(inD(x,y))px(buf,x,y,...IRON_LIGHT);drawBorder(buf);return buf;}

// Wall (full stone)
function genWall(){const buf=createBuf();drawStones(buf,WALL,WALL_LIGHT,WALL_MORTAR,14000);drawBorder(buf);return buf;}

// Bailey (dirt + hay)
function genBailey1(){const buf=createBuf();rs(16000);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*12;px(buf,x,y,200+n,155+n*0.8,100+n*0.6);}rs(16050);for(let i=0;i<15;i++){const sx=Math.floor(sr()*TILE_W),sy=Math.floor(sr()*TILE_H);const len=3+Math.floor(sr()*4);const ang=sr()*Math.PI;for(let d=0;d<len;d++){const dx=Math.round(Math.cos(ang)*d),dy=Math.round(Math.sin(ang)*d);if(inD(sx+dx,sy+dy))px(buf,sx+dx,sy+dy,...STRAW);}}drawBorder(buf);return buf;}
function genBailey2(){const buf=createBuf();rs(16100);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*10;const isS=sr()>0.3;if(isS)px(buf,x,y,STRAW[0]+n,STRAW[1]+n,STRAW[2]+n);else px(buf,x,y,195+n,150+n*0.8,95+n*0.6);}drawBorder(buf);return buf;}
function genBailey3(){const buf=createBuf();rs(16300);for(let y=0;y<TILE_H;y++)for(let x=0;x<TILE_W;x++)if(inD(x,y)){const n=(sr()-0.5)*10;const c=sr()>0.2?STRAW:STRAW_DARK;px(buf,x,y,c[0]+n,c[1]+n,c[2]+n);}drawBorder(buf);return buf;}

async function generateAll(){
    const sprites=[
        {name:'castle-bridge-start',buf:genBridgeStart()},{name:'castle-bridge-mid',buf:genBridgeMid()},{name:'castle-bridge-gate',buf:genBridgeGate()},
        {name:'castle-tower',buf:genTower()},
        {name:'castle-keep-tl',buf:genKeepTL()},{name:'castle-keep-bl',buf:genKeepBL()},{name:'castle-keep-br',buf:genKeepBR()},{name:'castle-keep-center',buf:genKeepCenter()},
        {name:'castle-gatehouse',buf:genGatehouse()},{name:'castle-wall',buf:genWall()},
        {name:'castle-bailey-1',buf:genBailey1()},{name:'castle-bailey-2',buf:genBailey2()},{name:'castle-bailey-3',buf:genBailey3()},
    ];
    for(const s of sprites){await sharp(s.buf,{raw:{width:TILE_W,height:TILE_H,channels:4}}).png().toFile(path.join(OUTPUT_DIR,`${s.name}.png`));console.log(`  ✓ ${s.name}.png`);}
    console.log(`\nDone! ${sprites.length} castle iso sprites (64x32).`);
}
generateAll().catch(e=>{console.error(e);process.exit(1);});
