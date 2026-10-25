using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;

namespace CanonBridge;

/// <summary>
/// JSON-lines bridge between the Electron app and Canon EDSDK.
///   CanonBridge.exe                 → serve commands on stdin/stdout (used by the app)
///   CanonBridge.exe --selftest DIR  → hardware proof-of-concept: connect, shoot 3, report timings
/// Options: --shutter=press (default, recommended for EOS R bodies) | --shutter=take
/// </summary>
internal static class Program
{
    private static readonly BlockingCollection<string> Inbox = new();
    private static readonly object OutLock = new();

    [STAThread]
    private static int Main(string[] args)
    {
        var usePress = !args.Contains("--shutter=take");
        using var camera = new CanonCamera(usePress);

        var selftest = Array.IndexOf(args, "--selftest");
        if (selftest >= 0) return SelfTest(camera, args.Length > selftest + 1 ? args[selftest + 1] : Path.Combine(Path.GetTempPath(), "canon-selftest"));

        camera.Disconnected += () => Emit(new JsonObject { ["event"] = "disconnected" });
        camera.ExposureChanged += () => Emit(new JsonObject { ["event"] = "exposure_changed" });

        var reader = new Thread(() =>
        {
            string? line;
            while ((line = Console.In.ReadLine()) != null) Inbox.Add(line);
            Inbox.CompleteAdding(); // parent closed stdin → shut down
        }) { IsBackground = true };
        reader.Start();

        while (!Inbox.IsCompleted)
        {
            if (Inbox.TryTake(out var line, 15)) Handle(camera, line);
            camera.Pump();      // deliver EDSDK events (state changes, transfers)
            camera.KeepAlive(); // throttled internally to once a minute
        }
        return 0;
    }

    private static void Handle(CanonCamera camera, string line)
    {
        JsonNode? id = null;
        try
        {
            var msg = JsonNode.Parse(line)!.AsObject();
            id = msg["id"]?.DeepClone();
            var cmd = msg["cmd"]?.GetValue<string>() ?? "";
            var args = msg["args"] as JsonObject ?? new JsonObject();
            JsonNode? data = cmd switch
            {
                "ping" => new JsonObject { ["pong"] = true },
                "connect" => Connect(camera),
                "status" => new JsonObject { ["connected"] = camera.IsOpen, ["model"] = camera.Model },
                "capture" => new JsonObject { ["path"] = camera.Capture(args["dir"]!.GetValue<string>(), TimeSpan.FromSeconds(15)) },
                "liveview_start" => camera.StartLiveView() ? new JsonObject() : throw new InvalidOperationException("Live view not available"),
                "liveview_frame" => new JsonObject { ["jpeg"] = camera.GetLiveViewFrame() is { } f ? Convert.ToBase64String(f) : null },
                "liveview_stop" => Do(camera.StopLiveView),
                "get_exposure" => Exposure(camera),
                "set_exposure" => SetExposure(camera, args),
                "disconnect" => Do(camera.Disconnect),
                _ => throw new InvalidOperationException($"Unknown command '{cmd}'")
            };
            Emit(new JsonObject { ["id"] = id, ["ok"] = true, ["data"] = data });
        }
        catch (Exception ex)
        {
            Emit(new JsonObject { ["id"] = id, ["ok"] = false, ["error"] = ex.Message });
        }
    }

    private static JsonObject Connect(CanonCamera camera)
    {
        camera.Connect();
        // Probe live view once so the app knows whether to show a preview.
        var lv = camera.StartLiveView();
        if (lv) camera.StopLiveView();
        return new JsonObject { ["model"] = camera.Model, ["liveView"] = lv };
    }

    // Raw EDSDK codes only; the app turns them into labels (src/main/camera/canonCodes.ts).
    private static readonly (string Key, uint Prop)[] ExposureProps =
    {
        ("iso", Edsdk.PropID_ISOSpeed), ("av", Edsdk.PropID_Av), ("tv", Edsdk.PropID_Tv), ("wb", Edsdk.PropID_WhiteBalance)
    };

    private static JsonObject Exposure(CanonCamera camera)
    {
        var o = new JsonObject { ["mode"] = camera.GetProp(Edsdk.PropID_AEMode) ?? -1 };
        foreach (var (key, prop) in ExposureProps)
        {
            var allowed = new JsonArray();
            foreach (var v in camera.GetAllowed(prop)) allowed.Add(v);
            o[key] = new JsonObject { ["value"] = camera.GetProp(prop), ["allowed"] = allowed };
        }
        return o;
    }

    private static JsonObject SetExposure(CanonCamera camera, JsonObject args)
    {
        var key = args["prop"]?.GetValue<string>();
        var prop = ExposureProps.FirstOrDefault((p) => p.Key == key).Prop;
        if (prop == 0) throw new InvalidOperationException($"Unknown exposure property '{key}'");
        camera.SetProp(prop, args["code"]!.GetValue<long>());
        return Exposure(camera);
    }

    private static JsonObject Do(Action a)
    {
        a();
        return new JsonObject();
    }

    private static void Emit(JsonObject o)
    {
        lock (OutLock)
        {
            Console.Out.WriteLine(o.ToJsonString());
            Console.Out.Flush();
        }
    }

    /// <summary>The hardware gate from the blueprint: prove USB capture works before building more.</summary>
    private static int SelfTest(CanonCamera camera, string dir)
    {
        try
        {
            Console.WriteLine($"Output folder: {dir}");
            var sw = Stopwatch.StartNew();
            camera.Connect();
            Console.WriteLine($"Connected to {camera.Model} in {sw.ElapsedMilliseconds} ms");

            var exposure = Exposure(camera);
            Console.WriteLine($"Exposure (raw EDSDK codes; mode 3 = M): {exposure.ToJsonString()}");

            var lv = camera.StartLiveView();
            Console.WriteLine($"Live view: {(lv ? "supported" : "NOT available")}");
            if (lv)
            {
                byte[]? frame = null;
                var lvTimer = Stopwatch.StartNew();
                while (frame == null && lvTimer.ElapsedMilliseconds < 5000) { camera.Pump(); frame = camera.GetLiveViewFrame(); Thread.Sleep(50); }
                Console.WriteLine(frame != null ? $"  first frame {frame.Length / 1024} KB after {lvTimer.ElapsedMilliseconds} ms" : "  no frame within 5 s");
                camera.StopLiveView();
            }

            for (var i = 1; i <= 3; i++)
            {
                sw.Restart();
                var path = camera.Capture(dir, TimeSpan.FromSeconds(15));
                Console.WriteLine($"Shot {i}: {Path.GetFileName(path)} ({new FileInfo(path).Length / 1024} KB) in {sw.ElapsedMilliseconds} ms");
                Thread.Sleep(1000);
            }
            Console.WriteLine("PASS — camera capture works. Now unplug and re-plug the USB cable and run again to test reconnects.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"FAIL — {ex.Message}");
            return 1;
        }
    }
}
