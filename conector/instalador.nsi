; Instalador do Arcano Conector (Windows). Instala só para o usuário atual (sem admin),
; liga junto com o Windows (escondido, sem janela) e já deixa rodando.
; Visual: Modern UI 2 com as cores do ArcanoApp (imagens geradas pelo arte.py no build).
Unicode true
!include "MUI2.nsh"
!define NOME "Arcano Conector"
!ifndef VERSAO
  !define VERSAO "0.1.0"
!endif
Name "${NOME}"
Caption "${NOME} · instalação"
OutFile "ArcanoConector-Instalador.exe"
InstallDir "$LOCALAPPDATA\ArcanoConector"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "ArcanoApp · arcanoapp.voxvisual.com.br"
ShowInstDetails nevershow
ShowUninstDetails nevershow
VIProductVersion "${VERSAO}.0"
VIAddVersionKey "ProductName" "${NOME}"
VIAddVersionKey "FileDescription" "Liga o Arcano Layers do navegador ao Claude Code do seu PC"
VIAddVersionKey "FileVersion" "${VERSAO}"
VIAddVersionKey "CompanyName" "ArcanoApp"

; ── Visual ──
!define MUI_ICON "arcano.ico"
!define MUI_UNICON "arcano.ico"
!define MUI_BGCOLOR "14101C"
!define MUI_TEXTCOLOR "FFFFFF"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "topo.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "topo.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "lado.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "lado.bmp"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Quer mesmo cancelar a instalação do Arcano Conector?"

; ── Passo 1: boas-vindas ──
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Arcano Conector"
!define MUI_WELCOMEPAGE_TEXT "O Arcano Conector é um app pequeno que liga o Arcano Layers (no navegador) ao Claude do seu computador. É ele que deixa a IA mexer no seu projeto.$\r$\n$\r$\n• Instala só para você, sem pedir senha de administrador.$\r$\n• Liga sozinho junto com o Windows, escondido (sem janela).$\r$\n• Só conversa com o Arcano Layers, nada de fora.$\r$\n$\r$\nClique em Instalar para começar."
!insertmacro MUI_PAGE_WELCOME

; ── Passo 2: instalando ──
!define MUI_PAGE_HEADER_TEXT "Instalando"
!define MUI_PAGE_HEADER_SUBTEXT "Só alguns segundos…"
!insertmacro MUI_PAGE_INSTFILES

; ── Passo 3: pronto ──
!define MUI_FINISHPAGE_TITLE "Pronto! O conector está ligado"
!define MUI_FINISHPAGE_TEXT "Volte para o Arcano Layers no navegador e clique em $\"Já instalei$\".$\r$\n$\r$\nSe o Chrome perguntar se o site pode acessar a rede local ou apps do seu dispositivo, clique em Permitir: é assim que o painel encontra o conector."
!define MUI_FINISHPAGE_LINK "Abrir o Arcano Layers"
!define MUI_FINISHPAGE_LINK_LOCATION "https://layers.voxvisual.com.br/video/"
!define MUI_FINISHPAGE_LINK_COLOR "C084FC"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

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
