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


Unit RESread;

Interface
uses
  Web,p2jsres;


type
  FileRes = record
              Buffer : String;
              Length : LongInt;
              Position : LongInt;
  end;

Procedure RESAssignFile(var F : FileRes; resID : string);
function RESreadByte(var F : FileRes)  : byte;
function RESreadWord(var F : FileRes) : word;
function RESFileSize(var F : FileRes) : longint;
procedure RESSeek(var F : FileRes;pos : longint);
function ResEOF(var F : FileRes) : boolean;
function RESreadLine(var F : FileRes) : string;

Implementation


Procedure RESAssignFile(var F : FileRes; resID : string);
var
  Info  : TResourceInfo;
begin
 F.Position:=0;
 F.Length:=0;
 if not GetResourceInfo(resID,Info) then
 begin
    Writeln('No info for RES file!');
 end   
 else
 begin
    F.Buffer:=window.atob(Info.data);
    F.Length:=Length(F.Buffer);
 end;   
end;

function ResEOF(var F : FileRes) : boolean;
begin
  if F.Position = F.Length then result:=true else result:=false;
end;

function RESFileSize(var F : FileRes) : longint;
begin
  result:=F.Length;
end;

procedure RESSeek(var F : FileRes;pos : longint);
begin
  if (pos > -1) and (pos < F.Length) then F.Position:=pos;
end;

function RESreadByte(var F : FileRes)  : byte;
begin
 result:=0;
 if F.Position <> F.Length then  
 begin
   inc(F.Position);
   result:=ord(F.Buffer[F.Position]); 
 end;  
end;

function RESreadWord(var F : FileRes) : word;
var
  b1,b2 : byte;
begin
  b1:=RESreadByte(F);
  b2:=RESreadByte(F);
  result:=(b2 shl 8) + b1;
end;

// extra function to read text line
// 13  = \r   10 = \n

function RESreadLine(var F : FileRes) : string;
var
  LineStr : string;
  b1      : byte;
begin
  LineStr:='';
 
  While (Not ResEOF(F)) do
  begin
     b1:=RESreadByte(F);
     if b1 = 10 then
     begin
        result:=LineStr;
        exit;
     end
     else if b1<>13 then
     begin
       LineStr:=concat(LineStr,chr(b1));
     end;  
  end;   
   result:=LineStr;
end;

begin
end.