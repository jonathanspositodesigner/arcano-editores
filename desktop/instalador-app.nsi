; Instalador do Arcano Layers para Windows (editor + Arcano Conector numa coisa só).
; Instala só para o usuário (sem admin). Visual igual ao do conector (cores do ArcanoApp).
; Os valores (nome, pasta, arquivo...) vêm do defs.nsh, gerado no build.
Unicode true
!include "defs.nsh"
!include "MUI2.nsh"
Name "${NOME}"
Caption "${NOME} · instalação"
OutFile "${SAIDA}"
InstallDir "$LOCALAPPDATA\Programs\${PASTA}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "ArcanoApp · arcanoapp.voxvisual.com.br"
ShowInstDetails nevershow
ShowUninstDetails nevershow
VIProductVersion "${VERSAO}.0"
VIAddVersionKey "ProductName" "${NOME}"
VIAddVersionKey "FileDescription" "${NOME}"
VIAddVersionKey "FileVersion" "${VERSAO}"
VIAddVersionKey "CompanyName" "ArcanoApp"

!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
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
!define MUI_ABORTWARNING_TEXT "Quer mesmo cancelar a instalação?"

!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao ${NOME}"
!define MUI_WELCOMEPAGE_TEXT "Vamos instalar o ${NOME} no seu computador, junto com o Arcano Conector (o que liga o Arcano Motion ao Claude do seu PC).$\r$\n$\r$\n• Instala só para você, sem senha de administrador.$\r$\n• Cria atalho na Área de Trabalho e no menu Iniciar.$\r$\n• O conector liga sozinho com o Windows, escondido.$\r$\n$\r$\nClique em Avançar para escolher a pasta."
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_HEADER_TEXT "Onde instalar"
!define MUI_PAGE_HEADER_SUBTEXT "Pode deixar a pasta sugerida."
!insertmacro MUI_PAGE_DIRECTORY
!define MUI_PAGE_HEADER_TEXT "Instalando"
!define MUI_PAGE_HEADER_SUBTEXT "Só um instante…"
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Pronto! ${NOME} instalado"
!define MUI_FINISHPAGE_TEXT "O atalho está na Área de Trabalho e no menu Iniciar.$\r$\n$\r$\nO Arcano Conector também já está ligado."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o ${NOME} agora"
!define MUI_FINISHPAGE_LINK "Abrir o ArcanoApp"
!define MUI_FINISHPAGE_LINK_LOCATION "${PAGINA}"
!define MUI_FINISHPAGE_LINK_COLOR "C084FC"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

!define DESINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PASTA}"
!define CONECTOR "$LOCALAPPDATA\ArcanoConector"

Section "Instalar"
  nsExec::Exec 'taskkill /F /IM "${EXE}"'
  nsExec::Exec 'taskkill /F /IM ArcanoConector.exe'
  Sleep 800
  SetOutPath "$INSTDIR"
  File "${EXE}"
  ; Ícone com o número da versão no nome: o Windows guarda o ícone pelo caminho do arquivo, então
  ; com o mesmo nome (app.ico) os atalhos continuavam com o ícone antigo depois de atualizar.
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\icone-*.ico"
  File /oname=icone-${BUILD}.ico "app.ico"
  File /nonfatal "NOTICE"
  ; Atalhos com o ícone do Arcano (apaga os velhos antes, para o Windows não reaproveitar o ícone guardado).
  Delete "$DESKTOP\${NOME}.lnk"
  Delete "$SMPROGRAMS\Arcano\${NOME}.lnk"
  CreateShortcut "$DESKTOP\${NOME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\icone-${BUILD}.ico"
  CreateDirectory "$SMPROGRAMS\Arcano"
  CreateShortcut "$SMPROGRAMS\Arcano\${NOME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\icone-${BUILD}.ico"
  ; Arcano Conector (o mesmo do instalador separado), ligado junto com o Windows.
  SetOutPath "${CONECTOR}"
  File "ArcanoConector.exe"
  File /oname=arcano.ico "conector.ico"
  FileOpen $0 "${CONECTOR}\iniciar.vbs" w
  FileWrite $0 'CreateObject("WScript.Shell").Run """${CONECTOR}\ArcanoConector.exe""", 0, False'
  FileClose $0
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ArcanoConector" 'wscript.exe "${CONECTOR}\iniciar.vbs"'
  Exec 'wscript.exe "${CONECTOR}\iniciar.vbs"'
  ; Desinstalar pelo Painel de Controle.
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "${DESINST}" "DisplayName" "${NOME}"
  WriteRegStr HKCU "${DESINST}" "DisplayVersion" "${VERSAO}"
  WriteRegStr HKCU "${DESINST}" "Publisher" "ArcanoApp"
  WriteRegStr HKCU "${DESINST}" "DisplayIcon" "$INSTDIR\icone-${BUILD}.ico"
  WriteRegStr HKCU "${DESINST}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "${DESINST}" "NoModify" 1
  ; Avisa o Windows que os ícones mudaram (área de trabalho, menu Iniciar, barra de tarefas).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
  nsExec::Exec 'ie4uinit.exe -show'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM "${EXE}"'
  Sleep 500
  Delete "$DESKTOP\${NOME}.lnk"
  Delete "$SMPROGRAMS\Arcano\${NOME}.lnk"
  RMDir "$SMPROGRAMS\Arcano"
  DeleteRegKey HKCU "${DESINST}"
  Delete "$INSTDIR\${EXE}"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\icone-*.ico"
  Delete "$INSTDIR\NOTICE"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  ; O conector fica (o outro editor ou o navegador podem usar); ele tem o próprio desinstalador.
SectionEnd
