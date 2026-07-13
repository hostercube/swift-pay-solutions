plugins {
    id("com.android.application") version "8.5.0"
    id("org.jetbrains.kotlin.android") version "2.0.0"
    // Kotlin 2.0 requires the Compose plugin — the old kotlinCompilerExtensionVersion
    // path was removed and will fail the build otherwise.
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.0"
    id("com.google.devtools.ksp") version "2.0.0-1.0.21"
}

android {
    namespace = "bd.paynoc.merchant"
    compileSdk = 34

    defaultConfig {
        applicationId = "bd.paynoc.merchant"
        // Android 5.0 Lollipop through Android 14. Compose, WorkManager 2.9,
        // Room 2.6 and OkHttp 4 all support 21+. Features that require newer
        // APIs (EncryptedSharedPreferences ≥23, notification channels ≥26,
        // POST_NOTIFICATIONS ≥33, dataSync FGS type ≥34) are guarded at
        // runtime with graceful fallbacks.
        minSdk = 21
        targetSdk = 34
        versionCode = 4
        versionName = "1.3.0"
        vectorDrawables { useSupportLibrary = true }
        multiDexEnabled = true
    }

    buildFeatures { compose = true }

    // Release signing. Reads keystore path/password from either Gradle
    // properties (~/.gradle/gradle.properties) or environment variables so
    // CI and local builds both work without committing secrets:
    //   PAYNOC_KEYSTORE_FILE, PAYNOC_KEYSTORE_PASSWORD,
    //   PAYNOC_KEY_ALIAS,     PAYNOC_KEY_PASSWORD
    // If none are set, `assembleRelease` still runs but produces an unsigned
    // APK — install-only for local testing; upload to Play requires signing.
    signingConfigs {
        create("release") {
            val ksPath = (findProperty("PAYNOC_KEYSTORE_FILE") as String?)
                ?: System.getenv("PAYNOC_KEYSTORE_FILE")
            val ksPass = (findProperty("PAYNOC_KEYSTORE_PASSWORD") as String?)
                ?: System.getenv("PAYNOC_KEYSTORE_PASSWORD")
            val alias  = (findProperty("PAYNOC_KEY_ALIAS") as String?)
                ?: System.getenv("PAYNOC_KEY_ALIAS")
            val keyPass = (findProperty("PAYNOC_KEY_PASSWORD") as String?)
                ?: System.getenv("PAYNOC_KEY_PASSWORD")
            if (!ksPath.isNullOrBlank() && !ksPass.isNullOrBlank()
                && !alias.isNullOrBlank() && !keyPass.isNullOrBlank()) {
                storeFile = file(ksPath)
                storePassword = ksPass
                keyAlias = alias
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Only attach the signing config if keystore was actually configured.
            val cfg = signingConfigs.getByName("release")
            if (cfg.storeFile != null) signingConfig = cfg
        }
        debug {
            isMinifyEnabled = false
        }
    }

    kotlinOptions { jvmTarget = "17" }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Desugar java.time + other APIs missing on API 21-25 so we don't
        // crash on older Lollipop/Marshmallow devices.
        isCoreLibraryDesugaringEnabled = true
    }

    packaging {
        resources.excludes += setOf(
            "META-INF/AL2.0",
            "META-INF/LGPL2.1",
            "META-INF/DEPENDENCIES",
        )
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.moshi:moshi:1.15.1")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.multidex:multidex:2.0.1")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
