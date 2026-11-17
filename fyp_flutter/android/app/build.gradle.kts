import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Debug builds may omit Firebase; release builds validate the real client configuration.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val releaseProperties = Properties().apply {
    val propertiesFile = rootProject.file("key.properties")
    if (propertiesFile.isFile) propertiesFile.inputStream().use { load(it) }
}
fun signingValue(property: String, environment: String): String? =
    System.getenv(environment)?.takeIf { it.isNotBlank() }
        ?: releaseProperties.getProperty(property)?.takeIf { it.isNotBlank() }

val releaseStore = signingValue("storeFile", "ANDROID_RELEASE_STORE_FILE")
val releaseStorePassword = signingValue("storePassword", "ANDROID_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "ANDROID_RELEASE_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "ANDROID_RELEASE_KEY_PASSWORD")
val hasReleaseSigning = listOf(releaseStore, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
    .all { !it.isNullOrBlank() }
val allowQaSigning = System.getenv("FYP_ALLOW_DEBUG_RELEASE_SIGNING") == "1"

val validateReleaseConfiguration = tasks.register("validateReleaseConfiguration") {
    doLast {
        val clientFile = file("google-services.json")
        check(clientFile.isFile) { "Release requires the Firebase Android client google-services.json." }
        val config = try {
            JsonSlurper().parse(clientFile) as? Map<*, *>
        } catch (_: Exception) {
            null
        }
        check(config != null && !config.containsKey("private_key") && config["type"] != "service_account") {
            "Invalid Firebase Android client configuration; server credentials are forbidden."
        }
        val project = config["project_info"] as? Map<*, *>
        val clients = config["client"] as? List<*> ?: emptyList<Any>()
        check(project?.get("project_id") == "fyp-tar" && clients.any {
            val info = (it as? Map<*, *>)?.get("client_info") as? Map<*, *>
            val androidInfo = info?.get("android_client_info") as? Map<*, *>
            androidInfo?.get("package_name") == "com.example.fyp_flutter"
        }) { "Firebase project or Android application ID does not match this release." }
        check(hasReleaseSigning || allowQaSigning) {
            "Release signing is missing. Configure key.properties or ANDROID_RELEASE_*; explicit FYP_ALLOW_DEBUG_RELEASE_SIGNING=1 is for local QA only."
        }
        if (hasReleaseSigning) {
            check(file(releaseStore!!).isFile) { "Release keystore file is missing." }
        } else {
            logger.warn("DEBUG-SIGNED: Release-mode FYP demo for manual installation; not production-signed.")
        }
    }
}
tasks.configureEach {
    if (name == "preReleaseBuild") dependsOn(validateReleaseConfiguration)
}

android {
    namespace = "com.example.fyp_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.example.fyp_flutter"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        release {
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release")
                else if (allowQaSigning) signingConfigs.getByName("debug") else null
        }
    }
}

flutter {
    source = "../.."
}
