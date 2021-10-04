(*
// pas2js Resource Utilities (RESUtils) example
// see video for additional info
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

Unit Bits;

Interface

Function BitOn(Position,Testbyte : Byte) : Boolean;
Procedure SetBit(Position, Value : Byte; Var Changebyte : Byte);

Implementation

Function BitOn(Position,Testbyte : Byte) : Boolean;
Var
  Bt : Byte;
Begin
  Bt :=$01;
  Bt :=Bt Shl Position;
  Biton :=(Bt And Testbyte) > 0;
End;

Procedure SetBit(Position, Value : Byte; Var Changebyte : Byte);
Var
  Bt : Byte;
Begin
  Bt :=$01;
  Bt :=Bt Shl Position;
  If Value = 1 then
     Changebyte :=Changebyte Or Bt
  Else
   Begin
     Bt :=Bt Xor $FF;
     Changebyte :=Changebyte And Bt;
  End;
End;

begin
end.