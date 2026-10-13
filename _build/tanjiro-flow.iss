; Tanjiro Flow — Inno Setup installer script
;
; Builds a setup .exe from the already-built release binary
; (src-tauri\target\release\tanjiro-flow.exe). Run `_build\build-release.bat`
; first so that file exists, then compile this script with Inno Setup
; (ISCC.exe "_build\tanjiro-flow.iss", or open it in the Inno Setup
; Compiler GUI and click Compile/Build).
;
; This is an alternative to the NSIS installer Tauri's own bundler
; produces (src-tauri\target\release\bundle\nsis\*.exe) — use whichever
; installer format you need; they install to the same place and behave
; the same way (per-user, Start Menu + optional Desktop shortcut,
; proper uninstaller).

#define MyAppName "Tanjiro Flow"
#define MyAppVersion "0.1.2"
#define MyAppPublisher "Tanjiro Flow"
#define MyAppExeName "tanjiro-flow.exe"
#define MyAppId "{{B5B6B7B0-3F7E-4C1A-9B9A-TANJIROFLOW1}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
; Per-user install by default, same as the NSIS bundle — no admin prompt.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DisableProgramGroupPage=yes
OutputDir=..\src-tauri\target\release\bundle\inno
OutputBaseFilename=Tanjiro.Flow_{#MyAppVersion}_x64-setup
SetupIconFile=..\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableWelcomePage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\src-tauri\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Tanjiro Flow keeps running in the tray after the window is "closed" —
; make sure uninstall doesn't leave it running against a deleted exe.
Type: filesandordirs; Name: "{app}"
