# Play 크래시 재추적(mapping) — 줄 번호 유지
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# WebView JS 브릿지 — 메서드명은 웹(cbiseoNativeApp.ts)과 같아야 함
# openNavi는 JS에서만 호출되므로 keepclassmembers만으로는 R8이 지울 수 있음
-keep class com.cbiseo.app.bridge.CbiseoAppBridge {
    <methods>;
}
-keep class com.cbiseo.app.navi.StaffNaviLauncher { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
