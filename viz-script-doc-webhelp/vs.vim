" Vim syntax file
" Language:	Vizrt Script
" Maintainer:	Markus Trenkwalder <mat@vizrt.com>

" For version 5.x: Clear all syntax items
" For version 6.x: Quit when a syntax file was already loaded
if version < 600
	syntax clear
elseif exists("b:current_syntax")
	finish
endif

" VB is case insensitive
syn case ignore

syn keyword vsConditional If Then ElseIf Else Select Case

syn keyword vsRepeat Do For ForEach Loop Next
syn keyword vsRepeat Step To Until Wend While

syn keyword vsOperator AddressOf And ByRef ByVal Eqv Imp In
syn keyword vsOperator Is Like Mod Not Or To Xor

syn match vsOperator "[()+.,\-/*=&]"
syn match vsOperator "[<>]=\="
syn match vsOperator "<>"
syn match vsOperator "\s\+_$"

syn keyword vsBoolean  True False
syn keyword vsConst Null Nothing

syn keyword vsConst CAM_VIEW_ORTHOGONAL CAM_VIEW_PERSPECTIVE DISABLED ED_BOTH
syn keyword vsConst ED_NORMAL ED_REVERSE ENABLED ET_LOCAL_STOP ET_STOP ET_TAG
syn keyword vsConst EXPERT_MIRROR_NONE EXPERT_MIRROR_X EXPERT_MIRROR_Y
syn keyword vsConst EXPERT_MIRROR_Z EXPERT_RENDER_ADD EXPERT_RENDER_BLEND
syn keyword vsConst EXPERT_RENDER_MULTIPLY EXPERT_RENDER_REV_MULTIPLY
syn keyword vsConst EXPERT_RENDER_REV_SUBTRACT EXPERT_RENDER_SUBTRACT
syn keyword vsConst EXPERT_SHADE_FLAT EXPERT_SHADE_SMOOTH EXPERT_TRANSP_BLEND
syn keyword vsConst EXPERT_TRANSP_FASTEST EXPERT_TRANSP_HIGH_QUALITY
syn keyword vsConst EXPERT_TRANSP_MASK False GRID_TYPE_FREE GRID_TYPE_NONE
syn keyword vsConst GRID_TYPE_XY GRID_TYPE_XZ GRID_TYPE_ZY
syn keyword vsConst HANDLE_INTERPOLATION_MODE_LINEAR
syn keyword vsConst HANDLE_INTERPOLATION_MODE_SMOOTH HANDLE_LOCK_MODE_LOCKED
syn keyword vsConst HANDLE_LOCK_MODE_MIRROR HANDLE_LOCK_MODE_SINGLE HIDE KEY_0
syn keyword vsConst KEY_1 KEY_2 KEY_3 KEY_4 KEY_5 KEY_6 KEY_7 KEY_8 KEY_9
syn keyword vsConst KEY_A KEY_ALT KEY_B KEY_BACKSPACE KEY_BEGIN KEY_C
syn keyword vsConst KEY_CONTROL KEY_D KEY_DELETE KEY_DIVIDE KEY_DOWN KEY_E
syn keyword vsConst KEY_END KEY_ENTER KEY_ESCAPE KEY_F KEY_F1 KEY_F10 KEY_F11
syn keyword vsConst KEY_F12 KEY_F2 KEY_F3 KEY_F4 KEY_F5 KEY_F6 KEY_F7 KEY_F8
syn keyword vsConst KEY_F9 KEY_G KEY_H KEY_HOME KEY_I KEY_INSERT KEY_J KEY_K
syn keyword vsConst KEY_L KEY_LEFT KEY_M KEY_MENU KEY_MULTIPLY KEY_N KEY_O
syn keyword vsConst KEY_P KEY_PAGEDN KEY_PAGEUP KEY_PAUSE KEY_Q KEY_R
syn keyword vsConst KEY_RETURN KEY_RIGHT KEY_S KEY_SCROLL_LOCK KEY_SEPARATOR
syn keyword vsConst KEY_SHIFT KEY_SPACE KEY_T KEY_TAB KEY_U KEY_UP KEY_V KEY_W
syn keyword vsConst KEY_X KEY_Y KEY_Z LIGHT_TYPE_INFINITE LIGHT_TYPE_LOCAL
syn keyword vsConst LIGHT_TYPE_SPOT MT_CONTROL_BUTTON MT_CONTROL_PZR2D
syn keyword vsConst MT_CONTROL_PZR2D_TILT M_PI NUMPAD0 NUMPAD1 NUMPAD2 NUMPAD3
syn keyword vsConst NUMPAD4 NUMPAD5 NUMPAD6 NUMPAD7 NUMPAD8 NUMPAD9
syn keyword vsConst NUMPAD_BEGIN NUMPAD_DOWN NUMPAD_END NUMPAD_HOME
syn keyword vsConst NUMPAD_INSERT NUMPAD_LEFT NUMPAD_PGDN NUMPAD_PGUP
syn keyword vsConst NUMPAD_RIGHT NUMPAD_UP PLUGIN_TYPE_FUNCTION
syn keyword vsConst PLUGIN_TYPE_GEOMETRY PLUGIN_TYPE_SCENE SHOW
syn keyword vsConst TEXT_DIRECTION_BOTTOM_TO_TOP TEXT_DIRECTION_LEFT_TO_RIGHT
syn keyword vsConst TEXT_DIRECTION_RIGHT_TO_LEFT TEXT_DIRECTION_TOP_TO_BOTTOM
syn keyword vsConst TEXT_ORIENTATION_CENTER TEXT_ORIENTATION_CHAR
syn keyword vsConst TEXT_ORIENTATION_LEFT TEXT_ORIENTATION_RIGHT
syn keyword vsConst TEXT_ORIENTATION_VERTICAL_BOTTOM
syn keyword vsConst TEXT_ORIENTATION_VERTICAL_CENTER
syn keyword vsConst TEXT_ORIENTATION_VERTICAL_FIRST_LINE
syn keyword vsConst TEXT_ORIENTATION_VERTICAL_TOP TL_DOWN TL_NEXT TL_PREVIOUS
syn keyword vsConst TL_UP TX_EFFECT_BLUR TX_EFFECT_MOSAIC TX_ENV_BLEND
syn keyword vsConst TX_ENV_DECAL TX_ENV_MODULATE TX_MAP_CUBE
syn keyword vsConst TX_MAP_CYLINDRICAL TX_MAP_LINEAR TX_MAP_REFLECT
syn keyword vsConst TX_MAP_SPHERICAL TX_MAP_VERTEX TX_QUAL_LINEAR
syn keyword vsConst TX_QUAL_MIPMAP TX_QUAL_PIXEL TX_QUAL_SHARPEN TX_WRAP_CLAMP
syn keyword vsConst TX_WRAP_REPEAT True


"Datatypes
syn keyword vsTypes Boolean Byte Currency Date Decimal Double Empty
syn keyword vsTypes Integer Long Object Single String Variant

syn keyword vsType Vertex
syn keyword vsDefine X Y Z
syn keyword vsMethods DistanceToLine DistanceToPlane DistanceToPlaneSigned
syn keyword vsMethods GlNormal GlVertex MirrorAroundLine MirrorAroundVector
syn keyword vsMethods Norm Normalize Project Project ProjectOnLine
syn keyword vsMethods ProjectOnVector SquaredNorm Unproject Unproject

syn keyword vsType Matrix
syn keyword vsMethods Frustum GetDeterminant GetRotation GetScaling
syn keyword vsMethods GetScaling2 GetTranslation Invert LoadIdentity
syn keyword vsMethods LoadMatrix MultMatrix Ortho Perspective Rotate Rotate
syn keyword vsMethods RotateX RotateY RotateZ Scale Translate Transpose

syn keyword vsType Color
syn keyword vsDefine Alpha Blue Green Red Rgb

syn keyword vsType Array
syn keyword vsDefine LBound Size UBound
syn keyword vsMethods Clear Erase Insert Pop Push Sort

syn keyword vsType String
syn keyword vsDefine Length
syn keyword vsMethods AnsiToUtf8 Append EndsWith Erase EraseChar Find
syn keyword vsMethods FindFirstNotOf FindFirstOf FindLastNotOf FindLastOf
syn keyword vsMethods GetChar GetSubstring Insert Join Left MakeLower
syn keyword vsMethods MakeUpper Match PadLeft PadRight Prepend RFind Replace
syn keyword vsMethods ReplaceChar Right Split StartsWith Substitute TclSplit
syn keyword vsMethods Trim Utf8ToAnsi

syn keyword vsType Variant

syn keyword vsType StringMap
syn keyword vsMethods Clear ContainsKey DeleteKey GetKeys

syn keyword vsType DateTime
syn keyword vsDefine DayOfMonth DayOfWeek DayOfYear Hour Minute Month Second
syn keyword vsDefine TotalSeconds Year
syn keyword vsMethods Normalize ToString

syn keyword vsType ScriptSettings
syn keyword vsDefine CallButtonDownForTopObjectsOnly
syn keyword vsDefine CallEnterLeaveForBackgroundObjects
syn keyword vsDefine CallEnterLeaveForTopObjectsOnly
syn keyword vsDefine CallMouseMoveForBackgroundObjects
syn keyword vsDefine CallMouseMoveForTopObjectsOnly

syn keyword vsType Uuid
syn keyword vsDefine FullString String
syn keyword vsMethods GenerateNewUuid

syn keyword vsType Base
syn keyword vsDefine NumChannels Scene Stage System VizCommunication VizId
syn keyword vsMethods FindChannel FindChannelOfObject FindKeyframe
syn keyword vsMethods FindKeyframeOfObject FindOrCreateChannelOfObject
syn keyword vsMethods GetChannels GetChannelsOfObject
syn keyword vsMethods GetNumberOfAnimationChannels IsAnimated SetChanged

syn keyword vsType Transform

syn keyword vsType Position
syn keyword vsDefine x xyz y z

syn keyword vsType Rotation
syn keyword vsDefine x xyz y z

syn keyword vsType Scaling
syn keyword vsDefine x xyz y z

syn keyword vsType Center
syn keyword vsDefine x xyz y z

syn keyword vsType Image

syn keyword vsType Alpha
syn keyword vsDefine Active Value

syn keyword vsType Key
syn keyword vsDefine Active AlphaValue AutoAlpha DrawKey DrawRGB

syn keyword vsType Material
syn keyword vsDefine Alpha Ambient Color Diffuse Emission Lit Shininess Specular

syn keyword vsType Geometry
syn keyword vsDefine Active Direction Kerning LineSpacing Name Orientation
syn keyword vsDefine PluginInstance Text Uuid VerticalOrientation WordSpacing
syn keyword vsMethods GetParameterBool GetParameterColor GetParameterContainer
syn keyword vsMethods GetParameterDouble GetParameterInt GetParameterString
syn keyword vsMethods RegisterChangedCallback RegisterTextChangedCallback
syn keyword vsMethods SetParameterBool SetParameterColor SetParameterContainer
syn keyword vsMethods SetParameterDouble SetParameterInt SetParameterString
syn keyword vsMethods UnregisterChangedCallback

syn keyword vsType PluginInstance
syn keyword vsDefine Active MTAlignGrid MTDOFEventDistribution MTGrid
syn keyword vsDefine MTRegistered MTUseCenter PluginName Script
syn keyword vsMethods GetParameterBool GetParameterColor GetParameterContainer
syn keyword vsMethods GetParameterDouble GetParameterInt GetParameterString
syn keyword vsMethods MTRegister MTRegisterEx MTSetPosition MTUnregister
syn keyword vsMethods PushButton SetParameterBool SetParameterColor
syn keyword vsMethods SetParameterContainer SetParameterDouble SetParameterInt
syn keyword vsMethods SetParameterString

syn keyword vsType Texture
syn keyword vsDefine Active EffectType EffectValue EnvironmentType Image
syn keyword vsDefine MapPosition MapRotation MapScaling MapType QualityType
syn keyword vsDefine SharpenValue WrapType

syn keyword vsType Container
syn keyword vsDefine Active Alpha Center ChildContainer ChildContainerCount
syn keyword vsDefine ExactPicking Expert FirstChildContainer Geometry Key
syn keyword vsDefine LastChildContainer Material Matrix Merged
syn keyword vsDefine MergedChildContainer MergedParentContainer Name
syn keyword vsDefine NextContainer NumChildContainers Open ParentContainer
syn keyword vsDefine Position PreviousContainer RecomputeMatrix Rotation
syn keyword vsDefine Scaling Script ScriptPluginInstance ScriptSettings
syn keyword vsDefine Texture Transform Uuid
syn keyword vsMethods AddContainer AddScreenOffset ContainsMouseCursor CopyTo
syn keyword vsMethods CreateAlpha CreateExpert CreateFunction CreateGeometry
syn keyword vsMethods CreateKey CreateMaterial CreateMaterial CreateTexture
syn keyword vsMethods CreateTexture Delete DeleteAlpha DeleteChildren
syn keyword vsMethods DeleteExpert DeleteFunction DeleteGeometry DeleteKey
syn keyword vsMethods DeleteMaterial DeleteTexture FindSiblingSubContainer
syn keyword vsMethods FindSubContainer FindSuperContainer GetBoundingBox
syn keyword vsMethods GetBoundingBoxDimensions GetChildContainerByIndex
syn keyword vsMethods GetChildContainerContainingMouseCursor
syn keyword vsMethods GetContainerAndSubContainers GetDirector
syn keyword vsMethods GetDirectorOfMergedGeometry GetFirstActiveChildContainer
syn keyword vsMethods GetFunctionPluginInstance GetGeometryPluginInstance
syn keyword vsMethods GetIndexOfFirstActiveChildContainer GetLocalIndex
syn keyword vsMethods GetScreenBounds GetScreenPointToGeomSurface
syn keyword vsMethods GetScreenPositionOrtho GetTransformedBoundingBox
syn keyword vsMethods GetTransformedBoundingBoxDimensions
syn keyword vsMethods GetUVCoordinatesOfScreenPoint HideAllChildContainers
syn keyword vsMethods IsOnTop IsScreenPointInBoundingBox IsVertexInBoundingBox
syn keyword vsMethods LocalPosToScreenPos LocalPosToWorldPos
syn keyword vsMethods MoveAllChannelsToDirector MoveTo MoveToKeepTransformation
syn keyword vsMethods ScreenOffsetToContainerOffset ScreenOffsetToWorldOffset
syn keyword vsMethods ScreenPosToLocalGrid ScreenPosToLocalPos
syn keyword vsMethods SetCenterPositionLocked SetCenterScreenGridPositionLocked
syn keyword vsMethods SetCenterScreenPositionLocked SetScreenPositionOrtho
syn keyword vsMethods ShowAllChildContainers ShowOneChildContainer Update
syn keyword vsMethods WorldPosToLocalPos

syn keyword vsType Grid
syn keyword vsDefine Locked Type
syn keyword vsMethods MoveToContainer

syn keyword vsType Camera
syn keyword vsDefine ActiveExt Cx CxExt Cy CyExt DecoupleExternal Direction
syn keyword vsDefine FocalPlane Fovx FovxExt Fovy FovyExt Matrix Pan PanExt
syn keyword vsDefine Position PositionExt PositionTrackingActive
syn keyword vsDefine PositionTrackingContainer ProjectionMatrix
syn keyword vsDefine RotationTrackingActive RotationTrackingContainer Tilt
syn keyword vsDefine TiltExt Twist TwistExt View ViewMatrix
syn keyword vsMethods ResetPositionTracking ResetRotationTracking

syn keyword vsType Light
syn keyword vsDefine Attenuation Color Direction Position
syn keyword vsDefine PositionTrackingActive PositionTrackingContainer
syn keyword vsDefine RotationTrackingActive RotationTrackingContainer Type
syn keyword vsMethods ResetPositionTracking ResetRotationTracking

syn keyword vsType Scene
syn keyword vsDefine AlphaClearValue AutoKeyActive AutoKeyPosition
syn keyword vsDefine BackgroundColor CurrentCamera CurrentCameraIndex Location
syn keyword vsDefine LocationPath Map Name RootContainer Script
syn keyword vsDefine ScriptPluginInstance Stage Uuid
syn keyword vsMethods AddLogMessage CreateRootContainer FindContainer
syn keyword vsMethods GetCamera GetGrid GetLight GetScenePluginInstance
syn keyword vsMethods GetUnlockedGrid ScreenPosToWorldGrid ScreenPosToWorldPos
syn keyword vsMethods UpdateSceneTree WorldPosToScreenPos

syn keyword vsType BezierHandle
syn keyword vsDefine LeftAngle LeftInterpolationMode LeftWeight LockMode
syn keyword vsDefine RightAngle RightInterpolationMode RightWeight

syn keyword vsType Keyframe
syn keyword vsDefine ActionString BoolValue Channel ColorValue EventDirection
syn keyword vsDefine EventDuration EventValue FloatValue IntValue Locked
syn keyword vsDefine MaterialValue Name NextKeyframe NumAxes NumberOfAxes
syn keyword vsDefine PathHandle PreviousKeyframe Time XyzValue
syn keyword vsMethods Delete GetBezierHandle UpdateAnimation

syn keyword vsType Channel
syn keyword vsDefine Actor AnimationObject CommandName Director FirstKeyframe
syn keyword vsDefine KeyframeCount LastKeyframe Name NumKeyframes
syn keyword vsDefine PostLoopActive PostLoopCounter PostSwingActive
syn keyword vsDefine PreLoopActive PreLoopCounter PreSwingActive
syn keyword vsMethods AddKeyframe CopyToDirector Delete DeleteKeyframe
syn keyword vsMethods DeleteKeyframe FindKeyframe GetKeyframe MoveToDirector
syn keyword vsMethods Rebuild

syn keyword vsType Director
syn keyword vsDefine ActionChannelCount ChildDirector EventChannel Field Name
syn keyword vsDefine NextDirector NumActionChannels NumAnimationChannels
syn keyword vsDefine Offset ParentDirector PreviousDirector Reverse Time
syn keyword vsDefine TotalOffset
syn keyword vsMethods AddDirector ContinueAnimation CopyTo Delete
syn keyword vsMethods FindActionChannel FindChannel FindKeyframe
syn keyword vsMethods FindSubDirector GetActionChannel GetAnimationChannel
syn keyword vsMethods GetAnimationChannels GetKeyframes HasAnimationChannels
syn keyword vsMethods IsAnimationRunning MoveTo Show StartAnimation
syn keyword vsMethods StopAnimation StopAnimation

syn keyword vsType Stage
syn keyword vsDefine RootDirector
syn keyword vsMethods ContinueAnimation CreateRootDirector FindDirector
syn keyword vsMethods IsAnimationRunning StartAnimation StopAnimation

syn keyword vsType ClipChannel
syn keyword vsDefine AutoRun ClipChannelID CurrentFrame CurrentFramePending
syn keyword vsDefine Duration DurationPending FrameIn FrameInActive
syn keyword vsDefine FrameInPending FrameOut FrameOutActive FrameOutPending
syn keyword vsDefine LoopMode LoopModeActive LoopModePending ModeOnLoadError
syn keyword vsDefine ModeOnLoadError_FLUSH ModeOnLoadError_NONE
syn keyword vsDefine ModeOnLoadError_PAUSE ModeOnLoadError_STOP
syn keyword vsDefine PendingClipSupported PlayBackSpeed PlayBackSpeedActive
syn keyword vsDefine PlayBackSpeedPending PlayMode PlayModePending
syn keyword vsDefine PlayMode_ERROR PlayMode_NONE PlayMode_PLAY
syn keyword vsDefine PlayMode_PLAY_PENDING PlayMode_SCRUB PlayMode_SCRUB_EOF
syn keyword vsDefine PlayMode_STOP RepeatMode RepeatModeActive
syn keyword vsDefine RepeatModePending RepeatMode_FIELD RepeatMode_FRAME
syn keyword vsDefine RepeatMode_NONE ReverseFields ReverseFieldsActive
syn keyword vsDefine ReverseFieldsPending UpscaleLuma UpscaleLumaActive
syn keyword vsDefine UpscaleLumaPending
syn keyword vsMethods Continue ContinueActive ContinuePending Flush
syn keyword vsMethods FlushActive FlushPending GetClipName
syn keyword vsMethods GetClipNameActive GetClipNamePending
syn keyword vsMethods GetRegisterChangedClipFrame GetRegisterChangedClipMode
syn keyword vsMethods GetRegisterChangedClipModePending GetReportValues
syn keyword vsMethods GetReportValuesPending IsClipLoaded IsClipLoadedActive
syn keyword vsMethods IsClipLoadedPending Pause PauseActive PausePending Play
syn keyword vsMethods PlayActive PlayPending Scrub ScrubActive ScrubPending
syn keyword vsMethods SetClipName SetClipNameBack2Back SetClipNameBack2BackEx
syn keyword vsMethods SetClipNameEx SetClipNamePending SetClipNamePendingEx
syn keyword vsMethods SetRegisterChangedClipFrame SetRegisterChangedClipMode
syn keyword vsMethods SetRegisterChangedClipModePending Stop StopActive
syn keyword vsMethods StopPending SwapEofPending SwapPending

syn keyword vsType Expert
syn keyword vsDefine BackFace ExactPicking LineAntialiasing Mirror Outline
syn keyword vsDefine RenderMode SeparateSpecular ShadeModel TransparancyMode
syn keyword vsDefine TwoSidedLighting Wireframe WireframeWidth ZBuffer

syn keyword vsType System
syn keyword vsDefine BackScene CurrentDirectoryPath CurrentRefreshRate
syn keyword vsDefine FrontScene HostName IPAddressString IsPostRecording
syn keyword vsDefine LButtonState MButtonState MainScene Map MouseX MouseY
syn keyword vsDefine OutputAspect OutputFieldDominance OutputInterlaced
syn keyword vsDefine OutputRefreshRate OutputRetraceCounter OutputSystem
syn keyword vsDefine PostCurrentTime PostFieldDominance PostRetraceCounter
syn keyword vsDefine RButtonState RefreshRate RenderWindowHeight
syn keyword vsDefine RenderWindowWidth ScreenHeight ScreenWidth
syn keyword vsDefine ShowMouseCursor VideoHeight VideoWidth
syn keyword vsMethods DeleteFile DirectoryExists ExploreDocument
syn keyword vsMethods GetClipChannel GetDirectoryContent GetElapsedTime
syn keyword vsMethods GetNumberOfClipChannel IsKeyDown LoadBackScene
syn keyword vsMethods LoadFrontScene LoadMainScene LoadTextFile
syn keyword vsMethods MouseOverIPDefineServer MouseOverIPQuitServer
syn keyword vsMethods MouseOverIPQuitServer MouseOverIPRegister
syn keyword vsMethods MouseOverIPRegister MouseOverIPUndefineAllServers
syn keyword vsMethods MouseOverIPUndefineServer MouseOverIPUndefineServer
syn keyword vsMethods MouseOverIPUnregister MouseOverIPUnregister
syn keyword vsMethods MouseOverIPUnregisterAll MouseOverIPUnregisterAll
syn keyword vsMethods OpenDocument PlaySound SaveTextFile SendCommand
syn keyword vsMethods SendRemoteCommand StartApplication StopSound TcpSend
syn keyword vsMethods TcpSendAsync TcpSendAsyncStatus

syn keyword vsType VizCommunication
syn keyword vsDefine Map
syn keyword vsMethods AddHostToGroup ClearHostGroup SendVizCommandToHostGroup

syn keyword vsType SharedMemory
syn keyword vsMethods ContainsKey CreateKey DeleteKey GetKeys LoadFromDb
syn keyword vsMethods RegisterChangedCallback SaveToDb
syn keyword vsMethods UnregisterChangedCallback


"Predefined Events
syn keyword vsEvents OnInitParameters OnInit OnEnter OnLeave
syn keyword vsEvents OnEnterSubContainer OnLeaveSubContainer
syn keyword vsEvents OnExecPerField OnExecAction OnParameterChanged
syn keyword vsEvents OnGuiStatus OnKeyDown OnKeyUp OnButtonDown6DOF
syn keyword vsEvents OnButtonUp6DOF OnMove6DOF OnMoveRelative6DOF
syn keyword vsEvents OnScale6DOF OnMTHit OnMTMenu OnMTControlPZR2D
syn keyword vsEvents OnMTControlButton OnMTControlInactive OnMouseMove
syn keyword vsEvents OnLButtonDown OnMButtonDown OnRButtonDown
syn keyword vsEvents OnLButtonUp OnMButtonUp OnRButtonUp OnMouseWheel
syn keyword vsEvents OnSharedMemoryVariableChanged
syn keyword vsEvents OnSharedMemoryVariableDeleted OnGeometryChanged

syn keyword vsFunction AngleBetweenVectors Determinant GetParameterBool
syn keyword vsFunction GetParameterColor GetParameterContainer
syn keyword vsFunction GetParameterDouble GetParameterInt GetParameterString
syn keyword vsFunction IsKeyDown IsLButtonDown IsMButtonDown IsRButtonDown
syn keyword vsFunction LineLineIntersection PlaneLineIntersection
syn keyword vsFunction RegisterDirSelector RegisterFileSelector
syn keyword vsFunction RegisterInfoText RegisterParameterBool
syn keyword vsFunction RegisterParameterColor RegisterParameterContainer
syn keyword vsFunction RegisterParameterDouble RegisterParameterDropDown
syn keyword vsFunction RegisterParameterHList RegisterParameterImage
syn keyword vsFunction RegisterParameterInt RegisterParameterList
syn keyword vsFunction RegisterParameterSliderDouble
syn keyword vsFunction RegisterParameterSliderInt RegisterParameterString
syn keyword vsFunction RegisterParameterText RegisterPlugin
syn keyword vsFunction RegisterPluginDisplayName
syn keyword vsFunction RegisterPluginFolder RegisterPluginType
syn keyword vsFunction RegisterPushButton RegisterRadioButton SendCommand
syn keyword vsFunction SendGuiParameterShow SendGuiParameterUpdate
syn keyword vsFunction SendGuiRefresh SendGuiStatus SendRemoteCommand
syn keyword vsFunction SetAnimateParameter SetHideParameter TcpSend
syn keyword vsFunction TriangleArea TriangleCenter

syn keyword vsFunction Abs Acos Asc Asin Atan Atan2 CBool CColor CDbl CInt
syn keyword vsFunction CStr CUuid CVertex Ceil Chr Cos Cosh Distance2
syn keyword vsFunction DoubleToString Exp Fix Floor GetCurrentTime
syn keyword vsFunction GetTickCount Int IntToString Len Log Max Min Println
syn keyword vsFunction Random Round Sign Sin Sinh Sqr Sqrt Tan

syn keyword vsStatement Begin Dim End Exit Function Structure Sub

syn keyword vsKeyword As Binary ByRef ByVal Date Empty Error Friend Get
syn keyword vsKeyword Input Is Len Lock Me Mid New Nothing Null On
syn keyword vsKeyword Option Optional ParamArray Print Private Property
syn keyword vsKeyword Public PublicNotCreateable OnNewProcessSingleUse
syn keyword vsKeyword InSameProcessMultiUse GlobalMultiUse Resume Seek
syn keyword vsKeyword Set Static Step String Time WithEvents

syn keyword vsTodo contained	TODO


"VB defined values
syn keyword vsDefine dbVarBinary


"Numbers
"integer number, or floating point number without a dot.
syn match vsNumber "\<\d\+\>"
"floating point number, with dot
syn match vsNumber "\<\d\+\.\d*\>"
"floating point number, starting with a dot
syn match vsNumber "\.\d\+\>"
"syn match  vsNumber		"{[[:xdigit:]-]\+}\|&[hH][[:xdigit:]]\+&"
"syn match  vsNumber		":[[:xdigit:]]\+"
"syn match  vsNumber		"[-+]\=\<\d\+\>"
syn match  vsFloat		"[-+]\=\<\d\+[eE][\-+]\=\d\+"
syn match  vsFloat		"[-+]\=\<\d\+\.\d*\([eE][\-+]\=\d\+\)\="
syn match  vsFloat		"[-+]\=\<\.\d\+\([eE][\-+]\=\d\+\)\="

" String and Character contstants
syn region  vsString		start=+"+  end=+"\|$+
syn region  vsComment		start="\(^\|\s\)REM\s" end="$" contains=vsTodo
syn region  vsComment		start="\(^\|\s\)\'"   end="$" contains=vsTodo
syn match   vsLineNumber	"^\d\+\(\s\|$\)"
syn match   vsTypeSpecifier  "[a-zA-Z0-9][\$%&!#]"ms=s+1
syn match   vsTypeSpecifier  "#[a-zA-Z0-9]"me=e-1

" Define the default highlighting.
" For version 5.7 and earlier: only when not done already
" For version 5.8 and later: only when an item doesn't have highlighting yet
if version >= 508 || !exists("did_vs_syntax_inits")
	if version < 508
		let did_vs_syntax_inits = 1
		command -nargs=+ HiLink hi link <args>
	else
		command -nargs=+ HiLink hi def link <args>
	endif

	HiLink vsBoolean		Boolean
	HiLink vsLineNumber		Comment
	HiLink vsComment		Comment
	HiLink vsConditional		Conditional
	HiLink vsConst			Constant
	HiLink vsDefine			Constant
	HiLink vsError			Error
	HiLink vsFunction		Identifier
	HiLink vsIdentifier		Identifier
	HiLink vsNumber			Number
	HiLink vsFloat			Float
	HiLink vsMethods		PreProc
	HiLink vsOperator		Operator
	HiLink vsRepeat			Repeat
	HiLink vsString			String
	HiLink vsStatement		Statement
	HiLink vsKeyword		Statement
	HiLink vsEvents			Special
	HiLink vsTodo			Todo
	HiLink vsTypes			Type
	HiLink vsTypeSpecifier	Type

	delcommand HiLink
endif

let b:current_syntax = "vs"

" vim: ts=8
