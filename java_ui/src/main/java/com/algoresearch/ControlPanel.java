package com.algoresearch;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

public class ControlPanel extends HBox {

    private final App app;

    public ControlPanel(App app) {
        this.app = app;
        setPadding(new Insets(0, 10, 0, 10));
        setSpacing(5);
        setStyle("-fx-background-color: #000000; -fx-border-color: #333333; -fx-border-width: 0 0 1 0;");
        setAlignment(Pos.CENTER_LEFT);
        setMinHeight(38);
        setMaxHeight(38);

        // 1. Symbol Search
        Button symbolBtn = new Button("BTC/USDT");
        symbolBtn.getStyleClass().add("symbol-search-btn");
        symbolBtn.setOnAction(e -> handleSymbolChange());

        // 2. Divider
        Region div1 = createDivider();

        // 3. Timeframes
        HBox timeframes = createTimeframes();

        // 4. Divider
        Region div2 = createDivider();

        // 5. Candles & Indicators
        Button candlesBtn = createIconBtn("Свечи");
        Button indicatorsBtn = createIconBtn("Индикаторы");

        // Spacer
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        // 7. Right Side
        Button loadBtn = new Button("Обновить");
        loadBtn.getStyleClass().add("button-primary");
        loadBtn.setOnAction(e -> app.fetchData("BTC/USDT", "1d"));

        getChildren().addAll(
                symbolBtn,
                div1,
                timeframes,
                div2,
                candlesBtn, indicatorsBtn,
                spacer,
                loadBtn);
    }

    private void handleSymbolChange() {
        System.out.println("Symbol Search Clicked");
        app.fetchData("BTC/USDT", "1d");
    }

    private Button createTimeframeBtn(String text, String apiValue, boolean active) {
        Button btn = new Button(text);
        btn.getStyleClass().add("timeframe-btn");
        if (active) {
            btn.getStyleClass().add("active");
        }
        btn.setOnAction(e -> {
            System.out.println("Timeframe: " + apiValue);
            app.fetchData("BTC/USDT", apiValue);
        });
        return btn;
    }

    // Helper to create simple timeframe list
    private HBox createTimeframes() {
        HBox box = new HBox(2);
        box.getChildren().addAll(
                createTimeframeBtn("1Д", "1d", true),
                createTimeframeBtn("4Ч", "4h", false),
                createTimeframeBtn("1Ч", "1h", false),
                createTimeframeBtn("15М", "15m", false));
        return box;
    }

    private Button createIconBtn(String text) {
        Button btn = new Button(text);
        btn.getStyleClass().add("toolbar-btn");
        return btn;
    }

    private Region createDivider() {
        Region r = new Region();
        r.setMinWidth(1);
        r.setMaxWidth(1);
        r.setMinHeight(16);
        r.setMaxHeight(16);
        r.setStyle("-fx-background-color: #333333;");
        return r;
    }
}
