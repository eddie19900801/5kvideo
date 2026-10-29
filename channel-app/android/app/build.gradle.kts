plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val channelCode = providers.gradleProperty("channelCode").orElse("direct")
val productSlug = providers.gradleProperty("productSlug").orElse("ppfree")
val productName = providers.gradleProperty("productName").orElse("PP免费")
val productPackage = providers.gradleProperty("productPackage").orElse("cn.ppfree.video")
val productDomain = providers.gradleProperty("productDomain").orElse("5knews.wflhc.cn")
val apiBase = providers.gradleProperty("apiBase").orElse("https://897kg.cc/vdo/api/v1")
android {
    namespace = "cn.ppfree.video"
    compileSdk = 35
    defaultConfig {
        applicationId = productPackage.get()
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "CHANNEL_CODE", "\"${channelCode.get()}\"")
        buildConfigField("String", "PRODUCT_SLUG", "\"${productSlug.get()}\"")
        buildConfigField("String", "PRODUCT_NAME", "\"${productName.get()}\"")
        buildConfigField("String", "PRODUCT_DOMAIN", "\"${productDomain.get()}\"")
        buildConfigField("String", "API_BASE", "\"${apiBase.get()}\"")
        manifestPlaceholders["appLabel"] = productName.get()
    }
    buildFeatures { buildConfig = true }
    buildTypes { release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("debug") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
