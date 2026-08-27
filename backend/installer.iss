; --- AUTO-INCREMENT BUILD NUMBER ---
#define BuildNumFile "build.number"
#define BuildNum ReadIni(BuildNumFile, "Version", "Build", "0")
#define BuildNum Str(Int(BuildNum) + 1)
#expr WriteIni(BuildNumFile, "Version", "Build", BuildNum)

; --- DEFINE BASE VERSION ---
#define MajorVersion "2.0.0"
#define FullAppVersion MajorVersion + "." + BuildNum

[Setup]
AppId={{C38A18B2-9F10-4A99-8D15-1B82A9C104E9}
AppName=MiBOT Client Desktop
AppVersion={#FullAppVersion}
AppPublisher=MiBOT Ventures
DefaultDirName={autopf}\MiBOT Desktop
DefaultGroupName=MiBOT Desktop
DisableProgramGroupPage=yes
OutputDir=D:\mibot-client-desktop-test\Output
OutputBaseFilename=MiBOT_Desktop_Setup_v{#FullAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

; 🔒 PERMISSIONS & PROCESS MANAGEMENT
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "D:\mibot-client-desktop-test\backend\dist\MiBotServer\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs restartreplace

[Icons]
Name: "{group}\MiBOT Desktop"; Filename: "{app}\MiBotServer.exe"
Name: "{group}\View Application Logs"; Filename: "explorer.exe"; Parameters: "C:\ProgramData\MiBot_Desktop\logs"
Name: "{group}\{cm:UninstallProgram,MiBOT Desktop}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\MiBOT Desktop"; Filename: "{app}\MiBotServer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\MiBotServer.exe"; Description: "{cm:LaunchProgram,MiBOT Desktop}"; Flags: nowait postinstall skipifsilent