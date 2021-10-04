(*
// Port of fiveline game By RetroNick on October 4 - 2021
//
// my live running version
// https://retronick.neocities.org/fiveline/game.html
//
// my github 
// https://github.com/RetroNick2020
// 
// my youtube channel
// https://www.youtube.com/channel/UCLak9dN2fgKU9keY2XEBRFQ
*)

Program Game;
  uses Web,p2jsres,graph,palette,bitfonts,fiveline;

{$R ibmfontvga.bin}


var
 timer_id : NativeInt;

Procedure InitGame;
begin
  fivelineInit;
end;

function HandleKeyDown(k : TJSKeyBoardEvent) : Boolean;
begin
  if k.code = TJSKeyNames.ArrowLeft then ProcessKeys(LEFT);
  if k.code = TJSKeyNames.ArrowRight then ProcessKeys(RIGHT);
  if k.code = TJSKeyNames.ArrowDown then ProcessKeys(DOWN);
  if k.code = TJSKeyNames.ArrowUp then ProcessKeys(UP);

  if k.code = TJSKeyNames.Enter then ProcessKeys(ENTER);
  if k.code = 'KeyL' then ProcessKeys(ENTER);
  if k.code = 'KeyR' then ProcessKeys(START);
  if k.code = 'KeyC' then ProcessKeys(CHEAT);
  if (k.code = 'KeyQ') or (k.code = 'KeyX') then 
  begin
    window.open('https://github.com/RetroNick2020','_self');
  end;
  if k.key = '0' then ProcessKeys(KEY0);
  if k.key = '1' then ProcessKeys(KEY1);
  if k.key = '2' then ProcessKeys(KEY2);
  if k.key = '3' then ProcessKeys(KEY3);
  if k.key = '4' then ProcessKeys(KEY4);
  if k.key = '5' then ProcessKeys(KEY5);
  if k.key = '6' then ProcessKeys(KEY6);
 
end;

begin
  SetResourceSource(rsHTML); //do not forget this line
  InitGraph(VGA,VGAHi,'');
  SetBitFontPixelProc(@BitFontPutPixel); 
 
  SetTextStyle(DefaultFont,HorizDir,2);
  InitGame;
 
  document.onkeydown:=@HandleKeyDown;
  timer_id:=window.setInterval(@DrawQueueProcessTimer,10);
end.