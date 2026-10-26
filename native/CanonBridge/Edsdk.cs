// Minimal P/Invoke surface for Canon EDSDK (64-bit, EDSDK 13.x).
//
// Verified against the EDSDK 13.20.21 (Windows) headers: every constant, struct layout
// (#pragma pack 8), callback and function signature below matches EDSDK.h / EDSDKTypes.h /
// EDSDKErrors.h. Re-check when upgrading the SDK: since 13.x several sizes are 64-bit
// (EdsUInt64), and older samples that use 32-bit sizes corrupt the stack if mixed.

using System;
using System.Runtime.InteropServices;

namespace CanonBridge;

internal static class Edsdk
{
    private const string Dll = "EDSDK.dll";

    // ---- errors ----
    public const uint EDS_ERR_OK = 0x00000000;
    public const uint EDS_ERR_DEVICE_BUSY = 0x00000081;
    public const uint EDS_ERR_OBJECT_NOTREADY = 0x0000A102;
    public const uint EDS_ERR_TAKE_PICTURE_AF_NG = 0x00008D01;

    // ---- events ----
    public const uint ObjectEvent_All = 0x00000200;
    public const uint ObjectEvent_DirItemRequestTransfer = 0x00000208;
    public const uint StateEvent_All = 0x00000300;
    public const uint StateEvent_Shutdown = 0x00000301;
    public const uint StateEvent_WillSoonShutDown = 0x00000303;
    public const uint PropertyEvent_All = 0x00000100;
    public const uint PropertyEvent_PropertyChanged = 0x00000101;
    public const uint PropertyEvent_PropertyDescChanged = 0x00000102;

    // ---- properties ----
    public const uint PropID_SaveTo = 0x0000000B;
    public const uint PropID_WhiteBalance = 0x00000106;
    public const uint PropID_AEMode = 0x00000400; // mode dial position (read-only on bodies with a dial)
    public const uint PropID_ISOSpeed = 0x00000402;
    public const uint PropID_Av = 0x00000405;
    public const uint PropID_Tv = 0x00000406;
    public const uint SaveTo_Host = 2;
    public const uint PropID_Evf_OutputDevice = 0x00000500;
    public const uint EvfOutputDevice_TFT = 1;
    public const uint EvfOutputDevice_PC = 2;
    public const uint PropID_Evf_Mode = 0x00000501;

    // ---- commands ----
    public const uint CameraCommand_TakePicture = 0x00000000;
    public const uint CameraCommand_ExtendShutDownTimer = 0x00000001;
    public const uint CameraCommand_PressShutterButton = 0x00000004;
    public const int ShutterButton_OFF = 0x00000000;
    public const int ShutterButton_Completely = 0x00000003;
    public const int ShutterButton_Completely_NonAF = 0x00010003;

    public const int FileCreateDisposition_CreateAlways = 1;
    public const int Access_ReadWrite = 2;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct EdsDeviceInfo
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string szPortName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string szDeviceDescription;
        public uint DeviceSubType;
        public uint reserved;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct EdsDirectoryItemInfo
    {
        public ulong Size; // EdsUInt64 in EDSDK 13.x
        public int isFolder;
        public uint GroupID;
        public uint Option;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string szFileName;
        public uint format;
        public uint dateTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct EdsCapacity
    {
        public int NumberOfFreeClusters;
        public int BytesPerSector;
        public int Reset;
    }

    /// <summary>Values a property may take right now (EdsPropertyDesc). Only the first NumElements entries are valid.</summary>
    [StructLayout(LayoutKind.Sequential)]
    public struct EdsPropertyDesc
    {
        public int Form;
        public int Access;
        public int NumElements;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 128)] public int[] PropDesc;
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate uint EdsPropertyEventHandler(uint inEvent, uint inPropertyID, uint inParam, IntPtr inContext);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate uint EdsObjectEventHandler(uint inEvent, IntPtr inRef, IntPtr inContext);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate uint EdsStateEventHandler(uint inEvent, uint inParameter, IntPtr inContext);

    [DllImport(Dll)] public static extern uint EdsInitializeSDK();
    [DllImport(Dll)] public static extern uint EdsTerminateSDK();
    [DllImport(Dll)] public static extern uint EdsGetEvent();
    [DllImport(Dll)] public static extern uint EdsRelease(IntPtr inRef);
    [DllImport(Dll)] public static extern uint EdsGetCameraList(out IntPtr outCameraListRef);
    [DllImport(Dll)] public static extern uint EdsGetChildCount(IntPtr inRef, out int outCount);
    [DllImport(Dll)] public static extern uint EdsGetChildAtIndex(IntPtr inRef, int inIndex, out IntPtr outRef);
    [DllImport(Dll)] public static extern uint EdsGetDeviceInfo(IntPtr inCameraRef, out EdsDeviceInfo outDeviceInfo);
    [DllImport(Dll)] public static extern uint EdsOpenSession(IntPtr inCameraRef);
    [DllImport(Dll)] public static extern uint EdsCloseSession(IntPtr inCameraRef);
    [DllImport(Dll)] public static extern uint EdsSendCommand(IntPtr inCameraRef, uint inCommand, int inParam);
    [DllImport(Dll)] public static extern uint EdsSetCapacity(IntPtr inCameraRef, EdsCapacity inCapacity);
    [DllImport(Dll)] public static extern uint EdsSetPropertyData(IntPtr inRef, uint inPropertyID, int inParam, int inPropertySize, [In] ref uint inPropertyData);
    [DllImport(Dll)] public static extern uint EdsGetPropertyData(IntPtr inRef, uint inPropertyID, int inParam, int inPropertySize, out uint outPropertyData);
    [DllImport(Dll)] public static extern uint EdsSetObjectEventHandler(IntPtr inCameraRef, uint inEvent, EdsObjectEventHandler inHandler, IntPtr inContext);
    [DllImport(Dll)] public static extern uint EdsSetCameraStateEventHandler(IntPtr inCameraRef, uint inEvent, EdsStateEventHandler inHandler, IntPtr inContext);
    [DllImport(Dll)] public static extern uint EdsSetPropertyEventHandler(IntPtr inCameraRef, uint inEvent, EdsPropertyEventHandler inHandler, IntPtr inContext);
    [DllImport(Dll)] public static extern uint EdsGetPropertyDesc(IntPtr inRef, uint inPropertyID, out EdsPropertyDesc outPropertyDesc);
    [DllImport(Dll)] public static extern uint EdsGetDirectoryItemInfo(IntPtr inDirItemRef, out EdsDirectoryItemInfo outDirItemInfo);
    [DllImport(Dll)] public static extern uint EdsCreateMemoryStream(ulong inBufferSize, out IntPtr outStream);
    [DllImport(Dll)] public static extern uint EdsDownload(IntPtr inDirItemRef, ulong inReadSize, IntPtr outStream);
    [DllImport(Dll)] public static extern uint EdsDownloadComplete(IntPtr inDirItemRef);
    [DllImport(Dll)] public static extern uint EdsGetPointer(IntPtr inStream, out IntPtr outPointer);
    [DllImport(Dll)] public static extern uint EdsGetLength(IntPtr inStream, out ulong outLength);
    [DllImport(Dll)] public static extern uint EdsCreateEvfImageRef(IntPtr inStreamRef, out IntPtr outEvfImageRef);
    [DllImport(Dll)] public static extern uint EdsDownloadEvfImage(IntPtr inCameraRef, IntPtr inEvfImageRef);

    public static void Check(uint err, string what)
    {
        if (err != EDS_ERR_OK) throw new EdsException(err, what);
    }
}

internal sealed class EdsException : Exception
{
    public uint Code { get; }
    public EdsException(uint code, string what) : base($"{what} failed (EDSDK error 0x{code:X8})") => Code = code;
}
