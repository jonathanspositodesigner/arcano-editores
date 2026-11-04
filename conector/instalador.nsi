; Instalador do Arcano Conector (Windows). Instala só para o usuário atual (sem admin),
; liga junto com o Windows (escondido, sem janela) e já deixa rodando.
Unicode true
!define NOME "Arcano Conector"
!ifndef VERSAO
  !define VERSAO "0.1.0"
!endif
Name "${NOME}"
OutFile "ArcanoConector-Instalador.exe"
InstallDir "$LOCALAPPDATA\ArcanoConector"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "arcano.ico"
UninstallIcon "arcano.ico"
BrandingText "ArcanoApp"
VIProductVersion "${VERSAO}.0"
VIAddVersionKey "ProductName" "${NOME}"
VIAddVersionKey "FileDescription" "Liga o Arcano Layers do navegador ao Claude Code do seu PC"
VIAddVersionKey "FileVersion" "${VERSAO}"
VIAddVersionKey "CompanyName" "ArcanoApp"

Page instfiles
UninstPage instfiles

Section "Instalar"
  ; Para a cópia antiga (se estiver rodando) antes de trocar o arquivo.
  nsExec::Exec 'taskkill /F /IM ArcanoConector.exe'
  Sleep 800
  SetOutPath "$INSTDIR"
  File "ArcanoConector.exe"
  File "arcano.ico"
  ; Lançador escondido: o .exe é de console; o wscript abre sem janela.
  FileOpen $0 "$INSTDIR\iniciar.vbs" w
  FileWrite $0 'CreateObject("WScript.Shell").Run """$INSTDIR\ArcanoConector.exe""", 0, False'
  FileClose $0
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ArcanoConector" 'wscript.exe "$INSTDIR\iniciar.vbs"'
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "DisplayName" "${NOME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "DisplayVersion" "${VERSAO}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "Publisher" "ArcanoApp"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "DisplayIcon" "$INSTDIR\arcano.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector" "NoModify" 1
  ; Já liga agora.
  Exec 'wscript.exe "$INSTDIR\iniciar.vbs"'
  DetailPrint "Pronto! Volte ao Arcano Layers no navegador: o painel já encontra o conector."
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM ArcanoConector.exe'
  Sleep 800
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ArcanoConector"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ArcanoConector"
  Delete "$INSTDIR\ArcanoConector.exe"
  Delete "$INSTDIR\iniciar.vbs"
  Delete "$INSTDIR\arcano.ico"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
SectionEnd
