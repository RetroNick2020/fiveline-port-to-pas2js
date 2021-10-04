(*
// pas2js Resource Utilities (RESUtils) 
// see video for additional info https://youtu.be/C84__bqi4YQ
//
// Please visit and subscribe to RetroNick's youtube channel and follow on github
// With more new subscribers youtube's algorithm will promote more content like this
//
// my github 
// https://github.com/RetroNick2020
// 
// my youtube channel
// https://www.youtube.com/channel/UCLak9dN2fgKU9keY2XEBRFQ
*)

unit bitfonts;

interface
  uses RESread,bits;
 
type  
  PutPixelProc = procedure(x,y : integer);

Procedure CharAt(x,y : integer; c : char);
Procedure TextAt(x,y : integer;msg : string);
function GetFontPixel(c, x, y : integer) : integer;
Procedure InitBitFonts;
Procedure LoadBitFont(filename : string);
procedure SetBitFontPixelProc(CustomPutPixel : PutPixelProc);

implementation

type
  FontCharRec = record
                  BitMap : array[0..7, 0..7] of Byte;
                end;

  FontRec = array[0..255] of FontCharRec;
var
  CurrentFont : FontRec;
  DefPutPixelProc : PutPixelProc;

procedure DefPutPixel(x,y : integer);
begin
end;

procedure SetBitFontPixelProc(CustomPutPixel : PutPixelProc);
begin
 DefPutPixelProc:=CustomPutPixel;  
end;

Procedure Load256Chars(var F : FileRes);
var
 i,j,k : integer;
 FontCharLine  : byte;
begin
 for k:=0 to 255 do
 begin
   for j:=0 to 7 do
   begin
       FontCharLine:=RESreadByte(F);
       for i:=0 to 7 do
       begin
         if BitOn(7-i,FontCharLine) then
         begin
           CurrentFont[k].BitMap[i,j]:=1;
         end
         else  
         begin
           CurrentFont[k].BitMap[i,j]:=0;
         end;
       end;  
   end;
 end;   
end;

Procedure CharAt(x,y : integer; c : char);
var
 i,j,char_index : integer;
begin
  char_index:=ord(c);
  //writeln('char index = ',char_index);
  For j:=0 to 7 do
  begin
    for i:=0 to 7 do
    begin
      //if CurrentFont[char_index].BitMap[i,j]=1 then PutPixel(x+i,y+j);
      if CurrentFont[char_index].BitMap[i,j]=1 then DefPutPixelProc(x+i,y+j);
    end;
  end;  
end;

Procedure TextAt(x,y : integer;msg : string);
var
 i : integer;
begin
  for i:=0 to Length(msg)-1 do
  begin
    CharAt(x+(i*8),y,msg[i+1]);   
  end; 
end;

function GetFontPixel(c, x, y : integer) : integer;
begin
  GetFontPixel:=CurrentFont[c].BitMap[x,y];
end;

//8x8 at the moment
Procedure LoadBitFont(filename : string);
var
 F : FileRes;
begin
  RESAssignFile(F,filename);
  Load256Chars(F);
end;

Procedure InitBitFonts;
begin
  DefPutPixelProc:=@DefPutPixel;  //this will print to nothing - you need to overide
  LoadBitFont('ibmfontvga');
end;

begin
end.