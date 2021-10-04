(* RetroNick's version of popular fiveline puzzle/logic game          *)
(* This Program is free and open source. Do what ever you like with   *)
(* the code. Code has been ported from the DOS version                *)
(*                                                                    *)
(* If you can't sleep at night please visit my github and youtube     *)
(* channel. A sub and follow would be nice :)                         *)
(*                                                                    *)
(* Play Online                                                        *)
(* https://retronick.neocities.org/fiveline/game.html                 *)
(*                                                                    *)
(* https://github.com/RetroNick2020                                   *)
(* https://www.youtube.com/channel/UCLak9dN2fgKU9keY2XEBRFQ           *)
(* https://twitter.com/Nickshardware                                  *)
(* nickshardware2020@gmail.com                                        *)
(*                                                                    *)

unit graph;

interface
  uses Web,palette,bitfonts,SysUtils;

const
  VGA = 9;
  VGAHi = 2;
  SolidFill = 0;
  xHatchFill = 1;

  DefaultFont = 1;
  LatoFont    = 2;

  HorizDir    = 1;

procedure InitGraph(gd,gm : integer;path : string);
procedure Bar(x,y,x2,y2 : integer);
procedure Rectangle(x,y,x2,y2 : integer);
Procedure Line(x,y,x2,y2 : integer);
procedure FilledCircle(x,y,r : integer);
procedure FillEllipse(x,y,r1,r2 : integer);
procedure Circle(x,y,r : integer);
procedure SetTextStyle(Font, Direction, Size: integer);
procedure OutTextXY(x,y : integer;text : string);
procedure putpixel(x,y,color : integer);
procedure putpixel(x,y : integer);

procedure SetFillStyle(fstyle,fcolor : integer);
procedure SetColor(col : integer);


Procedure BitFontPutPixel(x,y : integer);


implementation

var
  canvas : TJSHTMLCanvasElement;
  ctx    : TJSCanvasRenderingContext2D;

  xscale : real;
  yscale : real;
  
  GraphicsMode : integer;
  GraphicsDriver : integer;
  ScreenWidth : integer;
  ScreenHeight : integer;

  FillStyle : integer;
  FillColor : integer;
  Color     : integer;

  FontName : integer;
  FontSize : integer;
  FontDirection : integer; 
  FontPixelSize : integer;

Procedure InitCanvas(width,height : integer);
begin
  canvas:=TJSHTMLCanvasElement(document.getElementById('canvas'));
  ctx:=TJSCanvasRenderingContext2D(canvas.getContext('2d'));
  canvas.width:=width;
  canvas.height:=height;
end;

procedure SetScale(xsize,ysize : real);
begin
  xscale:=xsize;
  yscale:=ysize;
end;

procedure Bar(x,y,x2,y2 : integer);
var
  width, height : integer;
  cr : TRMColorRec;
  temp : integer;
begin
  if x  > x2 then
  begin  
    temp:=x2;
    x2:=x;
    x:=temp;
  end;  
  if y  > y2 then
  begin  
    temp:=y2;
    y2:=y;
    y:=temp;
  end;  
  GetRGBVGA(fillcolor,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  width:=trunc(real((abs(x2-x)+1)*xscale));
  height:=trunc(real((abs(y2-y)+1)*yscale));
  ctx.fillRect(x*xscale, y*yscale, width, height);
end;

procedure SetColor(col : integer);
begin
 color:=col;
end;

procedure Rectangle(x,y,x2,y2 : integer);
var
  width, height : integer;
  cr : TRMColorRec;
  temp : integer;
begin
  GetRGBVGA(color,cr);
  if x  > x2 then
  begin  
    temp:=x2;
    x2:=x;
    x:=temp;
  end;  
  if y  > y2 then
  begin  
    temp:=y2;
    y2:=y;
    y:=temp;
  end;  
 
  width:=trunc((abs(x2-x)+1)*xscale);
  height:=trunc((abs(y2-y)+1)*yscale);
  ctx.strokestyle:='rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.linewidth:=xscale;
  ctx.strokeRect(x*xscale, y*yscale, width, height);
end;

Procedure Line(x,y,x2,y2 : integer);
var
 cr : TRMColorRec;
begin
  GetRGBVGA(color,cr);
  ctx.strokestyle:='rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.linewidth:=xscale;
  ctx.beginPath();     
  ctx.moveTo(x*xscale, y*yscale);   
  ctx.lineTo(x2*xscale, y2*yscale);  
  ctx.stroke()
end;

procedure Circle(x,y,r : integer);
var
 cr : TRMColorRec;
begin
  GetRGBVGA(color,cr);
  ctx.strokestyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.beginPath();
  ctx.linewidth:=xscale;
  ctx.arc(x*xscale, y*yscale,r*xscale, 0, 2 * pi);
  ctx.stroke();
end;

procedure FilledCircle(x,y,r : integer);
var
 cr : TRMColorRec;
begin
  ctx.beginPath();
  ctx.linewidth:=xscale;
  ctx.arc(x*xscale, y*yscale,r*xscale, 0, 2 * pi);
  GetRGBVGA(color,cr);
  ctx.strokestyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.stroke();
  GetRGBVGA(fillcolor,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.fill();
end;


procedure FillEllipse(x,y,r1,r2 : integer);
var
 cr : TRMColorRec;
begin
  ctx.beginPath();
  ctx.linewidth:=xscale;
  //ctx.arc(x*xscale, y*yscale,r*xscale, 0, 2 * pi);
  ctx.ellipse(x*xscale, y*yscale, r1*xscale, r2*yscale,0, 0, 2 * pi);

  GetRGBVGA(color,cr);
  ctx.strokestyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.stroke();
  GetRGBVGA(fillcolor,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.fill();
end;

procedure SetTextStyle(Font, Direction , Size: integer);
begin
  FontName:=Font;
  FontSize:=Size;
  FontDirection:=Direction;
  FontPixelSize:=Trunc(Size*xscale);
  if FontName = LatoFont then ctx.font:='28px lato';
end;

procedure BitFontTextOutXY(x,y : integer; text : string);
var
 i,j,k,pwidth,pheight : integer;
 xpos,ypos : integer;
begin
 pwidth:=2;
 pheight:=2;
 if FontSize = 1 then
 begin
  // pwidth:=trunc(1*xscale);
 //  pheight:=trunc(1*yscale);
 end
 else if FontSize = 2 then
 begin
   pwidth:=trunc(2*xscale);
   pheight:=trunc(2*yscale);
 end;

 xpos:=trunc(x*xscale);
 ypos:=trunc(y*yscale);

 for k:=1 to Length(text) do
 begin
   for j:=0 to 7 do
   begin
     for i:=0 to 7 do
     begin
        if GetFontPixel(ord(text[k]),i,j) = 1 then
        begin
           ctx.fillRect(xpos+(i*pwidth), ypos+(j*pheight), pwidth,pheight);
        end;
     end;
   end;     
   inc(xpos,pwidth*8);
 end;
end;

procedure OutTextXY(x,y : integer;text : string);
var
  cr : TRMColorRec;
begin
  //inc(y,10);
  GetRGBVGA(color,cr);
  ctx.fillstyle:='rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
//  ctx.font:='28px lato';
  if FontName = DefaultFont then
  begin
     //TextAt(Trunc(x*xscale), Trunc(y*yscale),text);
     BitFontTextOutXY(x, y,text);
     
  end
  else
  begin
    ctx.fillText(text, x*xscale, y*yscale );
  end;  
end;

 
procedure putpixel(x,y,color : integer);
var
  cr : TRMColorRec;
begin
  GetRGBVGA(color,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.fillRect(x*xscale, y*yscale, xscale,yscale);
end;

procedure putpixel(x,y : integer);
var
  cr : TRMColorRec;
begin
  GetRGBVGA(color,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
  ctx.fillRect(x*xscale, y*yscale, xscale,yscale);
end;


Procedure BitFontPutPixel(x,y : integer);
begin
  //ctx.fillRect(x*xscale, y*yscale,FontPixelSize*xscale,FontPixelSize*xscale);
 putpixel(x,y);
end;

procedure InitGraph(gd,gm : integer; path : string);
begin
  GraphicsMode:=gm;
  GraphicsDriver:=gd;
  if (GraphicsDriver = VGA) and (GraphicsMode = VGAHi) then
  begin  
    ScreenWidth:=800;
    ScreenHeight:=480;
    InitCanvas(trunc(real(ScreenWidth*1.5)),trunc(real(ScreenHeight*1.5)));
    SetScale(1.5,1.5);
  end;  

  InitBitFonts;
  SetBitFontPixelProc(@BitFontPutPixel);
end;

procedure SetFillStyle(fstyle,fcolor : integer);
var
 cr : TRMColorRec;
begin
  FillStyle:=fstyle;
  FillColor:=fcolor;
  GetRGBVGA(fcolor,cr);
  ctx.fillStyle := 'rgb('+IntToStr(cr.r)+','+IntToStr(cr.g)+','+IntToStr(cr.b)+')';
end;

begin
end.
