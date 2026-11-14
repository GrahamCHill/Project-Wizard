package com.example.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private int count;
    private boolean showAbout;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            count = state.getInt("count");
            showAbout = state.getBoolean("about");
        }
        render();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putInt("count", count);
        state.putBoolean("about", showAbout);
        super.onSaveInstanceState(state);
    }

    private void render() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        LinearLayout navigation = new LinearLayout(this);
        Button home = new Button(this);
        home.setText("Home");
        home.setOnClickListener(view -> { showAbout = false; render(); });
        Button about = new Button(this);
        about.setText("About");
        about.setOnClickListener(view -> { showAbout = true; render(); });
        navigation.addView(home);
        navigation.addView(about);
        layout.addView(navigation);

        TextView content = new TextView(this);
        content.setTextSize(24);
        content.setGravity(Gravity.CENTER);
        content.setText(showAbout ? "__PROJECT_NAME__" : "Count: " + count);
        layout.addView(content);
        if (!showAbout) {
            Button increment = new Button(this);
            increment.setText("Add one");
            increment.setOnClickListener(view -> {
                count = Counter.next(count);
                content.setText("Count: " + count);
            });
            layout.addView(increment);
        }
        setContentView(layout);
    }
}
