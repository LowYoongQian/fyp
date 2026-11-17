package com.example.fyp_flutter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/** Shows updates that arrive while the app is open as normal phone notifications (they pop up like other apps' do). */
class MainActivity : FlutterActivity() {
    private var alerts: MethodChannel? = null
    private var activeOwner: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // High importance is what makes Android pop it up over the screen. FCM uses this channel too (AndroidManifest).
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "Attendance alerts", NotificationManager.IMPORTANCE_HIGH))
        }
        alerts = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "smart_attendance/alerts").also {
            it.setMethodCallHandler { call, result ->
                when (call.method) {
                    "activate" -> {
                        getSystemService(NotificationManager::class.java).cancelAll()
                        activeOwner = call.argument<String>("owner")
                        result.success(null)
                    }
                    "deactivate" -> {
                        if (activeOwner == call.argument<String>("owner")) {
                            activeOwner = null
                            getSystemService(NotificationManager::class.java).cancelAll()
                        }
                        result.success(null)
                    }
                    "show" -> result.success(activeOwner != null && activeOwner == call.argument<String>("owner") && show(call.argument<String>("id").orEmpty(),
                        call.argument<String>("title").orEmpty(), call.argument<String>("body").orEmpty()))
                    // A tap that started the app: hand the notice to Flutter once.
                    "launch" -> result.success(intent?.getStringExtra(EXTRA_ID).also { intent?.removeExtra(EXTRA_ID) })
                    else -> result.notImplemented()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_ID)?.let { alerts?.invokeMethod("opened", it) }
    }

    private fun show(id: String, title: String, body: String): Boolean {
        if (id.isEmpty()) return false
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val open = PendingIntent.getActivity(this, id.hashCode(),
            Intent(this, MainActivity::class.java).putExtra(EXTRA_ID, id).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        fun builder(): Notification.Builder =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
            else @Suppress("DEPRECATION") Notification.Builder(this)
                .setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
        // A locked screen shows only this generic text unless the user allows private notification content.
        val locked = builder().setSmallIcon(R.drawable.ic_stat_notify).setContentTitle("Smart Attendance")
            .setContentText("You have a new update.").build()
        val notice = builder().setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFF2563EB.toInt())
            .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(open).setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(locked).build()
        // Same tag and id as the FCM push for this notice, so one notice never shows twice.
        getSystemService(NotificationManager::class.java).notify(id, 0, notice)
        return true
    }

    companion object {
        const val CHANNEL = "smart_attendance_alerts"
        const val EXTRA_ID = "notification_id"
    }
}
