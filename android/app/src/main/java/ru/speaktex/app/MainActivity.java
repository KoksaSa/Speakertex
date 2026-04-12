package ru.speaktex.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.Context;
import android.widget.Toast;
import java.util.Locale;
import java.util.HashMap;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity implements TextToSpeech.OnInitListener {
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String currentSpeakText = "";
    private String currentLang = "ru-RU";
    private float currentRate = 1.0f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Инициализация TTS
        tts = new TextToSpeech(this, this);

        // Включаем поддержку Web Speech API и добавляем JS интерфейс
        Bridge bridge = getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Добавляем JavaScript интерфейс для TTS
                webView.addJavascriptInterface(new TTSInterface(), "AndroidTTS");
            }
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.forLanguageTag("ru-RU"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.getDefault());
            }

            // Устанавливаем слушатель для уведомления об окончании
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {}

                @Override
                public void onDone(String utteranceId) {
                    runOnUiThread(() -> {
                        Bridge bridge = getBridge();
                        if (bridge != null) {
                            WebView webView = bridge.getWebView();
                            if (webView != null) {
                                webView.evaluateJavascript("window.ttsEndCallback && window.ttsEndCallback()", null);
                            }
                        }
                    });
                }

                @Override
                public void onError(String utteranceId) {
                    onDone(utteranceId);
                }
            });

            ttsReady = true;
            runOnUiThread(() -> {
                Bridge bridge = getBridge();
                if (bridge != null) {
                    WebView webView = bridge.getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript("window.ttsReadyCallback && window.ttsReadyCallback(true)", null);
                    }
                }
            });
        } else {
            runOnUiThread(() -> {
                Bridge bridge = getBridge();
                if (bridge != null) {
                    WebView webView = bridge.getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript("window.ttsReadyCallback && window.ttsReadyCallback(false)", null);
                    }
                }
            });
        }
    }

    // JavaScript интерфейс для управления TTS
    public class TTSInterface {
        @JavascriptInterface
        public void speak(String text, String lang, float rate) {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    currentSpeakText = text;
                    currentLang = lang;
                    currentRate = rate;

                    tts.stop();

                    Locale locale = Locale.forLanguageTag(lang);
                    int result = tts.setLanguage(locale);
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                    }

                    tts.setSpeechRate(rate);

                    HashMap<String, String> params = new HashMap<>();
                    params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "utterance_id");
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    tts.stop();
                }
            });
        }

        @JavascriptInterface
        public void pause() {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    tts.stop();
                }
            });
        }

        @JavascriptInterface
        public void resume() {
            runOnUiThread(() -> {
                if (ttsReady && tts != null && !currentSpeakText.isEmpty()) {
                    Locale locale = Locale.forLanguageTag(currentLang);
                    int result = tts.setLanguage(locale);
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                    }
                    tts.setSpeechRate(currentRate);

                    HashMap<String, String> params = new HashMap<>();
                    params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "utterance_id");
                    tts.speak(currentSpeakText, TextToSpeech.QUEUE_FLUSH, params);
                }
            });
        }

        @JavascriptInterface
        public boolean isReady() {
            return ttsReady;
        }
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }
}
