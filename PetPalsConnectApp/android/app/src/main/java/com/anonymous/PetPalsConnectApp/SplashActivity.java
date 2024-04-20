package com.yourappbundle;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.splash_screen);

        int SPLASH_TIME_OUT = 3000; // Splash screen timer (3 seconds)
        new Handler().postDelayed(() -> {
            // Start your app main activity
            startActivity(new Intent(SplashActivity.this, MainActivity.class));

            // Close the SplashActivity
            finish();
        }, SPLASH_TIME_OUT);
    }
}
