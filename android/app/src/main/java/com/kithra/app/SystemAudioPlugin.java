package com.kithra.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;

/**
 * Captures system / other-app playback audio (meetings, media) on Android 10+
 * using MediaProjection + AudioPlaybackCapture, recorded by a foreground
 * service to a WAV file. Phone-call audio cannot be captured this way — the
 * platform forbids it — so calls remain mic-only, which the UI reflects.
 */
@CapacitorPlugin(
    name = "SystemAudio",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class SystemAudioPlugin extends Plugin {

    @Override
    public void load() {
        // Surface a stop that the OS / user triggered from the system UI.
        SystemAudioCaptureService.setStopListener(result -> {
            JSObject ev = new JSObject();
            if (result != null) {
                ev.put("path", result.path);
                ev.put("durationMs", result.durationMs);
                ev.put("size", result.bytes);
            }
            notifyListeners("stopped", ev);
        });
    }

    private boolean supported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", supported());
        call.resolve(ret);
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", SystemAudioCaptureService.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!supported()) {
            call.reject("System audio capture requires Android 10 or newer", "UNSUPPORTED");
            return;
        }
        if (SystemAudioCaptureService.isRunning()) {
            call.reject("A capture is already in progress", "BUSY");
            return;
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMic");
            return;
        }
        afterMicGranted(call);
    }

    @PermissionCallback
    private void afterMic(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required to capture audio", "PERMISSION");
            return;
        }
        afterMicGranted(call);
    }

    private void afterMicGranted(PluginCall call) {
        // POST_NOTIFICATIONS (Android 13+) is optional — request it best-effort so the
        // ongoing-capture notification is visible, then continue regardless of the answer.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotif");
            return;
        }
        launchProjection(call);
    }

    @PermissionCallback
    private void afterNotif(PluginCall call) {
        launchProjection(call);
    }

    private void launchProjection(PluginCall call) {
        MediaProjectionManager mpm =
            (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("Media projection is unavailable on this device", "UNSUPPORTED");
            return;
        }
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "projectionResult");
    }

    @ActivityCallback
    private void projectionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Audio capture permission was denied", "DENIED");
            return;
        }

        File out = new File(getContext().getCacheDir(),
            "kithra-capture-" + System.currentTimeMillis() + ".wav");

        Intent svc = new Intent(getContext(), SystemAudioCaptureService.class);
        svc.setAction(SystemAudioCaptureService.ACTION_START);
        svc.putExtra(SystemAudioCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
        svc.putExtra(SystemAudioCaptureService.EXTRA_RESULT_DATA, result.getData());
        svc.putExtra(SystemAudioCaptureService.EXTRA_OUTPUT_PATH, out.getAbsolutePath());
        ContextCompat.startForegroundService(getContext(), svc);

        JSObject ret = new JSObject();
        ret.put("path", out.getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        SystemAudioCaptureService.Result r = SystemAudioCaptureService.stopAndGet();
        if (r == null) {
            call.reject("Not currently capturing", "NOT_RUNNING");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("path", r.path);
        ret.put("uri", Uri.fromFile(new File(r.path)).toString());
        ret.put("mimeType", "audio/wav");
        ret.put("durationMs", r.durationMs);
        ret.put("size", r.bytes);
        call.resolve(ret);
    }
}
