# Play 크래시 재추적(mapping) — 줄 번호 유지
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# WebView JS 브릿지 — 메서드명은 웹(cbiseoNativeApp.ts)과 같아야 함
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
