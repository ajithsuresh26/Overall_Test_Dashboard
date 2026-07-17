; Inno Setup Configuration Script for MiBOT Desktop Application

[Setup]
AppName=MiBot Desktop
AppVersion=1.0.0
AppPublisher=MiBOT Ventures
; Mapped to Program Files to perfectly match your administration access level requirements
DefaultDirName={autopf}\MiBot_Desktop
DefaultGroupName=MiBot Desktop
DisableProgramGroupPage=yes
OutputDir=.\installer_output
OutputBaseFilename=MiBot_Desktop_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Natively demands elevation execution parameters to ensure firewall rules inject successfully
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; 1. Grab the main executable file explicitly first
Source: "D:\mibot-client-desktop\backend\dist\MiBot_Desktop\MiBot_Desktop.exe"; DestDir: "{app}"; Flags: ignoreversion

; 2. FIX: Added 'Excludes' parameter to prevent duplicate compilation locks on the main exe
Source: "D:\mibot-client-desktop\backend\dist\MiBot_Desktop\*"; DestDir: "{app}"; Excludes: "MiBot_Desktop.exe"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Create standard Windows shortcuts
Name: "{group}\MiBot Desktop"; Filename: "{app}\MiBot_Desktop.exe"
Name: "{autodesktop}\MiBot Desktop"; Filename: "{app}\MiBot_Desktop.exe"; Tasks: desktopicon

[Run]
; Add a Windows Firewall allow-rule for the exe BEFORE first launch, so the loopback server isn't silently blocked.
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""MiBot Desktop"" dir=in action=allow program=""{app}\MiBot_Desktop.exe"" enable=yes"; Flags: runhidden

; Auto-launch choice for the user after setup ends. Natively windowed, no 'runhidden' flag required!
Filename: "{app}\MiBot_Desktop.exe"; Description: "{cm:LaunchProgram,MiBot Desktop}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Clean up the firewall rule on uninstall so we don't leave orphaned rules behind.
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""MiBot Desktop"""; Flags: runhidden