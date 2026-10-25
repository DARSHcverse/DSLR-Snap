using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace CanonBridge;

/// <summary>
/// Owns one Canon camera session. All methods must be called on the bridge's main (STA) thread,
/// because EDSDK delivers events on the thread that pumps EdsGetEvent().
/// </summary>
internal sealed class CanonCamera : IDisposable
{
    private IntPtr _camera = IntPtr.Zero;
    private bool _sdkReady;
    private bool _liveView;
    private readonly bool _usePressShutter;

    // Keep delegates alive: EDSDK holds raw function pointers to them.
    private readonly Edsdk.EdsObjectEventHandler _objectHandler;
    private readonly Edsdk.EdsStateEventHandler _stateHandler;
    private readonly Edsdk.EdsPropertyEventHandler _propertyHandler;

    private string? _downloadDir;
    private string? _downloadedPath;
    private string? _downloadError;
    private DateTime _lastKeepAlive = DateTime.MinValue;
    private bool _shutdownRequested;
    private bool _exposureChanged;

    public event Action? Disconnected;
    /// <summary>ISO, aperture, shutter, white balance or mode dial changed (on the camera or by us).</summary>
    public event Action? ExposureChanged;
    public string Model { get; private set; } = "";
    public bool IsOpen => _camera != IntPtr.Zero;

    public CanonCamera(bool usePressShutter)
    {
        _usePressShutter = usePressShutter;
        _objectHandler = OnObjectEvent;
        _stateHandler = OnStateEvent;
        _propertyHandler = OnPropertyEvent;
    }

    public void Connect()
    {
        if (IsOpen) return;
        if (!_sdkReady)
        {
            Edsdk.Check(Edsdk.EdsInitializeSDK(), "EdsInitializeSDK");
            _sdkReady = true;
        }

        Edsdk.Check(Edsdk.EdsGetCameraList(out var list), "EdsGetCameraList");
        try
        {
            Edsdk.Check(Edsdk.EdsGetChildCount(list, out var count), "EdsGetChildCount");
            if (count == 0) throw new InvalidOperationException("No Canon camera found. Check the USB cable, that the camera is on, and that EOS Utility is closed.");
            Edsdk.Check(Edsdk.EdsGetChildAtIndex(list, 0, out _camera), "EdsGetChildAtIndex");
        }
        finally
        {
            Edsdk.EdsRelease(list);
        }

        Edsdk.Check(Edsdk.EdsGetDeviceInfo(_camera, out var info), "EdsGetDeviceInfo");
        Model = info.szDeviceDescription;

        Edsdk.Check(Edsdk.EdsSetObjectEventHandler(_camera, Edsdk.ObjectEvent_All, _objectHandler, IntPtr.Zero), "EdsSetObjectEventHandler");
        Edsdk.Check(Edsdk.EdsSetCameraStateEventHandler(_camera, Edsdk.StateEvent_All, _stateHandler, IntPtr.Zero), "EdsSetCameraStateEventHandler");
        Edsdk.Check(Edsdk.EdsSetPropertyEventHandler(_camera, Edsdk.PropertyEvent_All, _propertyHandler, IntPtr.Zero), "EdsSetPropertyEventHandler");
        Edsdk.Check(Edsdk.EdsOpenSession(_camera), "EdsOpenSession");

        // Save images to the PC, not the SD card. The SDK needs a (fake) free-space figure.
        uint saveTo = Edsdk.SaveTo_Host;
        Edsdk.Check(Edsdk.EdsSetPropertyData(_camera, Edsdk.PropID_SaveTo, 0, sizeof(uint), ref saveTo), "Set SaveTo=Host");
        Edsdk.Check(Edsdk.EdsSetCapacity(_camera, new Edsdk.EdsCapacity { NumberOfFreeClusters = 0x7FFFFFFF, BytesPerSector = 0x1000, Reset = 1 }), "EdsSetCapacity");
        KeepAlive(force: true);
    }

    /// <summary>Stops the camera auto-powering off during quiet periods at an event.</summary>
    public void KeepAlive(bool force = false)
    {
        if (!IsOpen) return;
        if (!force && DateTime.UtcNow - _lastKeepAlive < TimeSpan.FromSeconds(60)) return;
        Edsdk.EdsSendCommand(_camera, Edsdk.CameraCommand_ExtendShutDownTimer, 0);
        _lastKeepAlive = DateTime.UtcNow;
    }

    public string Capture(string dir, TimeSpan timeout)
    {
        if (!IsOpen) throw new InvalidOperationException("Camera not connected");
        Directory.CreateDirectory(dir);
        _downloadDir = dir;
        _downloadedPath = null;
        _downloadError = null;

        uint err;
        if (_usePressShutter)
        {
            err = Edsdk.EdsSendCommand(_camera, Edsdk.CameraCommand_PressShutterButton, Edsdk.ShutterButton_Completely);
            Edsdk.EdsSendCommand(_camera, Edsdk.CameraCommand_PressShutterButton, Edsdk.ShutterButton_OFF);
        }
        else
        {
            err = Edsdk.EdsSendCommand(_camera, Edsdk.CameraCommand_TakePicture, 0);
        }
        if (err == Edsdk.EDS_ERR_TAKE_PICTURE_AF_NG) throw new InvalidOperationException("Camera could not focus. Check lighting and that someone is in frame.");
        if (err == Edsdk.EDS_ERR_DEVICE_BUSY) throw new InvalidOperationException("Camera busy, try again.");
        Edsdk.Check(err, "Shutter");

        // Pump events until the transfer handler has saved the file.
        var sw = Stopwatch.StartNew();
        while (_downloadedPath == null && _downloadError == null)
        {
            Edsdk.EdsGetEvent();
            if (_shutdownRequested) throw new InvalidOperationException("Camera disconnected during capture.");
            if (sw.Elapsed > timeout) throw new TimeoutException("Photo was taken but not received from the camera in time.");
            Thread.Sleep(5);
        }
        if (_downloadError != null) throw new InvalidOperationException(_downloadError);
        _lastKeepAlive = DateTime.UtcNow;
        return _downloadedPath!;
    }

    private uint OnObjectEvent(uint inEvent, IntPtr inRef, IntPtr inContext)
    {
        try
        {
            if (inEvent == Edsdk.ObjectEvent_DirItemRequestTransfer) Download(inRef);
        }
        catch (Exception ex)
        {
            _downloadError = ex.Message;
        }
        finally
        {
            if (inRef != IntPtr.Zero) Edsdk.EdsRelease(inRef);
        }
        return Edsdk.EDS_ERR_OK;
    }

    private void Download(IntPtr dirItem)
    {
        Edsdk.Check(Edsdk.EdsGetDirectoryItemInfo(dirItem, out var info), "EdsGetDirectoryItemInfo");
        // RAW+JPEG would produce two transfers; the booth only wants the JPEG. Set the camera to JPEG only.
        var name = Path.GetFileName(info.szFileName);
        if (!name.EndsWith(".JPG", StringComparison.OrdinalIgnoreCase))
        {
            Edsdk.EdsDownloadComplete(dirItem);
            return;
        }
        Edsdk.Check(Edsdk.EdsCreateMemoryStream(info.Size, out var stream), "EdsCreateMemoryStream");
        try
        {
            Edsdk.Check(Edsdk.EdsDownload(dirItem, info.Size, stream), "EdsDownload");
            Edsdk.Check(Edsdk.EdsDownloadComplete(dirItem), "EdsDownloadComplete");
            Edsdk.Check(Edsdk.EdsGetPointer(stream, out var ptr), "EdsGetPointer");
            Edsdk.Check(Edsdk.EdsGetLength(stream, out var len), "EdsGetLength");
            var bytes = new byte[len];
            Marshal.Copy(ptr, bytes, 0, (int)len);
            var path = Path.Combine(_downloadDir!, $"{DateTime.Now:yyyyMMdd_HHmmss_fff}_{name}");
            // Write to a temp name then rename, so the app never reads a half-written file.
            File.WriteAllBytes(path + ".part", bytes);
            File.Move(path + ".part", path, overwrite: true);
            _downloadedPath = path;
        }
        finally
        {
            Edsdk.EdsRelease(stream);
        }
    }

    private uint OnStateEvent(uint inEvent, uint inParameter, IntPtr inContext)
    {
        if (inEvent == Edsdk.StateEvent_WillSoonShutDown) KeepAlive(force: true);
        // Don't release the camera inside its own callback; Pump() does it after EdsGetEvent returns.
        if (inEvent == Edsdk.StateEvent_Shutdown) _shutdownRequested = true;
        return Edsdk.EDS_ERR_OK;
    }

    // ---------------- exposure ----------------

    private static bool IsExposureProp(uint id) =>
        id is Edsdk.PropID_ISOSpeed or Edsdk.PropID_Av or Edsdk.PropID_Tv or Edsdk.PropID_WhiteBalance or Edsdk.PropID_AEMode;

    private uint OnPropertyEvent(uint inEvent, uint inPropertyID, uint inParam, IntPtr inContext)
    {
        // Allowed values change too (PropertyDescChanged) when the dial turns or the lens zooms.
        if ((inEvent == Edsdk.PropertyEvent_PropertyChanged || inEvent == Edsdk.PropertyEvent_PropertyDescChanged) && IsExposureProp(inPropertyID))
            _exposureChanged = true;
        return Edsdk.EDS_ERR_OK;
    }

    /// <summary>Current raw value, or null if the camera doesn't report it (e.g. no lens attached for Av).</summary>
    public long? GetProp(uint id)
    {
        if (!IsOpen) throw new InvalidOperationException("Camera not connected");
        // White balance is EdsInt32 (can be negative); the others are EdsUInt32. Same size, so read as uint and widen.
        var err = Edsdk.EdsGetPropertyData(_camera, id, 0, sizeof(uint), out var value);
        if (err != Edsdk.EDS_ERR_OK) return null;
        return id == Edsdk.PropID_WhiteBalance ? unchecked((int)value) : value;
    }

    /// <summary>Raw values the camera accepts right now. Empty when the property can't be changed in the current mode.</summary>
    public int[] GetAllowed(uint id)
    {
        if (!IsOpen) throw new InvalidOperationException("Camera not connected");
        var err = Edsdk.EdsGetPropertyDesc(_camera, id, out var desc);
        if (err != Edsdk.EDS_ERR_OK || desc.PropDesc == null) return Array.Empty<int>();
        var n = Math.Clamp(desc.NumElements, 0, desc.PropDesc.Length);
        var values = new int[n];
        Array.Copy(desc.PropDesc, values, n);
        return values;
    }

    public void SetProp(uint id, long value)
    {
        if (!IsOpen) throw new InvalidOperationException("Camera not connected");
        if (Array.IndexOf(GetAllowed(id), unchecked((int)value)) < 0)
            throw new InvalidOperationException("That value isn't available on the camera right now. Turn the mode dial to M.");
        var data = unchecked((uint)value);
        // The camera reports busy briefly after a shot or while live view starts; retry for up to ~1 s.
        for (var attempt = 0; ; attempt++)
        {
            var err = Edsdk.EdsSetPropertyData(_camera, id, 0, sizeof(uint), ref data);
            if (err == Edsdk.EDS_ERR_OK) return;
            if (err != Edsdk.EDS_ERR_DEVICE_BUSY || attempt >= 20)
                throw new EdsException(err, "Changing the camera setting (check the mode dial is on M)");
            Edsdk.EdsGetEvent();
            Thread.Sleep(50);
        }
    }

    // ---------------- live view ----------------

    public bool StartLiveView()
    {
        if (!IsOpen) return false;
        uint device = Edsdk.EvfOutputDevice_PC;
        var err = Edsdk.EdsSetPropertyData(_camera, Edsdk.PropID_Evf_OutputDevice, 0, sizeof(uint), ref device);
        _liveView = err == Edsdk.EDS_ERR_OK;
        return _liveView;
    }

    public byte[]? GetLiveViewFrame()
    {
        if (!_liveView) return null;
        Edsdk.Check(Edsdk.EdsCreateMemoryStream(0, out var stream), "EdsCreateMemoryStream");
        IntPtr evf = IntPtr.Zero;
        try
        {
            Edsdk.Check(Edsdk.EdsCreateEvfImageRef(stream, out evf), "EdsCreateEvfImageRef");
            var err = Edsdk.EdsDownloadEvfImage(_camera, evf);
            if (err == Edsdk.EDS_ERR_OBJECT_NOTREADY) return null; // camera still preparing live view
            Edsdk.Check(err, "EdsDownloadEvfImage");
            Edsdk.Check(Edsdk.EdsGetPointer(stream, out var ptr), "EdsGetPointer");
            Edsdk.Check(Edsdk.EdsGetLength(stream, out var len), "EdsGetLength");
            var bytes = new byte[len];
            Marshal.Copy(ptr, bytes, 0, (int)len);
            return bytes;
        }
        finally
        {
            if (evf != IntPtr.Zero) Edsdk.EdsRelease(evf);
            Edsdk.EdsRelease(stream);
        }
    }

    public void StopLiveView()
    {
        if (!IsOpen || !_liveView) return;
        uint device = Edsdk.EvfOutputDevice_TFT;
        Edsdk.EdsSetPropertyData(_camera, Edsdk.PropID_Evf_OutputDevice, 0, sizeof(uint), ref device);
        _liveView = false;
    }

    public void Pump()
    {
        Edsdk.EdsGetEvent();
        if (_exposureChanged)
        {
            _exposureChanged = false;
            ExposureChanged?.Invoke();
        }
        if (_shutdownRequested)
        {
            _shutdownRequested = false;
            ReleaseCamera();
            Disconnected?.Invoke();
        }
    }

    private void ReleaseCamera()
    {
        if (_camera == IntPtr.Zero) return;
        try { StopLiveView(); } catch { /* camera may already be gone */ }
        Edsdk.EdsCloseSession(_camera);
        Edsdk.EdsRelease(_camera);
        _camera = IntPtr.Zero;
    }

    public void Disconnect() => ReleaseCamera();

    public void Dispose()
    {
        ReleaseCamera();
        if (_sdkReady) Edsdk.EdsTerminateSDK();
        _sdkReady = false;
    }
}
