package cn.ppfree.video

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.DownloadListener
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var launchScreen: View
    private val channel = BuildConfig.CHANNEL_CODE
    private val configUrl get() = "${BuildConfig.API_BASE}/products/${BuildConfig.PRODUCT_SLUG}/channels/$channel/config?_=${System.currentTimeMillis()}"
    private val fallbackUrl get() = "https://${BuildConfig.PRODUCT_DOMAIN}/?channel=$channel&app_platform=android"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(11, 13, 22))
            visibility = View.INVISIBLE
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString += " FiveKProductApp/1.0.0 Product/${BuildConfig.PRODUCT_SLUG} Channel/$channel"
            webViewClient = object : WebViewClient() {
                override fun onPageCommitVisible(view: WebView, url: String) {
                    if (isRealPage(url)) revealWebView()
                }
                override fun onPageFinished(view: WebView, url: String) {
                    if (isRealPage(url)) revealWebView()
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.scheme == "http" || uri.scheme == "https") return false
                    return openExternally(uri)
                }
            }
            webChromeClient = WebChromeClient()
            setDownloadListener(DownloadListener { url, _, _, _, _ -> openExternally(Uri.parse(url)) })
        }
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(11, 13, 22))
            addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            launchScreen = createLaunchScreen()
            addView(launchScreen, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        setContentView(root)
        loadRemoteConfig()
    }

    private fun createLaunchScreen(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(48, 48, 48, 48)
        background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.rgb(11, 13, 22), Color.rgb(34, 16, 37), Color.rgb(9, 11, 18)))
        addView(ImageView(context).apply {
            setImageResource(R.drawable.app_icon)
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply { cornerRadius = 28f; setColor(Color.rgb(24, 24, 30)) }
            clipToOutline = true
        }, LinearLayout.LayoutParams(128, 128).apply { bottomMargin = 28 })
        addView(TextView(context).apply {
            text = BuildConfig.PRODUCT_NAME
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(TextView(context).apply {
            text = "启动中…"
            setTextColor(Color.argb(210, 255, 255, 255))
            textSize = 15f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 12 })
        addView(TextView(context).apply {
            text = "正在连接安全线路"
            setTextColor(Color.argb(125, 255, 255, 255))
            textSize = 12f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 18 })
    }

    private fun revealWebView() {
        if (webView.visibility == View.VISIBLE) return
        webView.visibility = View.VISIBLE
        launchScreen.animate().alpha(0f).setDuration(180).withEndAction { (launchScreen.parent as? ViewGroup)?.removeView(launchScreen) }.start()
    }

    private fun isRealPage(url: String?): Boolean = url?.let {
        (it.startsWith("https://") || it.startsWith("http://")) && it != "about:blank"
    } == true

    private fun loadRemoteConfig() {
        val preferences = getSharedPreferences("bootstrap", MODE_PRIVATE)
        val initialUrl = preferences.getString("navigationUrl", fallbackUrl) ?: fallbackUrl
        webView.loadUrl(initialUrl)
        Executors.newSingleThreadExecutor().execute {
            val resolved = try {
                val connection = URL(configUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 6000
                connection.readTimeout = 6000
                connection.useCaches = false
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
                connection.setRequestProperty("Pragma", "no-cache")
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                JSONObject(body).getJSONObject("data").getString("navigationUrl").also {
                    preferences.edit().putString("navigationUrl", it).apply()
                }
            } catch (_: Exception) { initialUrl }
            if (resolved != initialUrl) runOnUiThread {
                if (launchScreen.parent != null) webView.loadUrl(resolved)
            }
        }
    }

    private fun openExternally(uri: Uri): Boolean = try { startActivity(Intent(Intent.ACTION_VIEW, uri)); true } catch (_: Exception) { false }
    @Deprecated("Deprecated in Java") override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
    override fun onDestroy() { webView.destroy(); super.onDestroy() }
}
