import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localProps = Properties()
val localFile = rootProject.file("local.properties")
if (localFile.exists()) {
    localFile.inputStream().use { localProps.load(it) }
}
val apiBaseUrl =
    (localProps.getProperty("telecrm.apiBaseUrl") ?: "https://REPLACE_WITH_RAILWAY_HOST")
        .trim()
        .trimEnd('/')

android {
    namespace = "com.skcleantec.telecrm"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.skcleantec.telecrm.internal"
        minSdk = 26
        targetSdk = 35
        versionCode = 10
        versionName = "0.6.0-internal"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "ADMIN_TOKEN_KEY", "\"sk_admin_token\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.coordinatorlayout:coordinatorlayout:1.2.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.viewpager2:viewpager2:1.1.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
}
