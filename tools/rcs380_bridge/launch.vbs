' 受付システム起動用ランチャー。
' デスクトップにこのファイル（またはこれへのショートカット）を置き、
' ダブルクリックで「カードリーダー連携の起動」と「受付画面を開く」を1回で行う。
'
' 起動済みの場合は何もせず(agent.py側で二重起動を無害化)、
' 単にブラウザで受付画面を開くだけになる。

Dim fso, baseDir, shell
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)

' カードリーダー連携サービスを起動（コンソールを表示せず静かに）
shell.Run """" & baseDir & "\venv\Scripts\pythonw.exe"" """ & baseDir & "\agent.py""", 0, False

' サービスが起動しきるまで少し待ってから受付画面を開く
WScript.Sleep 1500

' 受付スキャン画面をブラウザで開く（本番運用時は実際のURLに変更する）
shell.Run "http://localhost:5827/", 1, False
