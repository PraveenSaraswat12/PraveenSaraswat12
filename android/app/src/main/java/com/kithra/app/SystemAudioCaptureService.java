package com.kithra.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;

import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Foreground service that records system / other-app playback audio via
 * MediaProjection + AudioPlaybackCapture into a 16-bit PCM mono WAV file.
 * Started by {@link SystemAudioPlugin} once the user grants capture consent.
 */
@RequiresApi(api = Build.VERSION_CODES.Q)
public class SystemAudioCaptureService extends Service {

    public static final String ACTION_START = "com.kithra.app.action.START_AUDIO_CAPTURE";
    public static final String ACTION_STOP  = "com.kithra.app.action.STOP_AUDIO_CAPTURE";
    public static final String EXTRA_RESULT_CODE = "result_code";
    public static final String EXTRA_RESULT_DATA = "result_data";
    public static final String EXTRA_OUTPUT_PATH = "output_path";

    private static final String TAG = "KithraSystemAudio";
    private static final String CHANNEL_ID = "kithra_system_audio";
    private static final int NOTIF_ID = 0xCAFE;

    private static final int SAMPLE_RATE = 44100;
    private static final int CHANNELS = 1;            // mono
    private static final int BITS_PER_SAMPLE = 16;
    private static final int CHANNEL_MASK = AudioFormat.CHANNEL_IN_MONO;

    /** Result of a finished capture. */
    public static class Result {
        public String path;
        public long durationMs;
        public long bytes;
    }

    public interface StopListener { void onStopped(@Nullable Result result); }

    private static volatile SystemAudioCaptureService sInstance;
    private static volatile StopListener sStopListener;

    public static boolean isRunning() {
        SystemAudioCaptureService s = sInstance;
        return s != null && s.capturing;
    }

    public static void setStopListener(@Nullable StopListener l) { sStopListener = l; }

    /** Stops an app-initiated capture and returns the finished file synchronously. */
    @Nullable
    public static Result stopAndGet() {
        SystemAudioCaptureService s = sInstance;
        if (s == null) return null;
        return s.finish(false);
    }

    private MediaProjection projection;
    private AudioRecord audioRecord;
    private Thread captureThread;
    private RandomAccessFile raf;
    private volatile boolean capturing = false;
    private boolean finished = false;
    private String outputPath;
    private long pcmBytes = 0;
    private Result lastResult;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            finish(true);
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Android 14 requires the FGS to be in the foreground (with the
        // mediaProjection type) before the projection is acquired.
        startForegroundInternal();

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED);
        @SuppressWarnings("deprecation")
        Intent data = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        outputPath = intent.getStringExtra(EXTRA_OUTPUT_PATH);

        if (resultCode != Activity.RESULT_OK || data == null || outputPath == null) {
            fail("Missing media projection consent");
            return START_NOT_STICKY;
        }

        MediaProjectionManager mpm =
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        projection = mpm != null ? mpm.getMediaProjection(resultCode, data) : null;
        if (projection == null) {
            fail("Unable to obtain media projection");
            return START_NOT_STICKY;
        }
        projection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { finish(true); }
        }, new Handler(Looper.getMainLooper()));

        try {
            startRecording();
        } catch (Exception e) {
            Log.e(TAG, "startRecording failed", e);
            fail("Could not start audio capture: " + e.getMessage());
            return START_NOT_STICKY;
        }

        sInstance = this;
        finished = false;
        return START_NOT_STICKY;
    }

    @SuppressLint("MissingPermission") // RECORD_AUDIO is verified by the plugin before start
    private void startRecording() throws IOException {
        AudioPlaybackCaptureConfiguration config =
            new AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build();

        AudioFormat format = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(CHANNEL_MASK)
            .build();

        int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_MASK, AudioFormat.ENCODING_PCM_16BIT);
        if (minBuf <= 0) minBuf = SAMPLE_RATE * 2;
        final int bufSize = Math.max(minBuf, SAMPLE_RATE * 2);

        audioRecord = new AudioRecord.Builder()
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufSize)
            .setAudioPlaybackCaptureConfig(config)
            .build();

        raf = new RandomAccessFile(outputPath, "rw");
        raf.setLength(0);
        writeWavHeader(raf, 0);   // placeholder; finalized on stop
        pcmBytes = 0;

        audioRecord.startRecording();
        capturing = true;

        captureThread = new Thread(() -> {
            byte[] buffer = new byte[bufSize];
            try {
                while (capturing) {
                    int n = audioRecord.read(buffer, 0, buffer.length);
                    if (n > 0) {
                        raf.write(buffer, 0, n);
                        pcmBytes += n;
                    } else if (n == AudioRecord.ERROR_INVALID_OPERATION || n == AudioRecord.ERROR_BAD_VALUE) {
                        break;
                    }
                }
            } catch (IOException e) {
                Log.e(TAG, "capture loop write error", e);
            }
        }, "kithra-audio-capture");
        captureThread.start();
    }

    private synchronized Result finish(boolean notify) {
        if (finished) return lastResult;
        finished = true;
        capturing = false;

        if (captureThread != null) {
            try { captureThread.join(3000); } catch (InterruptedException ignored) {}
            captureThread = null;
        }
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) {}
            try { audioRecord.release(); } catch (Exception ignored) {}
            audioRecord = null;
        }
        if (projection != null) {
            try { projection.stop(); } catch (Exception ignored) {}
            projection = null;
        }
        if (raf != null) {
            try { writeWavHeader(raf, pcmBytes); } catch (IOException e) { Log.e(TAG, "header finalize failed", e); }
            try { raf.close(); } catch (IOException ignored) {}
            raf = null;
        }

        Result r = new Result();
        r.path = outputPath;
        r.bytes = pcmBytes;
        long bytesPerSec = (long) SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8;
        r.durationMs = bytesPerSec > 0 ? (pcmBytes * 1000L / bytesPerSec) : 0;
        lastResult = r;

        sInstance = null;
        stopForegroundCompat();
        stopSelf();

        if (notify) {
            StopListener l = sStopListener;
            if (l != null) l.onStopped(r);
        }
        return r;
    }

    private void fail(String message) {
        Log.e(TAG, message);
        finished = true;
        capturing = false;
        if (captureThread != null) {
            try { captureThread.join(1000); } catch (InterruptedException ignored) {}
            captureThread = null;
        }
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) {}
            try { audioRecord.release(); } catch (Exception ignored) {}
            audioRecord = null;
        }
        if (projection != null) {
            try { projection.stop(); } catch (Exception ignored) {}
            projection = null;
        }
        if (raf != null) { try { raf.close(); } catch (IOException ignored) {} raf = null; }
        sInstance = null;
        stopForegroundCompat();
        stopSelf();
        StopListener l = sStopListener;
        if (l != null) l.onStopped(null);
    }

    @SuppressWarnings("deprecation")
    private void stopForegroundCompat() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(Service.STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
    }

    private void startForegroundInternal() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Audio capture", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Kithra is capturing meeting & media audio");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        Notification notification = b
            .setContentTitle("Kithra is listening")
            .setContentText("Capturing meeting & media audio")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pi)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        finish(true);
        super.onDestroy();
    }

    // ---- WAV (PCM, little-endian) header ----
    private static void writeWavHeader(RandomAccessFile out, long pcmLen) throws IOException {
        long byteRate = (long) SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8;
        int blockAlign = CHANNELS * BITS_PER_SAMPLE / 8;
        long riffLen = 36 + pcmLen;
        out.seek(0);
        out.writeBytes("RIFF");
        writeIntLE(out, (int) riffLen);
        out.writeBytes("WAVE");
        out.writeBytes("fmt ");
        writeIntLE(out, 16);                       // PCM fmt chunk size
        writeShortLE(out, (short) 1);              // audio format = PCM
        writeShortLE(out, (short) CHANNELS);
        writeIntLE(out, SAMPLE_RATE);
        writeIntLE(out, (int) byteRate);
        writeShortLE(out, (short) blockAlign);
        writeShortLE(out, (short) BITS_PER_SAMPLE);
        out.writeBytes("data");
        writeIntLE(out, (int) pcmLen);
    }

    private static void writeIntLE(RandomAccessFile out, int v) throws IOException {
        out.write(v & 0xff);
        out.write((v >> 8) & 0xff);
        out.write((v >> 16) & 0xff);
        out.write((v >> 24) & 0xff);
    }

    private static void writeShortLE(RandomAccessFile out, short v) throws IOException {
        out.write(v & 0xff);
        out.write((v >> 8) & 0xff);
    }
}
