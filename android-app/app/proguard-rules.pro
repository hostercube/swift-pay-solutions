# Keep Moshi generated adapters + Kotlin reflection metadata
-keep class kotlin.Metadata { *; }
-keepclassmembers class * {
    @com.squareup.moshi.FromJson <methods>;
    @com.squareup.moshi.ToJson <methods>;
}
-keep class **JsonAdapter { *; }
-keep @com.squareup.moshi.JsonClass class * { *; }
-keepclassmembers @com.squareup.moshi.JsonClass class * extends java.lang.Enum { <fields>; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# OkHttp / Okio (safe defaults, no reflection)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**

# Kotlinx coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# App: WorkManager Worker classnames used via reflection
-keep class bd.paynoc.merchant.work.** { *; }
-keep class bd.paynoc.merchant.data.** { *; }

# BroadcastReceiver / Service / Activity referenced from AndroidManifest
-keep class bd.paynoc.merchant.sms.** { *; }
-keep class bd.paynoc.merchant.system.** { *; }
-keep class bd.paynoc.merchant.ui.** { *; }
-keep class bd.paynoc.merchant.PayNocApp { *; }

# Room generated implementations
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class **_Impl { *; }
-keepclassmembers class * {
    @androidx.room.* <methods>;
    @androidx.room.* <fields>;
}

# Moshi Kotlin reflective adapter fallback
-keep class kotlin.reflect.jvm.internal.** { *; }
-dontwarn kotlin.reflect.jvm.internal.**

# AndroidX Security Crypto (Tink) — reflective key handling
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**

# Kotlin coroutines internal APIs
-keepclassmembernames class kotlinx.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.debug.**

# Suppress warnings for optional/desugar libs
-dontwarn javax.annotation.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
